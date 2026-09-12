import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import type { Config } from './config.js';
import { Store, openDatabaseWithStatus } from './db.js';
import { SyncEngine } from './sync.js';
import { SearchIndex } from './search.js';
import { Hub } from './hub.js';
import { ValidationError } from './entities.js';
import type { Ctx } from './context.js';
import { registerArchiveRoutes } from './routes/archive.js';
import { registerTripRoutes } from './routes/trips.js';
import { registerShoppingRoutes } from './routes/shopping.js';
import { registerCalendarRoutes } from './routes/calendar.js';
import { registerAvailabilityRoutes } from './routes/availability.js';
import { fetchLinkPreview, UnsafeUrlError } from './linkPreview.js';
import { ENTITY_KINDS, type EntityKind } from '../../shared/src/types.js';

export interface App {
  fastify: FastifyInstance;
  ctx: Ctx;
  close: () => Promise<void>;
}

/** Public routes: everything else needs a bearer token. */
const OPEN_PATHS = new Set(['/health', '/api/spaces', '/api/spaces/join']);

function bearerToken(request: FastifyRequest): string | undefined {
  const header = request.headers.authorization;
  if (!header) return undefined;
  const [scheme, value] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !value) return undefined;
  return value.trim();
}

export function buildApp(config: Config): App {
  const { db, needsReindex } = openDatabaseWithStatus(config.dbPath);
  const store = new Store(db);
  const sync = new SyncEngine(db);
  const search = new SearchIndex(db);
  const hub = new Hub();
  const ctx: Ctx = { config, db, store, sync, search, hub };

  // A schema change can force the FTS table to be recreated empty; refill it
  // from the entity tables before the first request arrives.
  if (needsReindex) sync.reindexAll();

  const fastify = Fastify({
    logger: process.env.NODE_ENV === 'test' ? false : { level: process.env.LOG_LEVEL ?? 'info' },
    bodyLimit: config.maxImportBytes + 1024 * 1024,
  });

  fastify.register(cors, {
    origin: config.corsOrigins.includes('*') ? true : config.corsOrigins,
  });
  fastify.register(websocket);

  /**
   * Treat an empty JSON body as an absent one.
   *
   * Fastify's default JSON parser fails a request that announces
   * `content-type: application/json` and then sends no bytes. That is a
   * perfectly ordinary thing for an HTTP client to do on a DELETE, and it made
   * all three DELETE endpoints answer 400 to our own app. The client no longer
   * sends the header without a body, but the server should not be brittle about
   * it either.
   */
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (_request, body: string, done) => {
      if (body === '') return done(null, undefined);
      try {
        done(null, JSON.parse(body));
      } catch (error) {
        const failure = error as Error & { statusCode?: number };
        failure.statusCode = 400;
        done(failure, undefined);
      }
    },
  );

  fastify.setErrorHandler((error, request, reply) => {
    if (error instanceof ValidationError) {
      return reply.code(400).send({ error: 'invalid_request', message: error.message });
    }
    if (error instanceof UnsafeUrlError) {
      return reply.code(400).send({ error: 'unsafe_url', message: error.message });
    }
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode && statusCode < 500) {
      const message = error instanceof Error ? error.message : 'Invalid request.';
      return reply.code(statusCode).send({ error: 'invalid_request', message });
    }
    request.log.error({ err: error }, 'unhandled error');
    return reply.code(500).send({ error: 'internal_error', message: 'Something went wrong.' });
  });

  // Bearer-token auth for every /api route that isn't in OPEN_PATHS.
  fastify.addHook('onRequest', async (request, reply) => {
    const path = request.url.split('?')[0] ?? '';
    if (!path.startsWith('/api') || OPEN_PATHS.has(path)) return;
    if (path === '/api/ws') return; // the socket route authenticates itself

    const user = store.authenticate(bearerToken(request));
    if (!user) {
      return reply.code(401).send({ error: 'unauthorized', message: 'Missing or invalid token.' });
    }
    request.user = user;
  });

  registerCoreRoutes(fastify, ctx);
  registerArchiveRoutes(fastify, ctx);
  registerTripRoutes(fastify, ctx);
  registerShoppingRoutes(fastify, ctx);
  registerCalendarRoutes(fastify, ctx);
  registerAvailabilityRoutes(fastify, ctx);

  return {
    fastify,
    ctx,
    close: async () => {
      hub.closeAll();
      await fastify.close();
      db.close();
    },
  };
}

function registerCoreRoutes(app: FastifyInstance, ctx: Ctx): void {
  const { store, sync, search, hub, config } = ctx;

  app.get('/health', async () => ({
    ok: true,
    service: 'ortak',
    connections: hub.connectionCount,
    time: Date.now(),
  }));

  // -------------------------------------------------------------------------
  // Spaces and membership
  // -------------------------------------------------------------------------

  /** Create a household and become its first member. */
  app.post<{ Body: { spaceName: string; userName: string; baseCurrency?: string; signupSecret?: string } }>(
    '/api/spaces',
    {
      schema: {
        body: {
          type: 'object',
          required: ['spaceName', 'userName'],
          additionalProperties: false,
          properties: {
            spaceName: { type: 'string', minLength: 1, maxLength: 100 },
            userName: { type: 'string', minLength: 1, maxLength: 100 },
            baseCurrency: { type: 'string', minLength: 3, maxLength: 3 },
            signupSecret: { type: 'string', maxLength: 200 },
          },
        },
      },
    },
    async (request, reply) => {
      if (config.signupSecret && request.body.signupSecret !== config.signupSecret) {
        return reply.code(403).send({ error: 'forbidden', message: 'Sign-up secret is wrong.' });
      }

      const space = store.createSpace(request.body.spaceName, request.body.baseCurrency ?? 'EUR');
      const { user, token } = store.addMember(space.id, request.body.userName);
      const full = store.getSpace(space.id)!;

      return reply.code(201).send({
        space: { id: full.id, name: full.name, baseCurrency: full.baseCurrency, inviteCode: full.inviteCode },
        user,
        // Shown once; the phone stores it and it is never returned again.
        token,
      });
    },
  );

  /** Join an existing household with the invite code from the other phone. */
  app.post<{ Body: { inviteCode: string; userName: string; signupSecret?: string } }>(
    '/api/spaces/join',
    {
      schema: {
        body: {
          type: 'object',
          required: ['inviteCode', 'userName'],
          additionalProperties: false,
          properties: {
            inviteCode: { type: 'string', minLength: 4, maxLength: 20 },
            userName: { type: 'string', minLength: 1, maxLength: 100 },
            signupSecret: { type: 'string', maxLength: 200 },
          },
        },
      },
    },
    async (request, reply) => {
      if (config.signupSecret && request.body.signupSecret !== config.signupSecret) {
        return reply.code(403).send({ error: 'forbidden', message: 'Sign-up secret is wrong.' });
      }

      const spaceId = store.findSpaceByInviteCode(request.body.inviteCode);
      if (!spaceId) {
        return reply.code(404).send({ error: 'not_found', message: 'That invite code does not exist.' });
      }

      const { user, token } = store.addMember(spaceId, request.body.userName);
      const space = store.getSpace(spaceId)!;

      return reply.code(201).send({
        space: { id: space.id, name: space.name, baseCurrency: space.baseCurrency, inviteCode: space.inviteCode },
        user,
        token,
      });
    },
  );

  /** Who am I, who else is here, and what is the current revision. */
  app.get('/api/me', async (request) => {
    const space = store.getSpace(request.user.spaceId)!;
    return {
      user: request.user,
      space: {
        id: space.id,
        name: space.name,
        baseCurrency: space.baseCurrency,
        inviteCode: space.inviteCode,
      },
      members: store.listMembers(space.id),
      rev: sync.currentRev(space.id),
      presence: hub.presenceFor(space.id),
    };
  });

  app.post<{ Body: { name: string } }>(
    '/api/me',
    {
      schema: {
        body: {
          type: 'object',
          required: ['name'],
          additionalProperties: false,
          properties: { name: { type: 'string', minLength: 1, maxLength: 100 } },
        },
      },
    },
    async (request) => {
      store.renameMember(request.user.id, request.body.name);
      return { ok: true, members: store.listMembers(request.user.spaceId) };
    },
  );

  /** Rotate the invite code — the "we're done adding people" button. */
  app.post('/api/spaces/rotate-invite', async (request) => ({
    inviteCode: store.rotateInviteCode(request.user.spaceId),
  }));

  // -------------------------------------------------------------------------
  // Sync
  // -------------------------------------------------------------------------

  app.get<{ Querystring: { since?: string; kinds?: string } }>('/api/sync', async (request) => {
    const since = Number(request.query.since ?? 0);
    const kinds = request.query.kinds
      ? (request.query.kinds.split(',').filter((k) => (ENTITY_KINDS as readonly string[]).includes(k)) as EntityKind[])
      : ENTITY_KINDS;
    return sync.pull(request.user.spaceId, Number.isFinite(since) ? since : 0, kinds);
  });

  app.post<{ Body: { changes: Partial<Record<EntityKind, unknown[]>> } }>(
    '/api/sync',
    {
      schema: {
        body: {
          type: 'object',
          required: ['changes'],
          additionalProperties: false,
          properties: { changes: { type: 'object' } },
        },
      },
    },
    async (request) => {
      const result = sync.push(request.user.spaceId, request.user.id, request.body.changes);
      if (Object.keys(result.applied).length > 0) {
        // Nudge the other phone. The pusher already knows, so it is skipped.
        hub.publishRev(request.user.spaceId, result.rev, request.user.id);
      }
      return result;
    },
  );

  // -------------------------------------------------------------------------
  // Search
  // -------------------------------------------------------------------------

  app.get<{
    Querystring: { q: string; kinds?: string; from?: string; to?: string; limit?: string; offset?: string; order?: string };
  }>('/api/search', async (request) => {
    const { q, kinds, from, to, limit, offset, order } = request.query;
    if (!q?.trim()) return { query: '', total: 0, hits: [] };

    const options = {
      kinds: kinds
        ? (kinds.split(',').filter((k) => (ENTITY_KINDS as readonly string[]).includes(k)) as EntityKind[])
        : undefined,
      from: from ? Number(from) : undefined,
      to: to ? Number(to) : undefined,
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0,
      order: order === 'recent' ? ('recent' as const) : ('relevance' as const),
    };

    return {
      query: q,
      total: search.count(request.user.spaceId, q, options),
      hits: search.search(request.user.spaceId, q, options),
    };
  });

  // -------------------------------------------------------------------------
  // Presence and realtime
  // -------------------------------------------------------------------------

  /** Heartbeat: "I'm in the shop". Repeated by the app while the screen is open. */
  app.post<{ Body: { context: string } }>(
    '/api/presence',
    {
      schema: {
        body: {
          type: 'object',
          required: ['context'],
          additionalProperties: false,
          properties: { context: { type: 'string', maxLength: 100 } },
        },
      },
    },
    async (request) => {
      if (request.body.context) {
        hub.setPresence(request.user.spaceId, request.user.id, request.user.name, request.body.context);
      } else {
        hub.clearPresence(request.user.spaceId, request.user.id);
      }
      return { entries: hub.presenceFor(request.user.spaceId) };
    },
  );

  /**
   * The realtime socket.
   *
   * Authenticates from a query parameter because browser and React Native
   * WebSocket clients cannot set an Authorization header on the handshake.
   *
   * It lives inside its own `register` on purpose. @fastify/websocket works by
   * installing an onRoute hook that rewrites routes carrying `websocket: true`,
   * and an onRoute hook only sees routes declared *after* the plugin has
   * finished loading. Plugin loading is deferred to boot, so a route declared
   * straight onto the root instance — as this one was — is built before the
   * hook exists and stays an ordinary GET: the handshake then answered 500 and
   * every live update in the app silently stopped working. Wrapping it in a
   * register puts it behind the plugin in avvio's boot order.
   */
  app.register(async function realtimeRoutes(scoped) {
    scoped.get<{ Querystring: { token?: string } }>(
      '/api/ws',
      { websocket: true },
      (socket, request) => {
        const user = store.authenticate(request.query.token);
        if (!user) {
          socket.send(JSON.stringify({ type: 'error', error: 'unauthorized' }));
          socket.close();
          return;
        }

        const client = hub.add(socket, user.spaceId, user.id, user.name);
        socket.send(JSON.stringify({ type: 'hello', rev: sync.currentRev(user.spaceId), userId: user.id }));

        socket.on('message', (raw: Buffer | string) => {
          let message: { type?: string; context?: string };
          try {
            message = JSON.parse(String(raw)) as { type?: string; context?: string };
          } catch {
            return;
          }

          if (message.type === 'presence' && typeof message.context === 'string') {
            // An empty context means "I've stopped looking at that", the same
            // as the HTTP endpoint treats it. Storing it verbatim left the
            // other phone showing a blank presence chip forever.
            const context = message.context.slice(0, 100).trim();
            if (context) {
              hub.setPresence(user.spaceId, user.id, user.name, context);
            } else {
              hub.clearPresence(user.spaceId, user.id);
            }
          } else if (message.type === 'ping') {
            socket.send(JSON.stringify({ type: 'pong', rev: sync.currentRev(user.spaceId) }));
          }
        });

        socket.on('close', () => hub.remove(client));
        socket.on('error', () => hub.remove(client));
      },
    );
  });

  // -------------------------------------------------------------------------
  // Link previews
  // -------------------------------------------------------------------------

  app.post<{ Body: { url: string } }>(
    '/api/links/preview',
    {
      schema: {
        body: {
          type: 'object',
          required: ['url'],
          additionalProperties: false,
          properties: { url: { type: 'string', minLength: 4, maxLength: 4000 } },
        },
      },
    },
    async (request, reply) => {
      if (!config.linkPreviews) {
        return reply.code(503).send({ error: 'disabled', message: 'Link previews are turned off.' });
      }
      try {
        return await fetchLinkPreview(request.body.url);
      } catch (error) {
        if (error instanceof UnsafeUrlError) {
          return reply.code(400).send({ error: 'unsafe_url', message: error.message });
        }
        // A preview is a nicety; a site that is slow or hostile shouldn't stop
        // the link from being saved.
        return {
          url: request.body.url,
          title: null,
          description: null,
          imageUrl: null,
          siteName: null,
          failed: true,
        };
      }
    },
  );

  // -------------------------------------------------------------------------
  // Notes export
  // -------------------------------------------------------------------------

  /**
   * A note as plain text.
   *
   * This is what the macOS script and the iOS Shortcut fetch when copying a note
   * into Apple Notes — see scripts/ and the README. Plain text rather than JSON
   * so a Shortcut can pipe it straight into "Create Note" with no parsing.
   */
  app.get<{ Params: { noteId: string } }>('/api/notes/:noteId.txt', async (request, reply) => {
    const row = ctx.db
      .prepare('SELECT title, body FROM notes WHERE id = ? AND space_id = ? AND deleted = 0')
      .get(request.params.noteId, request.user.spaceId) as
      | { title: string; body: string }
      | undefined;

    if (!row) return reply.code(404).send({ error: 'not_found', message: 'Unknown note' });

    reply.type('text/plain; charset=utf-8');
    return row.title ? `${row.title}\n\n${row.body}` : row.body;
  });
}

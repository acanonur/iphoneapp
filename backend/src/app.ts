import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from 'fastify';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { hostname } from 'node:os';
import { CallEngine } from './calls.js';
import type { ClaudeSettings } from './claude.js';
import { keyRequired, type Config } from './config.js';
import { TaskStore } from './db.js';
import { lanUrls } from './discovery.js';
import {
  isDocumentKind,
  offlineDocumentResult,
  processDocumentTask,
  scheduleResult,
} from './documents.js';
import { landingPage, pairPage } from './pairing.js';
import { MockProvider, type MockTimings } from './providers/mock.js';
import { RetellProvider, describeError, type RetellWebhookBody } from './providers/retell.js';
import { verifyRetellSignature } from './retell-signature.js';
import { newTask } from './tasks.js';
import {
  TASK_KINDS,
  isLanguage,
  type CallProvider,
  type Language,
  type Profile,
  type SecretaryTask,
  type TaskKind,
} from './types.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** The request body exactly as received; only kept for webhook routes. */
    rawBody?: Buffer | null;
  }
}

/** The contract the app checks before it trusts a server: bump on breaking changes. */
export const API_VERSION = 2;

const E164_PATTERN = '^\\+[1-9][0-9]{6,14}$';
const LANGUAGE_ENUM = ['de', 'en', 'tr'];
/** A finished call carries word-level timestamps; allow room for a long one. */
const WEBHOOK_BODY_LIMIT = 8 * 1024 * 1024;

const CREATE_TASK_SCHEMA = {
  body: {
    type: 'object',
    required: ['goal'],
    additionalProperties: false,
    properties: {
      kind: { type: 'string', enum: TASK_KINDS },
      goal: { type: 'string', minLength: 4, maxLength: 2000 },
      phoneNumber: { type: 'string', pattern: E164_PATTERN },
      language: { type: 'string', enum: LANGUAGE_ENUM },
      summaryLanguage: { type: 'string', enum: LANGUAGE_ENUM },
      userName: { type: 'string', maxLength: 100 },
      documentText: { type: 'string', maxLength: 20000 },
      todoWhen: { type: 'string', maxLength: 100 },
    },
  },
} as const;

/** `/api/calls` predates the other kinds and still requires a destination. */
const CREATE_CALL_SCHEMA = {
  body: {
    ...CREATE_TASK_SCHEMA.body,
    required: ['goal', 'phoneNumber', 'language'],
  },
} as const;

const PROFILE_SCHEMA = {
  body: {
    type: 'object',
    additionalProperties: false,
    properties: {
      name: { type: ['string', 'null'], maxLength: 100 },
      language: { type: 'string', enum: LANGUAGE_ENUM },
      answerCalls: { type: 'boolean' },
      answerNote: { type: ['string', 'null'], maxLength: 600 },
    },
  },
} as const;

const INCOMING_SCHEMA = {
  body: {
    type: ['object', 'null'],
    additionalProperties: false,
    properties: {
      language: { type: 'string', enum: LANGUAGE_ENUM },
    },
  },
} as const;

interface CreateTaskBody {
  kind?: TaskKind;
  goal: string;
  phoneNumber?: string;
  language?: Language;
  summaryLanguage?: Language;
  userName?: string;
  documentText?: string;
  todoWhen?: string;
}

interface ProfileBody {
  name?: string | null;
  language?: Language;
  answerCalls?: boolean;
  answerNote?: string | null;
}

export interface AppOptions {
  /** Overrides the provider chosen from config (used by tests). */
  provider?: CallProvider;
  /** Overrides how long each stage of a simulated call takes. */
  mockTimings?: Partial<MockTimings>;
  /** How long a document task simulates working before it resolves. */
  documentDelayMs?: number;
  /** Replaces the network layer of the Retell client (used by tests). */
  retellFetch?: typeof fetch;
}

export interface App {
  fastify: FastifyInstance;
  store: TaskStore;
  engine: CallEngine;
  /** The key the app must present, or null while the server is open. */
  accessKey: string | null;
  webhookSecret: string;
  /** Tells the server its public address once a tunnel is up. */
  setPublicBaseUrl(url: string | null): void;
  /**
   * Points the phone number's incoming calls at this server's current address.
   * Needed after every start when the public address is not a fixed one.
   */
  refreshCallAnswering(): Promise<void>;
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Keeps the webhook secret out of the request log. */
function redactUrl(url: string): string {
  return url.replace(/(\/webhooks\/retell\/)[^/?#]+/, '$1[secret]');
}

function cleanText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function buildApp(config: Config, options: AppOptions = {}): App {
  const fastify = Fastify({
    logger:
      process.env.NODE_ENV === 'test'
        ? false
        : {
            serializers: {
              req(request: FastifyRequest) {
                return {
                  method: request.method,
                  url: redactUrl(request.url),
                  remoteAddress: request.ip,
                };
              },
            },
          },
  });
  const store = new TaskStore(config.dbPath);
  const documentDelayMs = options.documentDelayMs ?? 1_500;
  const pendingDocumentTimers = new Set<NodeJS.Timeout>();

  // Nobody has to invent a secret: both are made up on first start and kept.
  const webhookSecret =
    config.webhookSecret ??
    store.settingOrCreate('webhook_secret', () => randomBytes(24).toString('hex'));
  const accessKey = keyRequired(config)
    ? (config.apiKey ?? store.settingOrCreate('access_key', () => randomBytes(18).toString('base64url')))
    : null;

  const claude: ClaudeSettings | null = config.anthropicApiKey
    ? { apiKey: config.anthropicApiKey, model: config.anthropicModel }
    : null;

  const engine = new CallEngine({
    store,
    config,
    claude,
    webhookSecret,
    log: {
      info: (message) => fastify.log.info(message),
      warn: (message) => fastify.log.warn(message),
      error: (message) => fastify.log.error(message),
    },
  });

  let retell: RetellProvider | null = null;
  let mock: MockProvider | null = null;
  let provider: CallProvider;
  if (options.provider) {
    provider = options.provider;
  } else if (config.provider === 'retell' && config.retell) {
    retell = new RetellProvider(config.retell, {
      webhookUrl: () => engine.webhookUrl(),
      maxCallMinutes: config.maxCallMinutes,
      fetch: options.retellFetch,
      log: (message) => fastify.log.warn(message),
    });
    provider = retell;
  } else {
    mock = new MockProvider(engine.applyUpdate, config.mockPace, options.mockTimings);
    provider = mock;
  }
  if (retell) {
    engine.useRetell(retell);
    engine.startPolling();
  }
  engine.recoverAfterRestart();

  // MARK: - Documents

  /**
   * Works a letter, message, form or follow-up. Runs in the background after
   * the task is acknowledged, so the app can show it queued and then watch it
   * resolve — the same shape a call has.
   */
  async function runDocumentTask(taskId: string): Promise<void> {
    const task = store.get(taskId);
    if (!task) return;

    // A follow-up is a date, not a piece of writing — no model needed.
    if (task.kind === 'followup') {
      engine.applyUpdate(taskId, scheduleResult(task));
      return;
    }

    const result = claude ? await processDocumentTask(claude, task) : null;
    engine.applyUpdate(taskId, result ?? offlineDocumentResult(task));
  }

  function scheduleDocumentTask(taskId: string, delayMs = documentDelayMs): void {
    const timer = setTimeout(() => {
      pendingDocumentTimers.delete(timer);
      void runDocumentTask(taskId);
    }, delayMs);
    timer.unref();
    pendingDocumentTimers.add(timer);
  }

  // MARK: - Who is asking

  function deviceIdOf(request: FastifyRequest): string | null {
    const value = request.headers['x-device-id'];
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > 100) return null;
    return trimmed;
  }

  function presentedKey(request: FastifyRequest): string | null {
    const header = request.headers.authorization;
    if (typeof header !== 'string') return null;
    const match = /^Bearer\s+(.+)$/i.exec(header.trim());
    return match?.[1]?.trim() || null;
  }

  // Every /api route needs the access key (when one is required) and a device.
  fastify.addHook('onRequest', async (request, reply) => {
    if (!request.url.startsWith('/api/')) return;
    if (accessKey) {
      const key = presentedKey(request);
      if (!key) {
        return reply.code(401).send({ error: 'This server needs an access key', code: 'key_required' });
      }
      if (!safeEqual(key, accessKey)) {
        return reply.code(401).send({ error: 'The access key is not correct', code: 'key_invalid' });
      }
    }
    if (!deviceIdOf(request)) {
      return reply
        .code(400)
        .send({ error: 'Missing or invalid X-Device-Id header', code: 'device_required' });
    }
  });

  function profileFor(deviceId: string): Profile {
    return (
      store.getProfile(deviceId) ?? {
        deviceId,
        name: null,
        language: 'en',
        answerCalls: false,
        answerNote: null,
        updatedAt: new Date(0).toISOString(),
      }
    );
  }

  function callsLast24Hours(): number {
    return store.countOutboundCallsSince(new Date(Date.now() - 24 * 3_600_000).toISOString());
  }

  // MARK: - Open routes

  const serverName = hostname().replace(/\.local$/, '');

  function listeningPort(): number {
    const address = fastify.server.address();
    return address && typeof address === 'object' ? address.port : config.port;
  }

  /** What anyone may know: that this is a Yaver server, and what it needs from the app. */
  fastify.get('/health', async () => ({
    ok: true,
    service: 'yaver',
    version: API_VERSION,
    name: serverName,
    provider: provider.name,
    simulated: provider.simulated,
    auth: accessKey ? 'key' : 'none',
    reports: claude ? 'claude' : 'basic',
  }));

  fastify.get('/', async (_request, reply) =>
    reply.type('text/html; charset=utf-8').send(landingPage()),
  );
  fastify.get('/pair', async (_request, reply) =>
    reply.type('text/html; charset=utf-8').send(pairPage()),
  );

  // MARK: - Session and profile

  fastify.get('/api/session', async (request) => {
    const deviceId = deviceIdOf(request)!;
    return {
      ok: true,
      version: API_VERSION,
      provider: provider.name,
      simulated: provider.simulated,
      reports: claude ? 'claude' : 'basic',
      /** Whether this server can pick up calls for its owner at all. */
      canAnswerCalls: provider.simulated || (retell?.canAnswerCalls ?? false),
      /** The number to forward unanswered calls to. */
      answerNumber: retell?.canAnswerCalls ? (config.retell?.fromNumber ?? null) : null,
      /** Whether the phone company can reach this server (needed for live transcripts). */
      reachable: engine.publicBaseUrl !== null,
      allowedCountryPrefixes: config.allowedCountryPrefixes,
      maxCallMinutes: config.maxCallMinutes,
      maxCallsPerDay: config.maxCallsPerDay,
      callsToday: provider.simulated ? 0 : callsLast24Hours(),
      /** Other addresses this server answers on; the app keeps them as fallbacks. */
      addresses: [
        ...(engine.publicBaseUrl ? [engine.publicBaseUrl] : []),
        ...lanUrls(listeningPort()),
      ],
      profile: profileFor(deviceId),
    };
  });

  fastify.get('/api/profile', async (request) => profileFor(deviceIdOf(request)!));

  fastify.put<{ Body: ProfileBody }>(
    '/api/profile',
    { schema: PROFILE_SCHEMA },
    async (request, reply) => {
      const deviceId = deviceIdOf(request)!;
      const current = profileFor(deviceId);
      const body = request.body ?? {};
      const next = {
        deviceId,
        name: body.name === undefined ? current.name : cleanText(body.name),
        language: body.language ?? current.language,
        answerCalls: body.answerCalls ?? current.answerCalls,
        answerNote: body.answerNote === undefined ? current.answerNote : cleanText(body.answerNote),
      };

      // Switching answering on or off is a change at the phone company, not
      // just a flag here: the answering agent goes on, or comes off, the number.
      if (next.answerCalls !== current.answerCalls && retell) {
        if (!retell.canAnswerCalls) {
          return reply.code(409).send({
            error: 'Answering calls is not set up on this server yet',
            code: 'answering_not_set_up',
          });
        }
        if (next.answerCalls && !engine.webhookUrl()) {
          return reply.code(409).send({
            error: 'Answering calls needs a server the phone company can reach from the internet',
            code: 'public_address_needed',
          });
        }
        try {
          await retell.setInboundAnswering(next.answerCalls, engine.webhookUrl());
        } catch (error) {
          request.log.error({ err: error }, 'could not change call answering at the provider');
          return reply.code(502).send({
            error: `The phone provider did not accept the change: ${describeError(error)}`,
            code: 'provider_failed',
          });
        }
      }
      return store.saveProfile(next);
    },
  );

  // MARK: - Tasks

  /**
   * Creates any kind of task. Calls go straight to the voice provider;
   * everything else is queued for the document worker.
   */
  async function createTask(
    request: FastifyRequest<{ Body: CreateTaskBody }>,
    reply: FastifyReply,
    defaultKind: TaskKind,
  ) {
    const deviceId = deviceIdOf(request)!;
    const body = request.body;
    const kind = body.kind ?? defaultKind;

    if (kind === 'call') {
      const number = body.phoneNumber;
      if (!number) {
        return reply
          .code(400)
          .send({ error: 'A phone call needs a phoneNumber', code: 'number_required' });
      }
      if (!config.allowedCountryPrefixes.some((prefix) => number.startsWith(prefix))) {
        return reply.code(400).send({
          error: `Destination not allowed. Allowed country prefixes: ${config.allowedCountryPrefixes.join(', ')}`,
          code: 'destination_not_allowed',
          allowed: config.allowedCountryPrefixes,
        });
      }
      if (
        !provider.simulated &&
        config.maxCallsPerDay > 0 &&
        callsLast24Hours() >= config.maxCallsPerDay
      ) {
        return reply.code(429).send({
          error: `This server places at most ${config.maxCallsPerDay} calls in 24 hours`,
          code: 'limit_reached',
          limit: config.maxCallsPerDay,
        });
      }
    }

    const goal = body.goal.trim();
    const task = newTask({
      deviceId,
      kind,
      goal,
      phoneNumber: kind === 'call' ? (body.phoneNumber ?? null) : null,
      language: body.language ?? 'de',
      summaryLanguage: body.summaryLanguage ?? 'en',
      userName: cleanText(body.userName),
      status: kind === 'reminder' ? 'scheduled' : 'queued',
      simulated: kind === 'call' && provider.simulated,
      documentText: cleanText(body.documentText),
      todo: kind === 'reminder' ? goal : null,
      todoWhen: cleanText(body.todoWhen),
    });
    store.create(task);

    // A reminder is just a note the app asked us to keep; it is already done.
    if (kind === 'reminder') {
      return reply.code(201).send(task);
    }

    if (isDocumentKind(kind)) {
      scheduleDocumentTask(task.id);
      return reply.code(201).send(task);
    }

    try {
      const { providerCallId } = await provider.startCall(task);
      // The provider has the call and is dialling. An event may already have
      // moved the task on, so only step forward from `queued`.
      const fresh = store.get(task.id);
      const updated = store.update(task.id, {
        providerCallId,
        ...(fresh?.status === 'queued' && !provider.simulated ? { status: 'dialing' } : {}),
      });
      return reply.code(201).send(updated);
    } catch (error) {
      request.log.error({ err: error }, 'provider startCall failed');
      const updated = store.update(task.id, {
        status: 'failed',
        errorCode: 'provider_error',
        error: describeError(error),
      });
      return reply.code(502).send(updated);
    }
  }

  function listTasks(request: FastifyRequest) {
    return store.listByDevice(deviceIdOf(request)!);
  }

  function ownTask(request: FastifyRequest<{ Params: { id: string } }>): SecretaryTask | null {
    const task = store.get(request.params.id);
    return task && task.deviceId === deviceIdOf(request) ? task : null;
  }

  function getTask(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    return ownTask(request) ?? reply.code(404).send({ error: 'Not found', code: 'not_found' });
  }

  /** Hangs up a call that is still going on. */
  async function cancelTask(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) {
    const task = ownTask(request);
    if (!task) return reply.code(404).send({ error: 'Not found', code: 'not_found' });
    if (!CallEngine.isActive(task)) return task;

    try {
      await provider.stopCall?.(task);
    } catch (error) {
      request.log.error({ err: error }, 'provider stopCall failed');
      return reply.code(502).send({
        error: `The call could not be ended: ${describeError(error)}`,
        code: 'provider_failed',
      });
    }
    engine.finishCancelled(task.id);
    return store.get(task.id) ?? task;
  }

  fastify.post<{ Body: CreateTaskBody }>(
    '/api/tasks',
    { schema: CREATE_TASK_SCHEMA },
    async (request, reply) => createTask(request, reply, 'call'),
  );
  fastify.get('/api/tasks', async (request) => listTasks(request));
  fastify.get<{ Params: { id: string } }>('/api/tasks/:id', async (request, reply) =>
    getTask(request, reply),
  );
  fastify.post<{ Params: { id: string } }>('/api/tasks/:id/cancel', async (request, reply) =>
    cancelTask(request, reply),
  );

  // The call-only routes the first version of the app shipped with.
  fastify.post<{ Body: CreateTaskBody }>(
    '/api/calls',
    { schema: CREATE_CALL_SCHEMA },
    async (request, reply) => createTask(request, reply, 'call'),
  );
  fastify.get('/api/calls', async (request) => listTasks(request));
  fastify.get<{ Params: { id: string } }>('/api/calls/:id', async (request, reply) =>
    getTask(request, reply),
  );

  /**
   * Simulator only: plays an incoming call that the secretary answers, so the
   * "answer my calls" side of the app can be seen without a phone number.
   */
  fastify.post<{ Body: { language?: Language } | null }>(
    '/api/dev/incoming',
    { schema: INCOMING_SCHEMA },
    async (request, reply) => {
      if (!mock) {
        return reply
          .code(409)
          .send({ error: 'Only available while calls are simulated', code: 'not_simulated' });
      }
      const deviceId = deviceIdOf(request)!;
      const profile = profileFor(deviceId);
      const requested = request.body?.language;
      // A caller who speaks another language than the owner reads is the
      // interesting case: it is the one the translation is for.
      const callerLanguage: Language = isLanguage(requested)
        ? requested
        : profile.language === 'de'
          ? 'tr'
          : 'de';
      const task = newTask({
        deviceId,
        kind: 'call',
        direction: 'inbound',
        goal: '',
        phoneNumber: '+49301234567',
        language: callerLanguage,
        summaryLanguage: profile.language,
        userName: profile.name,
        status: 'in_progress',
        simulated: true,
        providerCallId: `mock_in_${randomBytes(6).toString('hex')}`,
      });
      store.create(task);
      mock.playInbound(task, callerLanguage);
      return reply.code(201).send(task);
    },
  );

  // MARK: - Webhooks from the voice provider

  /**
   * An encapsulated scope: only here is the raw request body kept (the
   * signature is computed over the exact bytes) and the size limit raised.
   */
  void fastify.register(async (scope) => {
    scope.decorateRequest('rawBody', null);
    const parseJson = scope.getDefaultJsonParser('error', 'error');
    scope.addContentTypeParser(
      'application/json',
      { parseAs: 'buffer', bodyLimit: WEBHOOK_BODY_LIMIT },
      (request, body, done) => {
        const raw = body as Buffer;
        request.rawBody = raw;
        parseJson(request, raw.toString('utf8'), done);
      },
    );

    function authorised(request: FastifyRequest, token: string | undefined): boolean {
      const tokenOk = token !== undefined && safeEqual(token, webhookSecret);
      if (config.provider === 'retell' && config.retell?.verifySignature) {
        // Retell signs every delivery with the API key. A secret in the
        // address, when present, must match as well.
        if (token !== undefined && !tokenOk) return false;
        return (
          request.rawBody != null &&
          verifyRetellSignature(
            request.rawBody,
            config.retell.webhookKey,
            request.headers['x-retell-signature'],
          )
        );
      }
      // No signature to check (the simulator, or checking switched off): the
      // secret in the address is the only thing standing in the way.
      return tokenOk;
    }

    async function receive(
      request: FastifyRequest<{ Params: { token?: string }; Body: RetellWebhookBody }>,
      reply: FastifyReply,
    ) {
      if (!authorised(request, request.params.token)) {
        return reply.code(401).send({ error: 'Webhook not authorised' });
      }
      // Answer at once: the provider waits ten seconds at most, and the slow
      // part (writing the report) runs in the background.
      return engine.handleWebhook(request.body);
    }

    scope.post<{ Params: { token?: string }; Body: RetellWebhookBody }>(
      '/webhooks/retell',
      receive,
    );
    scope.post<{ Params: { token?: string }; Body: RetellWebhookBody }>(
      '/webhooks/retell/:token',
      receive,
    );
  });

  // Document tasks whose timer was lost in a restart would stay queued forever.
  fastify.addHook('onReady', async () => {
    for (const deviceTask of store.listQueuedDocuments()) {
      scheduleDocumentTask(deviceTask.id, 0);
    }
  });

  fastify.addHook('onClose', async () => {
    mock?.stop();
    engine.stop();
    for (const timer of pendingDocumentTimers) clearTimeout(timer);
    pendingDocumentTimers.clear();
    store.close();
  });

  return {
    fastify,
    store,
    engine,
    accessKey,
    webhookSecret,
    setPublicBaseUrl(url) {
      engine.publicBaseUrl = url;
    },
    async refreshCallAnswering() {
      const url = engine.webhookUrl();
      if (!retell?.canAnswerCalls || !url || !store.inboundOwner()?.answerCalls) return;
      await retell.setInboundAnswering(true, url);
    },
  };
}

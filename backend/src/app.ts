import Fastify, {
  type FastifyError,
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from 'fastify';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { CallEngine } from './calls.js';
import type { ClaudeSettings } from './claude.js';
import { keyRequired, type Config } from './config.js';
import { TaskStore } from './db.js';
import { refusalFor } from './destinations.js';
import { computerName, lanUrls } from './discovery.js';
import {
  isDocumentKind,
  processDocumentTask,
  scheduleResult,
  unworkedDocumentResult,
} from './documents.js';
import { landingPage, pairPage } from './pairing.js';
import { buildInboundVariables } from './prompt.js';
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
      // The app stops at 2,000 characters as a person counts them; an accent
      // or an emoji can be several of the units counted here.
      goal: { type: 'string', minLength: 4, maxLength: 4000 },
      phoneNumber: { type: 'string', pattern: E164_PATTERN },
      language: { type: 'string', enum: LANGUAGE_ENUM },
      summaryLanguage: { type: 'string', enum: LANGUAGE_ENUM },
      userName: { type: 'string', maxLength: 100 },
      documentText: { type: 'string', maxLength: 40000 },
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
      callLanguage: { type: ['string', 'null'], enum: [...LANGUAGE_ENUM, null] },
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
  callLanguage?: Language | null;
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
  /** Receives one plain sentence for each thing a person would want to know happened. */
  announce?: (line: string) => void;
  /** When to ask the phone service for a finished call's summary (used by tests). */
  analysisDelaysMs?: number[];
}

function minutesAndSeconds(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** What a task's new state means, in a sentence for the server's window. */
function progressLine(task: SecretaryTask): string | null {
  const note = task.simulated ? ' (simulated)' : '';
  if (task.kind !== 'call') {
    const what = { letter: 'Letter', message: 'Message', form: 'Form', followup: 'Follow-up', reminder: 'Reminder' }[
      task.kind
    ];
    switch (task.status) {
      case 'completed':
        return `${what}: done`;
      case 'draft':
        return `${what}: a draft is ready in the app`;
      case 'needs_input':
        return `${what}: waiting for an answer in the app`;
      case 'scheduled':
        return `${what}: scheduled`;
      case 'failed':
        return `${what}: not done — ${task.error ?? 'no reason given'}`;
      default:
        return null;
    }
  }
  const number = task.phoneNumber ?? 'an unknown number';
  if (task.direction === 'inbound') {
    // A call this server only heard of afterwards: say when it was.
    const rang = Date.parse(task.createdAt);
    const earlier = Number.isFinite(rang) && Date.now() - rang > 15 * 60_000;
    if (earlier) {
      if (task.status !== 'completed' && task.status !== 'failed') return null;
      const when = new Date(rang);
      const clock = `${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`;
      const day = when.toDateString() === new Date().toDateString() ? 'today' : `on ${when.toDateString().slice(0, 10)}`;
      return `Fetched a call from ${number} that was answered ${day} at ${clock} — a note is on its way to the app`;
    }
    switch (task.status) {
      case 'in_progress':
        return `Answering a call from ${number}${note}`;
      case 'completed':
        return `The call from ${number} is over — a note is on its way to the app${note}`;
      case 'failed':
        return `The call from ${number} ended: ${task.error ?? 'nothing was said'}${note}`;
      default:
        return null;
    }
  }
  switch (task.status) {
    case 'dialing':
      return `Calling ${number}${note}`;
    case 'in_progress':
      return `${number} picked up${note}`;
    case 'completed':
      return `The call to ${number} is over${
        task.durationSeconds != null ? ` (${minutesAndSeconds(task.durationSeconds)})` : ''
      }${note}`;
    case 'failed':
      return `The call to ${number} did not get through: ${task.error ?? task.errorCode ?? 'no reason given'}${note}`;
    default:
      return null;
  }
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
   * Brings call answering up to date after a start or a change of address:
   * fetches the calls that were answered while the server was not running,
   * and tells the phone company where this server is now.
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
            // A line per request would bury the QR code within a minute; what
            // a person needs to know is said in plain sentences (announce).
            // Warnings and errors always show.
            level: config.logRequests ? 'info' : 'warn',
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
  const announce = options.announce ?? (() => {});
  // Every refusal leaves in the same shape — { error, code } — because the
  // app turns the code into words in its owner's language. Without this, a
  // request the server cannot read comes back in the framework's own format,
  // and the owner is shown "Bad Request".
  fastify.setErrorHandler((error: FastifyError, request, reply) => {
    const status =
      typeof error.statusCode === 'number' && error.statusCode >= 400 ? error.statusCode : 500;
    if (status >= 500) {
      request.log.error(error);
      return reply.code(status).send({ error: 'The server ran into a problem', code: 'internal' });
    }
    return reply
      .code(status)
      .send({ error: error.message, code: status === 413 ? 'too_large' : 'invalid_request' });
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
    ...(options.analysisDelaysMs ? { analysisDelaysMs: options.analysisDelaysMs } : {}),
    log: {
      info: (message) => fastify.log.info(message),
      warn: (message) => fastify.log.warn(message),
      error: (message) => fastify.log.error(message),
    },
    onProgress: (task) => {
      const line = progressLine(task);
      if (line) announce(line);
    },
  });
  /** Phones that have been let in since the server started. */
  const greeted = new Set<string>();

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

    // Without a report writer there is nobody to read the letter: say so,
    // rather than calling it done.
    if (!claude) {
      engine.applyUpdate(taskId, unworkedDocumentResult('reports_off'));
      return;
    }
    const result = await processDocumentTask(claude, task);
    engine.applyUpdate(taskId, result ?? unworkedDocumentResult('report_failed'));
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
  //
  // Which routes those are is decided by the route that matched, never by the
  // address as it was written: the router reads "/%61pi/tasks" as "/api/tasks",
  // so a check on the written address could simply be walked around.
  fastify.addHook('onRequest', async (request, reply) => {
    const route = request.routeOptions.url ?? '';
    if (!route.startsWith('/api/')) return;
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
        callLanguage: null,
        answerCalls: false,
        answerCallsReal: false,
        answerNote: null,
        updatedAt: new Date(0).toISOString(),
      }
    );
  }

  function callsLast24Hours(): number {
    return store.countOutboundCallsSince(new Date(Date.now() - 24 * 3_600_000).toISOString());
  }

  // MARK: - Open routes

  const serverName = computerName();

  function listeningPort(): number {
    const address = fastify.server.address();
    return address && typeof address === 'object' ? address.port : config.port;
  }

  /**
   * What anyone may know: that this is a Yaver server, and what it needs from
   * the app.
   *
   * The app finds servers by itself, so it must be able to tell *its* server
   * from anything else that answers on the network before it sends its key
   * there. It sends a random challenge; a server that holds the key answers
   * with a proof (an HMAC of the challenge), which gives nothing away.
   */
  fastify.get<{ Querystring: { challenge?: string } }>('/health', async (request) => {
    const challenge = request.query.challenge;
    const proof =
      accessKey && typeof challenge === 'string' && challenge.length >= 16 && challenge.length <= 128
        ? createHmac('sha256', accessKey).update(challenge).digest('hex')
        : undefined;
    return {
      ok: true,
      service: 'yaver',
      version: API_VERSION,
      name: serverName,
      provider: provider.name,
      simulated: provider.simulated,
      auth: accessKey ? 'key' : 'none',
      reports: claude ? 'claude' : 'basic',
      ...(proof ? { proof } : {}),
    };
  });

  fastify.get('/', async (_request, reply) =>
    reply.type('text/html; charset=utf-8').send(landingPage()),
  );
  fastify.get('/pair', async (_request, reply) =>
    reply.type('text/html; charset=utf-8').send(pairPage()),
  );

  // MARK: - Session and profile

  fastify.get('/api/session', async (request) => {
    const deviceId = deviceIdOf(request)!;
    if (!greeted.has(deviceId)) {
      if (greeted.size > 1_000) greeted.clear();
      greeted.add(deviceId);
      announce('An iPhone connected — the app has found this server');
    }
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
        callLanguage: body.callLanguage === undefined ? current.callLanguage : body.callLanguage,
        answerCalls: body.answerCalls ?? current.answerCalls,
        answerCallsReal: current.answerCallsReal,
        answerNote: body.answerNote === undefined ? current.answerNote : cleanText(body.answerNote),
      };
      // The app asks about the phone service before it switches answering
      // on with real calls; a switch made while calls are simulated is not.
      if (next.answerCalls !== current.answerCalls) {
        next.answerCallsReal = next.answerCalls && !provider.simulated;
      }

      // Callers are answered by the phone company, whether this server is
      // running or not. So what they hear — and whether anyone answers at
      // all — is kept there, and a change goes there before it is saved here:
      // the app must never show something callers do not get.
      const answeringChanged = next.answerCalls !== current.answerCalls;
      const wordingChanged =
        next.name !== current.name ||
        next.language !== current.language ||
        next.callLanguage !== current.callLanguage ||
        next.answerNote !== current.answerNote;
      if (retell && answeringChanged && next.answerCalls && !retell.canAnswerCalls) {
        return reply.code(409).send({
          error: 'Answering calls is not set up on this server yet',
          code: 'answering_not_set_up',
        });
      }
      if (retell?.canAnswerCalls && (answeringChanged || (next.answerCalls && wordingChanged))) {
        try {
          if (!next.answerCalls) {
            await retell.setInboundAnswering(false);
          } else if (answeringChanged) {
            await retell.setInboundAnswering(true, {
              eventsUrl: engine.webhookUrl(),
              defaults: buildInboundVariables(next),
            });
          } else {
            await retell.setInboundDefaults(buildInboundVariables(next));
          }
        } catch (error) {
          request.log.error({ err: error }, 'could not change call answering at the provider');
          return reply.code(502).send({
            error: `The phone provider did not accept the change: ${describeError(error)}`,
            code: 'provider_failed',
          });
        }
      }
      const saved = store.saveProfile(next);
      if (answeringChanged) {
        announce(
          next.answerCalls
            ? `Answering calls for ${next.name ?? 'the owner'} is switched on`
            : 'Answering calls is switched off',
        );
        // Just switched on: there may be calls from before. Just switched
        // off: whatever was taken up to now is still collected.
        if (next.answerCalls) void engine.importAnsweredCalls();
        else engine.answeringSwitchedOff();
      }
      return saved;
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
      const refusal = refusalFor(
        number,
        config.allowedCountryPrefixes,
        config.blockedPrefixes,
        config.alwaysBlockedPrefixes,
      );
      if (refusal === 'country') {
        return reply.code(400).send({
          error: `Destination not allowed. Allowed country prefixes: ${config.allowedCountryPrefixes.join(', ')}`,
          code: 'destination_not_allowed',
          allowed: config.allowedCountryPrefixes,
        });
      }
      if (refusal === 'special') {
        return reply.code(400).send({
          error:
            'This is a premium-rate, special or emergency number, or one charged as an international call. The server does not dial those.',
          code: 'number_not_allowed',
        });
      }
      // A real call says at once on whose behalf the AI is calling. Nobody
      // should be rung by an AI for "a client" they cannot name.
      if (!provider.simulated && !cleanText(body.userName)) {
        return reply.code(400).send({
          error: 'A real call needs the name of the person it is made for (userName)',
          code: 'name_required',
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
      const hungUp = fresh?.errorCode === 'cancelled';
      const updated = store.update(task.id, {
        providerCallId,
        ...(fresh?.status === 'queued' && !provider.simulated && !hungUp ? { status: 'dialing' } : {}),
      });
      // Hung up while the call was still being placed: there was nothing to
      // end then. There is now — and it must not ring on unwatched.
      if (hungUp && updated && CallEngine.isActive(updated)) {
        try {
          await provider.stopCall?.(updated);
        } catch (error) {
          // The engine asks again while it waits for the call to end.
          request.log.error({ err: error }, 'provider stopCall failed for a call hung up while it was placed');
        }
        engine.finishCancelled(task.id);
        return reply.code(201).send(store.get(task.id) ?? updated);
      }
      return reply.code(201).send(updated);
    } catch (error) {
      request.log.error({ err: error }, 'provider startCall failed');
      // The request failed — but did the call? An event may have named it
      // while the request was still waiting: then it exists, whatever became
      // of the answer. Calling that "failed" would leave a call running that
      // nobody watches, and invite a second one.
      const now = store.get(task.id);
      const hungUp = now?.errorCode === 'cancelled';
      if (now?.providerCallId && CallEngine.isActive(now)) {
        if (hungUp) {
          try {
            await provider.stopCall?.(now);
          } catch (stopError) {
            // The engine asks again while it waits for the call to end.
            request.log.error({ err: stopError }, 'provider stopCall failed for a call hung up while it was placed');
          }
          engine.finishCancelled(task.id);
        } else if (now.status === 'queued') {
          // It is the call that was asked for: follow it.
          store.update(task.id, { status: 'dialing' });
        }
        return reply.code(201).send(store.get(task.id) ?? now);
      }
      // Already over: a short call — busy, a mailbox, a quick answer — can
      // end while the request for it is still waiting. What came of it has
      // been recorded; it is not this failure's to overwrite.
      if (now?.providerCallId) return reply.code(201).send(now);
      const updated = store.update(task.id, {
        status: 'failed',
        // Hung up before there was a call: that, not the phone service, is
        // why there is none.
        errorCode: hungUp ? 'cancelled' : 'provider_error',
        error: hungUp ? 'Ended by the user' : describeError(error),
      });
      return reply.code(502).send(updated);
    }
  }

  function listTasks(request: FastifyRequest) {
    // Somebody is looking: a good moment to ask the phone company whether it
    // answered a call this server has not heard about. Not waited for — the
    // call shows up in the next list.
    engine.lookForAnsweredCallsSoon();
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
        : (profile.callLanguage ?? (profile.language === 'de' ? 'tr' : 'de'));
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
      const line = progressLine(task);
      if (line) announce(line);
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

    /** Why a delivery was turned away, or null if it may come in. */
    function refusal(request: FastifyRequest, token: string | undefined): string | null {
      const tokenOk = token !== undefined && safeEqual(token, webhookSecret);
      if (config.provider === 'retell' && config.retell?.verifySignature) {
        // Retell signs every delivery with the API key. A secret in the
        // address, when present, must match as well.
        if (token !== undefined && !tokenOk) return 'the secret in its address is not this server’s';
        const signed =
          request.rawBody != null &&
          verifyRetellSignature(
            request.rawBody,
            config.retell.webhookKey,
            request.headers['x-retell-signature'],
          );
        return signed
          ? null
          : 'its signature does not match the Retell key in .env. Retell signs with the key marked for webhooks ' +
              '(dashboard → Settings → API Keys): use that one as RETELL_API_KEY, or put it in RETELL_WEBHOOK_KEY';
      }
      // No signature to check (the simulator, or checking switched off): the
      // secret in the address is the only thing standing in the way.
      return tokenOk ? null : 'the secret in its address is not this server’s';
    }

    // Said once a minute at most: a refused delivery means live transcripts
    // and answered calls are not arriving, and the owner has to be able to
    // see why — but a stranger knocking must not fill the window.
    let lastRefusalNote = 0;
    function noteRefusal(reason: string): void {
      const now = Date.now();
      if (now - lastRefusalNote < 60_000) return;
      lastRefusalNote = now;
      announce(`A message from the phone service was refused: ${reason}.`);
    }

    async function receive(
      request: FastifyRequest<{ Params: { token?: string }; Body: RetellWebhookBody }>,
      reply: FastifyReply,
    ) {
      const refused = refusal(request, request.params.token);
      if (refused) {
        noteRefusal(refused);
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
      const owner = store.inboundOwner();
      if (!retell?.canAnswerCalls || !owner?.answerCalls) return;
      if (!owner.answerCallsReal) {
        // Switched on while calls were only simulated: the owner was never
        // asked whether real callers may go to the phone service. So it goes
        // off, and switching it on again in the app asks.
        store.saveProfile({ ...owner, answerCalls: false, answerCallsReal: false });
        await retell.setInboundAnswering(false).catch(() => {});
        announce(
          'Answering calls was switched on while calls were simulated. To have real calls answered, switch "Answer my calls" on again in the app.',
        );
        return;
      }
      // First of all, whatever was answered while this server was not running.
      void engine.importAnsweredCalls();
      await retell.setInboundAnswering(true, {
        eventsUrl: engine.webhookUrl(),
        defaults: buildInboundVariables(owner),
      });
    },
  };
}

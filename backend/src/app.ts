import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from 'fastify';
import { randomUUID } from 'node:crypto';
import type { Config } from './config.js';
import { TaskStore } from './db.js';
import { MockProvider } from './providers/mock.js';
import {
  RetellProvider,
  isDialFailure,
  type RetellWebhookBody,
} from './providers/retell.js';
import { fallbackSummary, summarizeCall } from './summarizer.js';
import {
  isDocumentKind,
  offlineDocumentResult,
  processDocumentTask,
  scheduleResult,
} from './documents.js';
import {
  TASK_KINDS,
  TERMINAL_STATUSES,
  type CallProvider,
  type Language,
  type SecretaryTask,
  type TaskKind,
} from './types.js';

const E164_PATTERN = '^\\+[1-9][0-9]{6,14}$';

function secondsSince(isoTimestamp: string): number {
  const started = Date.parse(isoTimestamp);
  if (Number.isNaN(started)) return 0;
  return Math.max(0, Math.round((Date.now() - started) / 1000));
}

const CREATE_TASK_SCHEMA = {
  body: {
    type: 'object',
    required: ['goal'],
    additionalProperties: false,
    properties: {
      kind: { type: 'string', enum: TASK_KINDS },
      goal: { type: 'string', minLength: 4, maxLength: 2000 },
      phoneNumber: { type: 'string', pattern: E164_PATTERN },
      language: { type: 'string', enum: ['de', 'en', 'tr'] },
      summaryLanguage: { type: 'string', enum: ['de', 'en', 'tr'] },
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

export interface AppOptions {
  /** Overrides the provider chosen from config (used by tests). */
  provider?: CallProvider;
  mockDelays?: { dialingMs: number; inProgressMs: number; completedMs: number };
  /** How long a document task simulates working before it resolves. */
  documentDelayMs?: number;
}

export interface App {
  fastify: FastifyInstance;
  store: TaskStore;
}

export function buildApp(config: Config, options: AppOptions = {}): App {
  const fastify = Fastify({ logger: process.env.NODE_ENV !== 'test' });
  const store = new TaskStore(config.dbPath);
  const documentDelayMs = options.documentDelayMs ?? 1_500;
  const pendingDocumentTimers = new Set<NodeJS.Timeout>();

  /**
   * Central place where task-state changes land, whether they come from the
   * mock provider's timers or from the Retell webhook.
   */
  function applyUpdate(taskId: string, patch: Partial<SecretaryTask>): void {
    const current = store.get(taskId);
    if (!current) return;
    // Never let a late/out-of-order event downgrade a finished task.
    const isTerminal = TERMINAL_STATUSES.includes(current.status);
    if (isTerminal && patch.status && patch.status !== current.status) return;

    // A finished call records how long it ran, for the report's meta grid.
    const ended = patch.status === 'completed' || patch.status === 'failed';
    const effective =
      current.kind === 'call' && ended && current.durationSeconds == null
        ? { ...patch, durationSeconds: secondsSince(current.createdAt) }
        : patch;

    const updated = store.update(taskId, effective);
    if (!updated) return;
    if (effective.status === 'completed' && updated.kind === 'call' && updated.transcript) {
      void finalizeCall(updated.id);
    }
  }

  /** Produces the user-facing report once a transcript is available. */
  async function finalizeCall(taskId: string): Promise<void> {
    const task = store.get(taskId);
    if (!task || !task.transcript || task.summary) return;

    if (config.anthropicApiKey) {
      const report = await summarizeCall(config.anthropicApiKey, task, task.transcript);
      if (report) {
        store.update(taskId, { summary: report.summary, outcome: report.outcome });
        return;
      }
    }
    store.update(taskId, {
      summary: fallbackSummary(task.summaryLanguage),
      outcome: task.outcome ?? 'unknown',
    });
  }

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
      const scheduled = scheduleResult(task);
      applyUpdate(taskId, scheduled);
      return;
    }

    const result = config.anthropicApiKey
      ? await processDocumentTask(config.anthropicApiKey, task)
      : null;
    applyUpdate(taskId, result ?? offlineDocumentResult(task));
  }

  function scheduleDocumentTask(taskId: string): void {
    const timer = setTimeout(() => {
      pendingDocumentTimers.delete(timer);
      void runDocumentTask(taskId);
    }, documentDelayMs);
    timer.unref();
    pendingDocumentTimers.add(timer);
  }

  const provider: CallProvider =
    options.provider ??
    (config.provider === 'retell' && config.retell
      ? new RetellProvider(config.retell)
      : new MockProvider(applyUpdate, options.mockDelays));

  function requireDeviceId(headers: Record<string, unknown>): string | null {
    const value = headers['x-device-id'];
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > 100) return null;
    return trimmed;
  }

  fastify.get('/health', async () => ({ ok: true, provider: provider.name }));

  /**
   * Creates any kind of task. Calls go straight to the voice provider;
   * everything else is queued for the document worker.
   */
  async function createTask(
    request: FastifyRequest<{ Body: CreateTaskBody }>,
    reply: FastifyReply,
    defaultKind: TaskKind,
  ) {
    const deviceId = requireDeviceId(request.headers);
    if (!deviceId) {
      return reply.code(400).send({ error: 'Missing or invalid X-Device-Id header' });
    }

    const body = request.body;
    const kind = body.kind ?? defaultKind;

    if (kind === 'call') {
      if (!body.phoneNumber) {
        return reply.code(400).send({ error: 'A phone call needs a phoneNumber' });
      }
      const allowed = config.allowedCountryPrefixes.some((p) =>
        body.phoneNumber!.startsWith(p),
      );
      if (!allowed) {
        return reply.code(400).send({
          error: `Destination not allowed. Allowed country prefixes: ${config.allowedCountryPrefixes.join(', ')}`,
        });
      }
    }

    const now = new Date().toISOString();
    const task: SecretaryTask = {
      id: randomUUID(),
      deviceId,
      kind,
      goal: body.goal.trim(),
      phoneNumber: kind === 'call' ? (body.phoneNumber ?? null) : null,
      language: body.language ?? 'de',
      summaryLanguage: body.summaryLanguage ?? 'en',
      userName: body.userName?.trim() || null,
      status: kind === 'reminder' ? 'scheduled' : 'queued',
      providerCallId: null,
      documentText: body.documentText?.trim() || null,
      transcript: null,
      summary: null,
      result: null,
      todo: kind === 'reminder' ? body.goal.trim() : null,
      todoWhen: body.todoWhen?.trim() || null,
      outcome: null,
      durationSeconds: null,
      error: null,
      createdAt: now,
      updatedAt: now,
    };
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
      const updated = store.update(task.id, { providerCallId });
      return reply.code(201).send(updated);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      request.log.error({ err: error }, 'provider startCall failed');
      const updated = store.update(task.id, { status: 'failed', error: message });
      return reply.code(502).send(updated);
    }
  }

  function listTasks(request: FastifyRequest, reply: FastifyReply) {
    const deviceId = requireDeviceId(request.headers);
    if (!deviceId) {
      return reply.code(400).send({ error: 'Missing or invalid X-Device-Id header' });
    }
    return store.listByDevice(deviceId);
  }

  function getTask(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) {
    const deviceId = requireDeviceId(request.headers);
    if (!deviceId) {
      return reply.code(400).send({ error: 'Missing or invalid X-Device-Id header' });
    }
    const task = store.get(request.params.id);
    if (!task || task.deviceId !== deviceId) {
      return reply.code(404).send({ error: 'Not found' });
    }
    return task;
  }

  fastify.post<{ Body: CreateTaskBody }>(
    '/api/tasks',
    { schema: CREATE_TASK_SCHEMA },
    async (request, reply) => createTask(request, reply, 'call'),
  );
  fastify.get('/api/tasks', async (request, reply) => listTasks(request, reply));
  fastify.get<{ Params: { id: string } }>('/api/tasks/:id', async (request, reply) =>
    getTask(request, reply),
  );

  // The call-only routes the first version of the app shipped with.
  fastify.post<{ Body: CreateTaskBody }>(
    '/api/calls',
    { schema: CREATE_CALL_SCHEMA },
    async (request, reply) => createTask(request, reply, 'call'),
  );
  fastify.get('/api/calls', async (request, reply) => listTasks(request, reply));
  fastify.get<{ Params: { id: string } }>('/api/calls/:id', async (request, reply) =>
    getTask(request, reply),
  );

  fastify.post<{ Params: { token: string }; Body: RetellWebhookBody }>(
    '/webhooks/retell/:token',
    async (request, reply) => {
      if (request.params.token !== config.webhookSecret) {
        return reply.code(401).send({ error: 'Invalid webhook token' });
      }

      const { event, call } = request.body ?? {};
      if (!call?.call_id) {
        return reply.code(200).send({ ok: true, ignored: true });
      }

      const task =
        (call.metadata?.task_id ? store.get(call.metadata.task_id) : undefined) ??
        store.findByProviderCallId(call.call_id);
      if (!task) {
        request.log.warn({ callId: call.call_id }, 'webhook for unknown call');
        return reply.code(200).send({ ok: true, ignored: true });
      }

      switch (event) {
        case 'call_started':
          applyUpdate(task.id, { status: 'in_progress' });
          break;
        case 'call_ended': {
          if (isDialFailure(call.disconnection_reason)) {
            applyUpdate(task.id, {
              status: 'failed',
              error: `Call not connected (${call.disconnection_reason})`,
              outcome: 'no_answer',
            });
          } else {
            applyUpdate(task.id, {
              status: 'completed',
              transcript: call.transcript ?? task.transcript,
            });
          }
          break;
        }
        case 'call_analyzed': {
          // Keep Retell's own summary only if Claude hasn't produced one yet.
          const fresh = store.get(task.id);
          if (fresh && !fresh.summary && call.call_analysis?.call_summary) {
            store.update(task.id, {
              summary: call.call_analysis.call_summary,
              outcome: call.call_analysis.call_successful ? 'achieved' : 'unknown',
            });
          }
          break;
        }
        default:
          break;
      }
      return { ok: true };
    },
  );

  fastify.addHook('onClose', async () => {
    if (provider instanceof MockProvider) provider.stop();
    for (const timer of pendingDocumentTimers) clearTimeout(timer);
    pendingDocumentTimers.clear();
    store.close();
  });

  return { fastify, store };
}

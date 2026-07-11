import Fastify, { type FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import type { Config } from './config.js';
import { CallStore } from './db.js';
import { MockProvider } from './providers/mock.js';
import {
  RetellProvider,
  isDialFailure,
  type RetellWebhookBody,
} from './providers/retell.js';
import { fallbackSummary, summarizeCall } from './summarizer.js';
import type { CallProvider, CallTask, Language } from './types.js';

const E164_PATTERN = '^\\+[1-9][0-9]{6,14}$';

const CREATE_CALL_SCHEMA = {
  body: {
    type: 'object',
    required: ['goal', 'phoneNumber', 'language'],
    additionalProperties: false,
    properties: {
      goal: { type: 'string', minLength: 4, maxLength: 2000 },
      phoneNumber: { type: 'string', pattern: E164_PATTERN },
      language: { type: 'string', enum: ['de', 'en', 'tr'] },
      summaryLanguage: { type: 'string', enum: ['de', 'en', 'tr'] },
      userName: { type: 'string', maxLength: 100 },
    },
  },
} as const;

interface CreateCallBody {
  goal: string;
  phoneNumber: string;
  language: Language;
  summaryLanguage?: Language;
  userName?: string;
}

export interface AppOptions {
  /** Overrides the provider chosen from config (used by tests). */
  provider?: CallProvider;
  mockDelays?: { dialingMs: number; inProgressMs: number; completedMs: number };
}

export interface App {
  fastify: FastifyInstance;
  store: CallStore;
}

export function buildApp(config: Config, options: AppOptions = {}): App {
  const fastify = Fastify({ logger: process.env.NODE_ENV !== 'test' });
  const store = new CallStore(config.dbPath);

  /**
   * Central place where call-state changes land, whether they come from the
   * mock provider's timers or from the Retell webhook.
   */
  function applyUpdate(taskId: string, patch: Partial<CallTask>): void {
    const current = store.get(taskId);
    if (!current) return;
    // Never let a late/out-of-order event downgrade a finished call.
    const isTerminal = current.status === 'completed' || current.status === 'failed';
    if (isTerminal && patch.status && patch.status !== current.status) return;
    const updated = store.update(taskId, patch);
    if (!updated) return;
    if (patch.status === 'completed' && updated.transcript) {
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

  fastify.post<{ Body: CreateCallBody }>(
    '/api/calls',
    { schema: CREATE_CALL_SCHEMA },
    async (request, reply) => {
      const deviceId = requireDeviceId(request.headers);
      if (!deviceId) {
        return reply.code(400).send({ error: 'Missing or invalid X-Device-Id header' });
      }

      const body = request.body;
      const allowed = config.allowedCountryPrefixes.some((p) =>
        body.phoneNumber.startsWith(p),
      );
      if (!allowed) {
        return reply.code(400).send({
          error: `Destination not allowed. Allowed country prefixes: ${config.allowedCountryPrefixes.join(', ')}`,
        });
      }

      const now = new Date().toISOString();
      const task: CallTask = {
        id: randomUUID(),
        deviceId,
        goal: body.goal.trim(),
        phoneNumber: body.phoneNumber,
        language: body.language,
        summaryLanguage: body.summaryLanguage ?? 'en',
        userName: body.userName?.trim() || null,
        status: 'queued',
        providerCallId: null,
        transcript: null,
        summary: null,
        outcome: null,
        error: null,
        createdAt: now,
        updatedAt: now,
      };
      store.create(task);

      try {
        const { providerCallId } = await provider.startCall(task);
        const updated = store.update(task.id, { providerCallId });
        return reply.code(201).send(updated);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        request.log.error({ err: error }, 'provider startCall failed');
        const updated = store.update(task.id, {
          status: 'failed',
          error: message,
        });
        return reply.code(502).send(updated);
      }
    },
  );

  fastify.get('/api/calls', async (request, reply) => {
    const deviceId = requireDeviceId(request.headers);
    if (!deviceId) {
      return reply.code(400).send({ error: 'Missing or invalid X-Device-Id header' });
    }
    return store.listByDevice(deviceId);
  });

  fastify.get<{ Params: { id: string } }>('/api/calls/:id', async (request, reply) => {
    const deviceId = requireDeviceId(request.headers);
    if (!deviceId) {
      return reply.code(400).send({ error: 'Missing or invalid X-Device-Id header' });
    }
    const task = store.get(request.params.id);
    if (!task || task.deviceId !== deviceId) {
      return reply.code(404).send({ error: 'Not found' });
    }
    return task;
  });

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
    store.close();
  });

  return { fastify, store };
}

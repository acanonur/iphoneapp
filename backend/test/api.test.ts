import { afterEach, describe, expect, it } from 'vitest';
import { buildApp, type App } from '../src/app.js';
import type { Config } from '../src/config.js';

const testConfig: Config = {
  port: 0,
  host: '127.0.0.1',
  dbPath: ':memory:',
  provider: 'mock',
  webhookSecret: 'testsecret',
  allowedCountryPrefixes: ['+49', '+90', '+44', '+1'],
  retell: null,
  anthropicApiKey: null,
};

const DEVICE = { 'x-device-id': 'device-abc' };

let app: App | null = null;

function makeApp(): App {
  app = buildApp(testConfig, {
    mockDelays: { dialingMs: 10, inProgressMs: 20, completedMs: 40 },
  });
  return app;
}

afterEach(async () => {
  if (app) {
    await app.fastify.close();
    app = null;
  }
});

const validBody = {
  goal: 'Book a doctor appointment for next Tuesday morning',
  phoneNumber: '+493012345678',
  language: 'de',
  summaryLanguage: 'tr',
  userName: 'Ali',
};

describe('POST /api/calls', () => {
  it('creates a call task and starts the mock call', async () => {
    const { fastify } = makeApp();
    const res = await fastify.inject({
      method: 'POST',
      url: '/api/calls',
      headers: DEVICE,
      payload: validBody,
    });
    expect(res.statusCode).toBe(201);
    const task = res.json();
    expect(task.status).toBe('queued');
    expect(task.providerCallId).toMatch(/^mock_/);
    expect(task.language).toBe('de');
    expect(task.summaryLanguage).toBe('tr');
  });

  it('runs the full mock lifecycle to completed with a report', async () => {
    const { fastify } = makeApp();
    const res = await fastify.inject({
      method: 'POST',
      url: '/api/calls',
      headers: DEVICE,
      payload: validBody,
    });
    const { id } = res.json();

    await new Promise((r) => setTimeout(r, 150));

    const detail = await fastify.inject({
      method: 'GET',
      url: `/api/calls/${id}`,
      headers: DEVICE,
    });
    const task = detail.json();
    expect(task.status).toBe('completed');
    expect(task.transcript).toContain('KI-Assistent');
    // No Anthropic key in tests -> Turkish fallback summary
    expect(task.summary).toContain('Arama tamamlandı');
  });

  it('rejects a request without a device id', async () => {
    const { fastify } = makeApp();
    const res = await fastify.inject({
      method: 'POST',
      url: '/api/calls',
      payload: validBody,
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects an invalid phone number', async () => {
    const { fastify } = makeApp();
    const res = await fastify.inject({
      method: 'POST',
      url: '/api/calls',
      headers: DEVICE,
      payload: { ...validBody, phoneNumber: '030 1234' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects destinations outside the allowlist', async () => {
    const { fastify } = makeApp();
    const res = await fastify.inject({
      method: 'POST',
      url: '/api/calls',
      headers: DEVICE,
      payload: { ...validBody, phoneNumber: '+33123456789' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain('not allowed');
  });
});

describe('GET /api/calls', () => {
  it('lists only the calling device tasks', async () => {
    const { fastify } = makeApp();
    await fastify.inject({
      method: 'POST',
      url: '/api/calls',
      headers: DEVICE,
      payload: validBody,
    });

    const mine = await fastify.inject({ method: 'GET', url: '/api/calls', headers: DEVICE });
    expect(mine.json()).toHaveLength(1);

    const theirs = await fastify.inject({
      method: 'GET',
      url: '/api/calls',
      headers: { 'x-device-id': 'other-device' },
    });
    expect(theirs.json()).toHaveLength(0);

    const detailForOther = await fastify.inject({
      method: 'GET',
      url: `/api/calls/${mine.json()[0].id}`,
      headers: { 'x-device-id': 'other-device' },
    });
    expect(detailForOther.statusCode).toBe(404);
  });
});

/** Provider that never emits lifecycle events, standing in for Retell. */
function makeAppWithInertProvider(): App {
  let n = 0;
  app = buildApp(testConfig, {
    provider: {
      name: 'inert',
      startCall: async () => ({ providerCallId: `retell_call_${++n}` }),
    },
  });
  return app;
}

describe('POST /webhooks/retell/:token', () => {
  it('rejects a bad token', async () => {
    const { fastify } = makeApp();
    const res = await fastify.inject({
      method: 'POST',
      url: '/webhooks/retell/wrong',
      payload: { event: 'call_started', call: { call_id: 'c1' } },
    });
    expect(res.statusCode).toBe(401);
  });

  it('applies call_ended transcript to the matching task', async () => {
    const built = makeAppWithInertProvider();
    const res = await built.fastify.inject({
      method: 'POST',
      url: '/api/calls',
      headers: DEVICE,
      payload: validBody,
    });
    const { id } = res.json();

    const hook = await built.fastify.inject({
      method: 'POST',
      url: '/webhooks/retell/testsecret',
      payload: {
        event: 'call_ended',
        call: {
          call_id: 'retell_call_1',
          transcript: 'Agent: Hallo. Praxis: Termin am Dienstag 10:30.',
          metadata: { task_id: id },
        },
      },
    });
    expect(hook.statusCode).toBe(200);

    // finalizeCall runs async; give it a tick.
    await new Promise((r) => setTimeout(r, 20));
    const task = built.store.get(id);
    expect(task?.status).toBe('completed');
    expect(task?.transcript).toContain('Dienstag 10:30');
    expect(task?.summary).toBeTruthy();
  });

  it('marks dial failures as failed', async () => {
    const built = makeAppWithInertProvider();
    const res = await built.fastify.inject({
      method: 'POST',
      url: '/api/calls',
      headers: DEVICE,
      payload: validBody,
    });
    const { id } = res.json();

    await built.fastify.inject({
      method: 'POST',
      url: '/webhooks/retell/testsecret',
      payload: {
        event: 'call_ended',
        call: {
          call_id: 'retell_call_2',
          disconnection_reason: 'dial_no_answer',
          metadata: { task_id: id },
        },
      },
    });

    const task = built.store.get(id);
    expect(task?.status).toBe('failed');
    expect(task?.outcome).toBe('no_answer');
  });
});

import { afterEach, describe, expect, it } from 'vitest';
import { buildApp, type App } from '../src/app.js';
import { DEVICE, pause, testConfig, until } from './helpers.js';

let app: App | null = null;

function makeApp(env: NodeJS.ProcessEnv = {}): App {
  app = buildApp(testConfig(env));
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

async function startCall(built: App, body: Record<string, unknown> = validBody) {
  return built.fastify.inject({ method: 'POST', url: '/api/calls', headers: DEVICE, payload: body });
}

describe('GET /health', () => {
  it('says what kind of server this is without needing a key', async () => {
    const { fastify } = makeApp();
    const health = (await fastify.inject({ method: 'GET', url: '/health' })).json();
    expect(health).toMatchObject({
      ok: true,
      service: 'yaver',
      version: 2,
      provider: 'mock',
      simulated: true,
      auth: 'none',
      reports: 'basic',
    });
  });

  it('serves a page a phone browser can open to prove it reaches the server', async () => {
    const { fastify } = makeApp();
    const landing = await fastify.inject({ method: 'GET', url: '/' });
    expect(landing.statusCode).toBe(200);
    expect(landing.headers['content-type']).toContain('text/html');
    const pair = await fastify.inject({ method: 'GET', url: '/pair' });
    expect(pair.body).toContain('yaver://pair');
  });
});

describe('what the server tells the person watching its window', () => {
  it('says in plain sentences that a phone connected and how a call went', async () => {
    const lines: string[] = [];
    app = buildApp(testConfig(), { announce: (line) => lines.push(line) });
    const { fastify, store } = app;

    await fastify.inject({ method: 'GET', url: '/api/session', headers: DEVICE });
    await fastify.inject({ method: 'GET', url: '/api/session', headers: DEVICE });
    expect(lines.filter((line) => line.includes('iPhone connected'))).toHaveLength(1);

    const created = (await startCall(app)).json();
    await until(() => store.get(created.id)?.status === 'completed');
    expect(lines).toContain('Calling +493012345678 (simulated)');
    expect(lines).toContain('+493012345678 picked up (simulated)');
    expect(lines.some((line) => line.startsWith('The call to +493012345678 is over'))).toBe(true);

    await fastify.inject({
      method: 'POST',
      url: '/api/tasks',
      headers: DEVICE,
      payload: { kind: 'followup', goal: 'Call the landlord back', todoWhen: 'Friday' },
    });
    await until(() => lines.includes('Follow-up: scheduled'));
  });
});

describe('POST /api/calls', () => {
  it('creates a call task and starts the simulated call', async () => {
    const built = makeApp();
    const res = await startCall(built);
    expect(res.statusCode).toBe(201);
    const task = res.json();
    expect(task.status).toBe('queued');
    expect(task.providerCallId).toMatch(/^mock_/);
    expect(task.language).toBe('de');
    expect(task.summaryLanguage).toBe('tr');
    expect(task.direction).toBe('outbound');
    expect(task.simulated).toBe(true);
    expect(task.lines).toEqual([]);
  });

  it('feeds the conversation in line by line while the call is going on', async () => {
    const built = makeApp();
    const { id } = (await startCall(built)).json();

    const early = await until(() => {
      const task = built.store.get(id);
      return task && task.lines.length >= 1 && task.lines.length < 7 ? task : null;
    });
    expect(early.status).toBe('in_progress');
    expect(early.transcript).toBeTruthy();

    const done = await until(() => {
      const task = built.store.get(id);
      return task?.status === 'completed' ? task : null;
    });
    expect(done.lines.length).toBeGreaterThan(early.lines.length);
    // The disclosure is the first thing the AI says.
    const firstByAssistant = done.lines.find((line) => line.role === 'assistant');
    expect(firstByAssistant?.text).toContain('KI-Assistent');
    expect(firstByAssistant?.text).toContain('Ali');
  });

  it('ends a simulated call with a report in the reader’s language', async () => {
    const built = makeApp();
    const { id } = (await startCall(built)).json();
    const task = await until(() => {
      const current = built.store.get(id);
      return current?.status === 'completed' && current.summary ? current : null;
    });
    expect(task.transcript).toContain('KI-Assistent');
    expect(task.summary).toContain('Simüle arama');
    expect(task.summarySource).toBe('script');
    expect(task.outcome).toBe('achieved');
    expect(task.todo).toBeTruthy();
    expect(task.durationSeconds).toBeGreaterThanOrEqual(0);
    expect(task.durationSeconds).toBeLessThan(60);
  });

  it('rejects a request without a device id', async () => {
    const { fastify } = makeApp();
    const res = await fastify.inject({ method: 'POST', url: '/api/calls', payload: validBody });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('device_required');
  });

  it('rejects an invalid phone number', async () => {
    const built = makeApp();
    const res = await startCall(built, { ...validBody, phoneNumber: '030 1234' });
    expect(res.statusCode).toBe(400);
    // In the shape the app reads, not the framework's own.
    expect(res.json().code).toBe('invalid_request');
    expect(res.json().error).toContain('phoneNumber');
  });

  it('answers a body it cannot read in the same shape', async () => {
    const { fastify } = makeApp();
    const res = await fastify.inject({
      method: 'POST',
      url: '/api/tasks',
      headers: { 'x-device-id': 'device-a', 'content-type': 'application/json' },
      payload: '{"goal": "Book a table",',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('invalid_request');
    expect(typeof res.json().error).toBe('string');
  });

  it('rejects destinations outside the allowlist', async () => {
    const built = makeApp();
    const res = await startCall(built, { ...validBody, phoneNumber: '+33123456789' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain('not allowed');
    expect(res.json().code).toBe('destination_not_allowed');
  });
});

describe('POST /api/tasks/:id/cancel', () => {
  it('hangs up a call that is under way and keeps what was said', async () => {
    const built = makeApp();
    const { id } = (await startCall(built)).json();
    await until(() => (built.store.get(id)?.lines.length ?? 0) >= 3);

    const res = await built.fastify.inject({
      method: 'POST',
      url: `/api/tasks/${id}/cancel`,
      headers: DEVICE,
    });
    expect(res.statusCode).toBe(200);
    const cancelled = res.json();
    expect(cancelled.errorCode).toBe('cancelled');
    expect(['completed', 'failed']).toContain(cancelled.status);

    const linesAtCancel = cancelled.lines.length;
    await pause(120);
    const later = built.store.get(id);
    expect(later?.lines.length).toBe(linesAtCancel);
    expect(later?.errorCode).toBe('cancelled');
  });

  it('fails a call that is hung up before anyone answered', async () => {
    const built = makeApp({ MOCK_PACE: '5' });
    const { id } = (await startCall(built)).json();
    const res = await built.fastify.inject({
      method: 'POST',
      url: `/api/tasks/${id}/cancel`,
      headers: DEVICE,
    });
    expect(res.json()).toMatchObject({ status: 'failed', errorCode: 'cancelled' });
  });

  it('does not let another device end the call', async () => {
    const built = makeApp();
    const { id } = (await startCall(built)).json();
    const res = await built.fastify.inject({
      method: 'POST',
      url: `/api/tasks/${id}/cancel`,
      headers: { 'x-device-id': 'other-device' },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('GET /api/calls', () => {
  it('lists only the calling device tasks', async () => {
    const built = makeApp();
    await startCall(built);

    const mine = await built.fastify.inject({ method: 'GET', url: '/api/calls', headers: DEVICE });
    expect(mine.json()).toHaveLength(1);

    const theirs = await built.fastify.inject({
      method: 'GET',
      url: '/api/calls',
      headers: { 'x-device-id': 'other-device' },
    });
    expect(theirs.json()).toHaveLength(0);

    const detailForOther = await built.fastify.inject({
      method: 'GET',
      url: `/api/calls/${mine.json()[0].id}`,
      headers: { 'x-device-id': 'other-device' },
    });
    expect(detailForOther.statusCode).toBe(404);
  });
});

describe('profile and session', () => {
  it('keeps the owner’s name and language', async () => {
    const { fastify } = makeApp();
    const saved = await fastify.inject({
      method: 'PUT',
      url: '/api/profile',
      headers: DEVICE,
      payload: { name: '  Ali Yılmaz ', language: 'tr', answerCalls: true },
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json()).toMatchObject({ name: 'Ali Yılmaz', language: 'tr', answerCalls: true });

    const session = (
      await fastify.inject({ method: 'GET', url: '/api/session', headers: DEVICE })
    ).json();
    expect(session.profile.name).toBe('Ali Yılmaz');
    expect(session.simulated).toBe(true);
    expect(session.canAnswerCalls).toBe(true);
    expect(session.allowedCountryPrefixes).toContain('+49');
    expect(Array.isArray(session.addresses)).toBe(true);
  });

  it('changes only the fields it is given', async () => {
    const { fastify } = makeApp();
    await fastify.inject({
      method: 'PUT',
      url: '/api/profile',
      headers: DEVICE,
      payload: { name: 'Ali', language: 'tr' },
    });
    const next = await fastify.inject({
      method: 'PUT',
      url: '/api/profile',
      headers: DEVICE,
      payload: { answerNote: 'I am at work until six.' },
    });
    expect(next.json()).toMatchObject({
      name: 'Ali',
      language: 'tr',
      answerNote: 'I am at work until six.',
    });
  });
});

describe('POST /api/dev/incoming', () => {
  it('plays a call the secretary answers and writes down who rang and why', async () => {
    const built = makeApp();
    await built.fastify.inject({
      method: 'PUT',
      url: '/api/profile',
      headers: DEVICE,
      payload: { name: 'Ali', language: 'tr' },
    });
    const res = await built.fastify.inject({
      method: 'POST',
      url: '/api/dev/incoming',
      headers: DEVICE,
      payload: { language: 'de' },
    });
    expect(res.statusCode).toBe(201);
    const created = res.json();
    expect(created).toMatchObject({
      direction: 'inbound',
      status: 'in_progress',
      simulated: true,
      language: 'de',
      summaryLanguage: 'tr',
    });

    const task = await until(() => {
      const current = built.store.get(created.id);
      return current?.status === 'completed' ? current : null;
    });
    // The AI answers and says at once that it is an AI answering for Ali.
    expect(task.lines[0]).toMatchObject({ role: 'assistant' });
    expect(task.lines[0]?.text).toContain('KI-Assistent von Ali');
    expect(task.lines.some((line) => line.role === 'other')).toBe(true);
    expect(task.transcript).toContain('Anrufer:');
    // The subject and the report are written in the owner's language.
    expect(task.goal).toContain('Dr. Weber');
    expect(task.summary).toContain('Simüle arama');
    expect(task.todo).toContain('030 1234567');
  });

  it('lists the answered call with the device’s other tasks', async () => {
    const built = makeApp();
    await built.fastify.inject({ method: 'POST', url: '/api/dev/incoming', headers: DEVICE });
    const list = (
      await built.fastify.inject({ method: 'GET', url: '/api/tasks', headers: DEVICE })
    ).json();
    expect(list).toHaveLength(1);
    expect(list[0].direction).toBe('inbound');
  });
});

describe('after a restart', () => {
  it('closes a simulated call that lost its script', async () => {
    const { mkdtempSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const dir = mkdtempSync(join(tmpdir(), 'yaver-test-'));
    try {
      const first = buildApp(testConfig({ DB_PATH: join(dir, 'a.db'), MOCK_PACE: '5' }));
      const { id } = (await startCall(first)).json();
      await first.fastify.close();

      const second = makeApp({ DB_PATH: join(dir, 'a.db') });
      const task = second.store.get(id);
      expect(task).toMatchObject({ status: 'failed', errorCode: 'technical' });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

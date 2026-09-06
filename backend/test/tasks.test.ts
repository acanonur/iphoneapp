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
    documentDelayMs: 10,
  });
  return app;
}

afterEach(async () => {
  if (app) {
    await app.fastify.close();
    app = null;
  }
});

async function createTask(body: Record<string, unknown>) {
  const { fastify } = app ?? makeApp();
  const res = await fastify.inject({
    method: 'POST',
    url: '/api/tasks',
    headers: DEVICE,
    payload: body,
  });
  return res;
}

/** Waits for the document worker's timer plus its (offline) resolution. */
const settle = () => new Promise((r) => setTimeout(r, 80));

describe('POST /api/tasks — document kinds', () => {
  it('accepts a letter without a phone number and resolves it as completed', async () => {
    makeApp();
    const res = await createTask({
      kind: 'letter',
      goal: 'Translate the letter from the Finanzamt and tell me what it asks for.',
      documentText: 'Sehr geehrte Damen und Herren, bitte reichen Sie …',
      summaryLanguage: 'tr',
    });
    expect(res.statusCode).toBe(201);
    const created = res.json();
    expect(created.kind).toBe('letter');
    expect(created.status).toBe('queued');
    expect(created.phoneNumber).toBeNull();

    await settle();
    const task = app!.store.get(created.id);
    expect(task?.status).toBe('completed');
    // No Anthropic key in tests -> the offline result, in the report language.
    expect(task?.summary).toContain('Mektup');
  });

  it('leaves a drafted message waiting for approval', async () => {
    makeApp();
    const res = await createTask({
      kind: 'message',
      goal: 'Write an email to the landlord about the broken heating in the bathroom.',
    });
    await settle();
    const task = app!.store.get(res.json().id);
    expect(task?.status).toBe('draft');
    expect(task?.summary).toBeTruthy();
  });

  it('marks a form as needing the user details', async () => {
    makeApp();
    const res = await createTask({
      kind: 'form',
      goal: 'Fill in the Anmeldung form for the new flat.',
    });
    await settle();
    expect(app!.store.get(res.json().id)?.status).toBe('needs_input');
  });

  it('schedules a follow-up and keeps its goal as the thing still to do', async () => {
    makeApp();
    const res = await createTask({
      kind: 'followup',
      goal: 'Chase the Bürgeramt if they have not replied by Friday.',
      todoWhen: 'Fri · 14:30',
    });
    await settle();
    const task = app!.store.get(res.json().id);
    expect(task?.status).toBe('scheduled');
    expect(task?.todo).toContain('Bürgeramt');
    expect(task?.todoWhen).toBe('Fri · 14:30');
  });

  it('stores a reminder as already scheduled, with no work to do', async () => {
    makeApp();
    const res = await createTask({
      kind: 'reminder',
      goal: 'Bring passport and confirmation letter to the Bürgeramt.',
      todoWhen: 'Fri · 14:30',
    });
    expect(res.statusCode).toBe(201);
    const created = res.json();
    expect(created.status).toBe('scheduled');
    expect(created.todo).toContain('passport');
  });
});

describe('POST /api/tasks — calls', () => {
  it('still places a call and runs it to completion', async () => {
    makeApp();
    const res = await createTask({
      kind: 'call',
      goal: 'Book a doctor appointment for next Tuesday morning',
      phoneNumber: '+493012345678',
      language: 'de',
      summaryLanguage: 'tr',
      userName: 'Ali',
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().providerCallId).toMatch(/^mock_/);

    await new Promise((r) => setTimeout(r, 150));
    const task = app!.store.get(res.json().id);
    expect(task?.status).toBe('completed');
    expect(task?.transcript).toContain('KI-Assistent');
    // The report shows how long the call ran.
    expect(task?.durationSeconds).toBeGreaterThanOrEqual(0);
    expect(task?.durationSeconds).toBeLessThan(60);
  });

  it('leaves a document task without a duration', async () => {
    makeApp();
    const res = await createTask({ kind: 'letter', goal: 'Read this letter for me' });
    await settle();
    expect(app!.store.get(res.json().id)?.durationSeconds).toBeNull();
  });

  it('refuses a call with no destination', async () => {
    makeApp();
    const res = await createTask({ kind: 'call', goal: 'Call the dentist please' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain('phoneNumber');
  });

  it('refuses a destination outside the allowlist', async () => {
    makeApp();
    const res = await createTask({
      kind: 'call',
      goal: 'Call the dentist please',
      phoneNumber: '+33123456789',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain('not allowed');
  });

  it('defaults to a call when no kind is given', async () => {
    makeApp();
    const res = await createTask({
      goal: 'Book a table for two on Saturday',
      phoneNumber: '+493098765432',
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().kind).toBe('call');
  });
});

describe('GET /api/tasks', () => {
  it('lists every kind for the calling device only', async () => {
    makeApp();
    await createTask({ kind: 'letter', goal: 'Read this letter from the tax office' });
    await createTask({ kind: 'reminder', goal: 'Bring the passport' });

    const mine = await app!.fastify.inject({
      method: 'GET',
      url: '/api/tasks',
      headers: DEVICE,
    });
    expect(mine.json()).toHaveLength(2);
    expect(mine.json().map((t: { kind: string }) => t.kind).sort()).toEqual([
      'letter',
      'reminder',
    ]);

    const theirs = await app!.fastify.inject({
      method: 'GET',
      url: '/api/tasks',
      headers: { 'x-device-id': 'other-device' },
    });
    expect(theirs.json()).toHaveLength(0);

    const detail = await app!.fastify.inject({
      method: 'GET',
      url: `/api/tasks/${mine.json()[0].id}`,
      headers: { 'x-device-id': 'other-device' },
    });
    expect(detail.statusCode).toBe(404);
  });

  it('is also reachable through the original /api/calls routes', async () => {
    makeApp();
    await createTask({ kind: 'letter', goal: 'Read this letter from the tax office' });
    const res = await app!.fastify.inject({
      method: 'GET',
      url: '/api/calls',
      headers: DEVICE,
    });
    expect(res.json()).toHaveLength(1);
  });
});

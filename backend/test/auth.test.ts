import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp, type App } from '../src/app.js';
import { keyRequired } from '../src/config.js';
import { DEVICE, testConfig } from './helpers.js';

const apps: App[] = [];
let directory: string | null = null;

function makeApp(env: NodeJS.ProcessEnv = {}): App {
  const app = buildApp(testConfig(env));
  apps.push(app);
  return app;
}

afterEach(async () => {
  for (const app of apps.splice(0)) await app.fastify.close();
  if (directory) rmSync(directory, { recursive: true, force: true });
  directory = null;
});

describe('when the access key is needed', () => {
  it('stays open while everything is simulated and free', () => {
    expect(keyRequired(testConfig())).toBe(false);
  });

  it('is required as soon as something real or paid for is switched on', () => {
    expect(keyRequired(testConfig({ ANTHROPIC_API_KEY: 'sk-ant-test' }))).toBe(true);
    expect(keyRequired(testConfig({ PUBLIC_BASE_URL: 'https://yaver.example.com' }))).toBe(true);
    expect(keyRequired(testConfig({ TUNNEL: 'true' }))).toBe(true);
    expect(
      keyRequired(
        testConfig({
          CALL_PROVIDER: 'retell',
          RETELL_API_KEY: 'key_x',
          RETELL_FROM_NUMBER: '+4930000000',
          RETELL_AGENT_ID: 'agent_x',
        }),
      ),
    ).toBe(true);
  });

  it('can be forced on or off', () => {
    expect(keyRequired(testConfig({ REQUIRE_KEY: 'always' }))).toBe(true);
    expect(keyRequired(testConfig({ REQUIRE_KEY: 'never', ANTHROPIC_API_KEY: 'sk-ant-test' }))).toBe(false);
  });
});

describe('the access key', () => {
  it('guards every /api route but leaves /health open', async () => {
    const app = makeApp({ REQUIRE_KEY: 'always' });
    const { fastify } = app;
    expect(app.accessKey).toBeTruthy();

    const health = await fastify.inject({ method: 'GET', url: '/health' });
    expect(health.statusCode).toBe(200);
    expect(health.json().auth).toBe('key');

    const none = await fastify.inject({ method: 'GET', url: '/api/tasks', headers: DEVICE });
    expect(none.statusCode).toBe(401);
    expect(none.json().code).toBe('key_required');

    const wrong = await fastify.inject({
      method: 'GET',
      url: '/api/tasks',
      headers: { ...DEVICE, authorization: 'Bearer not-the-key' },
    });
    expect(wrong.statusCode).toBe(401);
    expect(wrong.json().code).toBe('key_invalid');

    const right = await fastify.inject({
      method: 'GET',
      url: '/api/tasks',
      headers: { ...DEVICE, authorization: `Bearer ${app.accessKey}` },
    });
    expect(right.statusCode).toBe(200);
  });

  it('proves it holds the key without revealing it', async () => {
    const { createHmac } = await import('node:crypto');
    const app = makeApp({ REQUIRE_KEY: 'always', API_KEY: 'the-real-key' });
    const challenge = 'a-random-challenge-0123456789';
    const health = (
      await app.fastify.inject({ method: 'GET', url: `/health?challenge=${challenge}` })
    ).json();
    expect(health.proof).toBe(
      createHmac('sha256', 'the-real-key').update(challenge).digest('hex'),
    );
    expect(JSON.stringify(health)).not.toContain('the-real-key');

    // No challenge, or a trivially short one: no proof.
    const plain = (await app.fastify.inject({ method: 'GET', url: '/health' })).json();
    expect(plain.proof).toBeUndefined();
    const short = (await app.fastify.inject({ method: 'GET', url: '/health?challenge=abc' })).json();
    expect(short.proof).toBeUndefined();
  });

  it('offers no proof when it has no key', async () => {
    const app = makeApp();
    const health = (
      await app.fastify.inject({ method: 'GET', url: '/health?challenge=a-random-challenge-0123456789' })
    ).json();
    expect(health.auth).toBe('none');
    expect(health.proof).toBeUndefined();
  });

  it('uses the key from the environment when one is given', () => {
    const app = makeApp({ REQUIRE_KEY: 'always', API_KEY: 'chosen-by-the-owner' });
    expect(app.accessKey).toBe('chosen-by-the-owner');
  });

  it('is made up once and survives a restart', async () => {
    directory = mkdtempSync(join(tmpdir(), 'yaver-auth-'));
    const env = { REQUIRE_KEY: 'always', DB_PATH: join(directory, 'k.db') };
    const first = buildApp(testConfig(env));
    const key = first.accessKey;
    const secret = first.webhookSecret;
    await first.fastify.close();

    const second = makeApp(env);
    expect(key).toMatch(/^[A-Za-z0-9_-]{20,}$/);
    expect(second.accessKey).toBe(key);
    expect(second.webhookSecret).toBe(secret);
  });

  it('is not needed, and not created, on an open server', () => {
    expect(makeApp().accessKey).toBeNull();
  });
});

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp, type App } from '../src/app.js';
import { loadConfig } from '../src/config.js';

/**
 * The realtime socket, exercised over a real TCP connection.
 *
 * `app.inject()` cannot perform a WebSocket upgrade, so nothing else in this
 * suite touches the handshake — which is how `/api/ws` came to be registered
 * ahead of the @fastify/websocket plugin and answer 500 to every client while
 * all 88 other tests stayed green. This test listens for real and connects for
 * real, so that regression cannot come back unnoticed.
 */
describe('realtime socket', () => {
  let app: App;
  let port: number;

  beforeEach(async () => {
    app = buildApp(loadConfig({ DB_PATH: ':memory:', NODE_ENV: 'test' } as never));
    await app.fastify.listen({ port: 0, host: '127.0.0.1' });
    port = (app.fastify.server.address() as { port: number }).port;
  });

  afterEach(async () => {
    await app.fastify.close();
  });

  async function tokenForNewSpace(): Promise<string> {
    const created = await app.fastify.inject({
      method: 'POST',
      url: '/api/spaces',
      payload: { spaceName: 'Ev', userName: 'Can' },
    });
    expect(created.statusCode).toBe(201);
    return created.json().token as string;
  }

  /** Collects frames until `predicate` matches, or gives up. */
  function connect(
    query: string,
    predicate: (message: Record<string, unknown>) => boolean,
  ): Promise<Record<string, unknown> | string> {
    return new Promise((resolve) => {
      const socket = new WebSocket(`ws://127.0.0.1:${port}/api/ws?${query}`);
      const timer = setTimeout(() => {
        socket.close();
        resolve('timed out');
      }, 5000);

      socket.addEventListener('message', (event) => {
        const message = JSON.parse(String(event.data)) as Record<string, unknown>;
        if (!predicate(message)) return;
        clearTimeout(timer);
        socket.close();
        resolve(message);
      });
      socket.addEventListener('error', () => {
        clearTimeout(timer);
        resolve('handshake failed');
      });
    });
  }

  it('completes the handshake and greets an authenticated client', async () => {
    const token = await tokenForNewSpace();
    const hello = await connect(`token=${encodeURIComponent(token)}`, (m) => m.type === 'hello');

    expect(hello).toMatchObject({ type: 'hello' });
    expect(typeof (hello as { rev: unknown }).rev).toBe('number');
    expect(typeof (hello as { userId: unknown }).userId).toBe('string');
  });

  it('refuses a client with no usable token', async () => {
    const refusal = await connect('token=not-a-real-token', (m) => m.type === 'error');
    expect(refusal).toMatchObject({ type: 'error', error: 'unauthorized' });
  });

  it('answers a ping with the current revision', async () => {
    const token = await tokenForNewSpace();
    const pong = await new Promise<Record<string, unknown> | string>((resolve) => {
      const socket = new WebSocket(
        `ws://127.0.0.1:${port}/api/ws?token=${encodeURIComponent(token)}`,
      );
      const timer = setTimeout(() => {
        socket.close();
        resolve('timed out');
      }, 5000);

      socket.addEventListener('message', (event) => {
        const message = JSON.parse(String(event.data)) as Record<string, unknown>;
        if (message.type === 'hello') {
          socket.send(JSON.stringify({ type: 'ping' }));
          return;
        }
        if (message.type !== 'pong') return;
        clearTimeout(timer);
        socket.close();
        resolve(message);
      });
      socket.addEventListener('error', () => {
        clearTimeout(timer);
        resolve('handshake failed');
      });
    });

    expect(pong).toMatchObject({ type: 'pong' });
  });
});

/**
 * Bodyless requests that still announce a JSON content-type.
 *
 * Every DELETE the mobile client makes used to send `content-type:
 * application/json` with no bytes, which Fastify's default parser rejects with
 * "Body cannot be empty" — a 400 on removing an import, a calendar mirror, or
 * published availability. The client stopped sending the header, and the server
 * stopped minding.
 */
describe('empty json bodies', () => {
  let app: App;

  beforeEach(() => {
    app = buildApp(loadConfig({ DB_PATH: ':memory:', NODE_ENV: 'test' } as never));
  });

  afterEach(async () => {
    await app.fastify.close();
  });

  async function token(): Promise<string> {
    const created = await app.fastify.inject({
      method: 'POST',
      url: '/api/spaces',
      payload: { spaceName: 'Ev', userName: 'Can' },
    });
    return created.json().token as string;
  }

  it('accepts a DELETE that declares json and sends nothing', async () => {
    const auth = { authorization: `Bearer ${await token()}` };

    const declared = await app.fastify.inject({
      method: 'DELETE',
      url: '/api/availability/mine',
      headers: { ...auth, 'content-type': 'application/json' },
    });
    expect(declared.statusCode).toBe(200);

    const bare = await app.fastify.inject({
      method: 'DELETE',
      url: '/api/availability/mine',
      headers: auth,
    });
    expect(bare.statusCode).toBe(200);
  });

  it('still rejects a body that is not valid json', async () => {
    const broken = await app.fastify.inject({
      method: 'POST',
      url: '/api/spaces',
      headers: { 'content-type': 'application/json' },
      payload: '{"spaceName": "Ev"',
    });
    expect(broken.statusCode).toBe(400);
  });
})

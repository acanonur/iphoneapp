import { loadConfig, type Config } from '../src/config.js';

export const DEVICE = { 'x-device-id': 'device-abc' };

/** A config for tests: in-memory database, nothing announced, a very fast simulator. */
export function testConfig(env: NodeJS.ProcessEnv = {}): Config {
  return loadConfig({
    DB_PATH: ':memory:',
    HOST: '127.0.0.1',
    PORT: '0',
    ADVERTISE: 'false',
    MOCK_PACE: '0.003',
    ...env,
  });
}

/** Waits until `check` returns something truthy, or fails after `timeoutMs`. */
export async function until<T>(
  check: () => T | undefined | null | false,
  timeoutMs = 3_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = check();
    if (value) return value;
    if (Date.now() > deadline) throw new Error('Timed out waiting for a condition');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

export const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface RecordedRequest {
  method: string;
  url: string;
  headers: Headers;
  body: any;
}

/**
 * A stand-in for the network: records every request the Retell client makes
 * and answers from `respond`.
 */
export function fakeFetch(
  respond: (request: RecordedRequest) => { status?: number; body?: unknown } | undefined,
): { fetch: typeof fetch; requests: RecordedRequest[] } {
  const requests: RecordedRequest[] = [];
  const fetchImpl = async (...args: Parameters<typeof fetch>): Promise<Response> => {
    const [input, init] = args;
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const rawBody = typeof init?.body === 'string' ? init.body : undefined;
    const request: RecordedRequest = {
      method: (init?.method ?? 'GET').toUpperCase(),
      url,
      headers: new Headers(init?.headers),
      body: rawBody ? JSON.parse(rawBody) : undefined,
    };
    requests.push(request);
    const answer = respond(request) ?? {};
    const status = answer.status ?? 200;
    return new Response(status === 204 ? null : JSON.stringify(answer.body ?? {}), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  };
  return { fetch: fetchImpl as typeof fetch, requests };
}

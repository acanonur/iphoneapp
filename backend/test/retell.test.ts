import { afterEach, describe, expect, it } from 'vitest';
import { buildApp, type App } from '../src/app.js';
import {
  classifyEnding,
  linesFromCall,
  callDurationSeconds,
  type RetellCall,
} from '../src/providers/retell.js';
import { signRetellPayload } from '../src/retell-signature.js';
import {
  DEVICE,
  fakeFetch,
  pause,
  testConfig,
  until,
  type FakeAnswer,
  type RecordedRequest,
} from './helpers.js';

const API_KEY = 'key_retell_test';
const RETELL_ENV = {
  CALL_PROVIDER: 'retell',
  RETELL_API_KEY: API_KEY,
  RETELL_FROM_NUMBER: '+493000000000',
  RETELL_AGENT_ID: 'agent_default',
  RETELL_AGENT_ID_TR: 'agent_turkish',
};

let app: App | null = null;

afterEach(async () => {
  if (app) {
    await app.fastify.close();
    app = null;
  }
});

/** A Retell-mode server whose calls to Retell are answered by `respond`. */
function retellApp(
  env: NodeJS.ProcessEnv = {},
  respond: (request: RecordedRequest) => FakeAnswer | Promise<FakeAnswer> = () => undefined,
) {
  let created = 0;
  const said: string[] = [];
  const net = fakeFetch(async (request) => {
    const custom = await respond(request);
    if (custom) return custom;
    if (request.url.endsWith('/v2/create-phone-call')) {
      created += 1;
      return { status: 201, body: { call_id: `call_${created}`, call_status: 'registered' } };
    }
    // The answering agent as "npm run retell:setup" makes it.
    if (request.url.includes('/get-agent/')) {
      return {
        body: { agent_id: 'agent_inbound', response_engine: { type: 'retell-llm', llm_id: 'llm_inbound' } },
      };
    }
    if (request.url.endsWith('/v3/list-calls')) return { body: { has_more: false, items: [] } };
    return { body: {} };
  });
  app = buildApp(testConfig({ ...RETELL_ENV, ...env }), {
    retellFetch: net.fetch,
    analysisDelaysMs: [10, 20],
    announce: (line) => said.push(line),
  });
  return { app, requests: net.requests, said };
}

function authed(built: App) {
  return { ...DEVICE, authorization: `Bearer ${built.accessKey}` };
}

const callBody = {
  goal: 'Book a doctor appointment for next Tuesday morning',
  phoneNumber: '+493012345678',
  language: 'de',
  summaryLanguage: 'tr',
  userName: 'Ali',
};

async function placeCall(built: App, body: Record<string, unknown> = callBody) {
  return built.fastify.inject({
    method: 'POST',
    url: '/api/tasks',
    headers: authed(built),
    payload: body,
  });
}

/** Delivers a webhook the way Retell does: signed over the exact bytes. */
async function deliver(built: App, payload: unknown, options: { sign?: boolean; path?: string } = {}) {
  const raw = JSON.stringify(payload);
  return built.fastify.inject({
    method: 'POST',
    url: options.path ?? '/webhooks/retell',
    headers: {
      'content-type': 'application/json',
      ...(options.sign === false ? {} : { 'x-retell-signature': signRetellPayload(raw, API_KEY) }),
    },
    payload: raw,
  });
}

const conversation = [
  { role: 'user', content: 'Praxis am Park, guten Tag.' },
  { role: 'agent', content: 'Guten Tag! Hier spricht ein KI-Assistent, der im Auftrag von Ali anruft.' },
  { role: 'user', content: 'Dienstag um 10:30 Uhr wäre frei.' },
  { role: 'agent', content: 'Dienstag 10:30 Uhr passt. Vielen Dank!' },
];

describe('placing a call through Retell', () => {
  it('sends the call with its language, opening sentence and live transcript switched on', async () => {
    const { app: built, requests } = retellApp({ PUBLIC_BASE_URL: 'https://yaver.example.com/' });
    const res = await placeCall(built);
    expect(res.statusCode).toBe(201);
    const task = res.json();
    expect(task.providerCallId).toBe('call_1');
    // Retell has the call and is dialling.
    expect(task.status).toBe('dialing');
    expect(task.simulated).toBe(false);

    const request = requests.find((r) => r.url.endsWith('/v2/create-phone-call'))!;
    expect(request.method).toBe('POST');
    expect(request.url).toBe('https://api.retellai.com/v2/create-phone-call');
    expect(request.headers.get('authorization')).toBe(`Bearer ${API_KEY}`);
    expect(request.body).toMatchObject({
      from_number: '+493000000000',
      to_number: '+493012345678',
      override_agent_id: 'agent_default',
      idempotency_key: task.id,
      metadata: { task_id: task.id },
      retell_llm_dynamic_variables: {
        goal: callBody.goal,
        user_name: 'Ali',
        language_name: 'German',
      },
    });
    const agent = request.body.agent_override.agent;
    expect(agent.language).toBe('de-DE');
    expect(agent.webhook_events).toEqual([
      'call_started',
      'call_ended',
      'call_analyzed',
      'transcript_updated',
    ]);
    expect(agent.webhook_url).toBe(`https://yaver.example.com/webhooks/retell/${built.webhookSecret}`);
    expect(agent.max_call_duration_ms).toBe(10 * 60_000);
    expect(agent.voicemail_option).toEqual({ action: { type: 'hangup' } });
    // The AI disclosure is spoken by the platform, word for word, first.
    expect(request.body.agent_override.retell_llm).toEqual({
      start_speaker: 'agent',
      begin_message: 'Guten Tag! Hier spricht ein KI-Assistent, der im Auftrag von Ali anruft.',
    });
  });

  it('uses the per-language agent and locale when there is one', async () => {
    const { app: built, requests } = retellApp();
    await placeCall(built, { ...callBody, language: 'tr', phoneNumber: '+905301234567' });
    const body = requests[0]!.body;
    expect(body.override_agent_id).toBe('agent_turkish');
    expect(body.agent_override.agent.language).toBe('tr-TR');
    // No public address: Retell is not given a webhook it could never reach.
    expect(body.agent_override.agent.webhook_url).toBeUndefined();
  });

  it('falls back to the agent’s own settings when Retell rejects the per-call ones', async () => {
    let attempts = 0;
    const { app: built, requests } = retellApp({}, (request) => {
      if (!request.url.endsWith('/v2/create-phone-call')) return undefined;
      attempts += 1;
      return attempts === 1
        ? { status: 400, body: { message: 'agent_override.retell_llm is not applicable' } }
        : { status: 201, body: { call_id: 'call_plain', call_status: 'registered' } };
    });
    const res = await placeCall(built);
    expect(res.statusCode).toBe(201);
    expect(res.json().providerCallId).toBe('call_plain');
    const creates = requests.filter((r) => r.url.endsWith('/v2/create-phone-call'));
    expect(creates).toHaveLength(2);
    expect(creates[0]!.body.agent_override).toBeDefined();
    expect(creates[1]!.body.agent_override).toBeUndefined();
    expect(creates[1]!.body.override_agent_id).toBe('agent_default');
  });

  it('can be told not to send per-call settings at all', async () => {
    const { app: built, requests } = retellApp({ RETELL_SEND_OVERRIDES: 'false' });
    await placeCall(built);
    expect(requests[0]!.body.agent_override).toBeUndefined();
  });

  it('reports a call Retell refuses to place as failed, with the reason', async () => {
    const { app: built } = retellApp({ RETELL_SEND_OVERRIDES: 'false' }, (request) =>
      request.url.endsWith('/v2/create-phone-call')
        ? { status: 402, body: { message: 'Insufficient balance' } }
        : undefined,
    );
    const res = await placeCall(built);
    expect(res.statusCode).toBe(502);
    expect(res.json()).toMatchObject({ status: 'failed', errorCode: 'provider_error' });
    expect(res.json().error).toContain('402');
  });

  it('stops placing calls once the daily limit is reached', async () => {
    const { app: built } = retellApp({ MAX_CALLS_PER_DAY: '2' });
    expect((await placeCall(built)).statusCode).toBe(201);
    expect((await placeCall(built)).statusCode).toBe(201);
    const third = await placeCall(built);
    expect(third.statusCode).toBe(429);
    expect(third.json().code).toBe('limit_reached');
  });

  it('hangs up through Retell, and keeps the conversation the phone service hands over afterwards', async () => {
    // No public address: nothing has been heard of the call yet when the user
    // hangs up. The whole conversation arrives with the provider's record.
    let ended = false;
    const { app: built, requests } = retellApp({}, (request) => {
      if (request.url.endsWith('/v2/stop-call/call_1')) {
        ended = true;
        return { body: {} };
      }
      if (request.url.endsWith('/v2/get-call/call_1')) {
        return {
          body: ended
            ? {
                call_id: 'call_1',
                call_status: 'ended',
                disconnection_reason: 'user_hangup',
                duration_ms: 42_000,
                transcript_object: conversation,
              }
            : { call_id: 'call_1', call_status: 'ongoing' },
        };
      }
      return undefined;
    });
    const { id } = (await placeCall(built)).json();

    const res = await built.fastify.inject({
      method: 'POST',
      url: `/api/tasks/${id}/cancel`,
      headers: authed(built),
    });
    expect(res.statusCode).toBe(200);
    const stop = requests.find((r) => r.url.endsWith('/v2/stop-call/call_1'));
    expect(stop?.method).toBe('POST');
    // Asked to end, not yet closed: closing it now would lose what was said.
    expect(res.json().errorCode).toBe('cancelled');
    expect(['queued', 'dialing', 'in_progress']).toContain(res.json().status);

    await built.engine.refreshFromProvider(id);
    const task = built.store.get(id);
    expect(task).toMatchObject({ status: 'completed', errorCode: 'cancelled', durationSeconds: 42 });
    expect(task?.lines).toHaveLength(4);
    expect(task?.transcript).toContain('Dienstag um 10:30 Uhr');
  });

  it('ends a call that was hung up while it was still being placed', async () => {
    // Retell takes a moment to accept a call. Hanging up in that moment used
    // to close the task and let the call go ahead, unwatched.
    let accept: () => void = () => {};
    const accepted = new Promise<void>((resolve) => (accept = resolve));
    const { app: built, requests } = retellApp({}, async (request) => {
      if (request.url.endsWith('/v2/create-phone-call')) {
        await accepted;
        return { status: 201, body: { call_id: 'call_slow', call_status: 'registered' } };
      }
      if (request.url.includes('/v2/get-call/')) {
        return { body: { call_id: 'call_slow', call_status: 'ended', disconnection_reason: 'registered_call_timeout' } };
      }
      return undefined;
    });

    const placing = placeCall(built);
    const task = await until(() => built.store.listByDevice(DEVICE['x-device-id'])[0]);
    expect(task.providerCallId).toBeNull();

    const hangUp = await built.fastify.inject({
      method: 'POST',
      url: `/api/tasks/${task.id}/cancel`,
      headers: authed(built),
    });
    // Nothing to end yet — and the task is not closed behind the call's back.
    expect(hangUp.json()).toMatchObject({ status: 'queued', errorCode: 'cancelled' });
    expect(requests.some((r) => r.url.includes('/v2/stop-call/'))).toBe(false);

    accept();
    const placed = await placing;
    expect(placed.statusCode).toBe(201);
    // The call exists now: it is ended at once.
    expect(requests.some((r) => r.url.includes('/v2/stop-call/call_slow'))).toBe(true);

    const ended = await until(() => {
      const current = built.store.get(task.id);
      return current?.status === 'failed' ? current : null;
    }, 5_000);
    expect(ended).toMatchObject({ errorCode: 'cancelled', providerCallId: 'call_slow' });
  });

  it('follows a call that exists although the request for it failed', async () => {
    // Retell placed the call and said so in an event — but its answer to the
    // request itself was lost. The call is the one that was asked for.
    let answer: () => void = () => {};
    const answered = new Promise<void>((resolve) => (answer = resolve));
    const { app: built, requests } = retellApp({ RETELL_SEND_OVERRIDES: 'false' }, async (request) => {
      if (request.url.endsWith('/v2/create-phone-call')) {
        await answered;
        return { status: 500, body: { message: 'timeout' } };
      }
      return undefined;
    });
    const placing = placeCall(built);
    const task = await until(() => built.store.listByDevice(DEVICE['x-device-id'])[0]);
    await deliver(built, {
      event: 'call_started',
      call: { call_id: 'call_A', call_status: 'ongoing', metadata: { task_id: task.id } },
    });
    answer();
    const placed = await placing;
    // Not "failed": that would leave it running unwatched, and invite a second call.
    expect(placed.statusCode).toBe(201);
    expect(placed.json()).toMatchObject({ status: 'in_progress', providerCallId: 'call_A', errorCode: null });
    expect(requests.some((r) => r.url.includes('/v2/stop-call/'))).toBe(false);

    // ... and it is followed to its end like any other.
    await deliver(built, {
      event: 'call_ended',
      call: { call_id: 'call_A', metadata: { task_id: task.id }, disconnection_reason: 'user_hangup', transcript_object: conversation },
    });
    expect(built.store.get(task.id)).toMatchObject({ status: 'completed' });
  });

  it('keeps the result of a call that was over before the request for it failed', async () => {
    let answer: () => void = () => {};
    const answered = new Promise<void>((resolve) => (answer = resolve));
    const { app: built } = retellApp({ RETELL_SEND_OVERRIDES: 'false' }, async (request) => {
      if (request.url.endsWith('/v2/create-phone-call')) {
        await answered;
        return { status: 500, body: { message: 'timeout' } };
      }
      return undefined;
    });
    const placing = placeCall(built);
    const task = await until(() => built.store.listByDevice(DEVICE['x-device-id'])[0]);
    // A short call: over before Retell's answer to the request arrives.
    await deliver(built, {
      event: 'call_ended',
      call: {
        call_id: 'call_A',
        metadata: { task_id: task.id },
        disconnection_reason: 'user_hangup',
        duration_ms: 31_000,
        transcript_object: conversation,
      },
    });
    expect(built.store.get(task.id)).toMatchObject({ status: 'completed' });

    answer();
    const placed = await placing;
    // The call took place, and what was agreed in it stands.
    expect(placed.statusCode).toBe(201);
    expect(built.store.get(task.id)).toMatchObject({
      status: 'completed',
      providerCallId: 'call_A',
      errorCode: null,
      durationSeconds: 31,
    });
    expect(built.store.get(task.id)?.lines).toHaveLength(conversation.length);
  });

  it('ends such a call when the owner had already hung up', async () => {
    let answer: () => void = () => {};
    const answered = new Promise<void>((resolve) => (answer = resolve));
    const { app: built, requests } = retellApp({ RETELL_SEND_OVERRIDES: 'false' }, async (request) => {
      if (request.url.endsWith('/v2/create-phone-call')) {
        await answered;
        return { status: 500, body: { message: 'timeout' } };
      }
      if (request.url.includes('/v2/get-call/')) {
        return { body: { call_id: 'call_A', call_status: 'ended', disconnection_reason: 'agent_hangup' } };
      }
      return undefined;
    });
    const placing = placeCall(built);
    const task = await until(() => built.store.listByDevice(DEVICE['x-device-id'])[0]);
    // Hung up before anything is known about a call ...
    await built.fastify.inject({ method: 'POST', url: `/api/tasks/${task.id}/cancel`, headers: authed(built) });
    // ... which then turns out to exist ...
    await deliver(built, {
      event: 'call_started',
      call: { call_id: 'call_A', call_status: 'ongoing', metadata: { task_id: task.id } },
    });
    // ... while the request for it fails.
    answer();
    await placing;
    expect(requests.some((r) => r.url.includes('/v2/stop-call/call_A'))).toBe(true);
    const ended = await until(() => {
      const current = built.store.get(task.id);
      return current?.status === 'failed' ? current : null;
    }, 5_000);
    // The owner ended it: that is what the task says, not "the phone service failed".
    expect(ended).toMatchObject({ errorCode: 'cancelled' });
  });

  it('says "ended by you", not "failed", when a call was hung up and then could not be placed', async () => {
    let answer: () => void = () => {};
    const answered = new Promise<void>((resolve) => (answer = resolve));
    const { app: built } = retellApp({ RETELL_SEND_OVERRIDES: 'false' }, async (request) => {
      if (request.url.endsWith('/v2/create-phone-call')) {
        await answered;
        return { status: 402, body: { message: 'Insufficient balance' } };
      }
      return undefined;
    });
    const placing = placeCall(built);
    const task = await until(() => built.store.listByDevice(DEVICE['x-device-id'])[0]);
    await built.fastify.inject({ method: 'POST', url: `/api/tasks/${task.id}/cancel`, headers: authed(built) });
    answer();
    const placed = await placing;
    expect(placed.statusCode).toBe(502);
    expect(placed.json()).toMatchObject({ status: 'failed', errorCode: 'cancelled', providerCallId: null });
  });

  it('closes a hung-up call that nobody picked up as cancelled, not as "no answer"', async () => {
    const { app: built } = retellApp({}, (request) =>
      request.url.endsWith('/v2/get-call/call_1')
        ? { body: { call_id: 'call_1', call_status: 'ended', disconnection_reason: 'dial_no_answer' } }
        : undefined,
    );
    const { id } = (await placeCall(built)).json();
    await built.fastify.inject({ method: 'POST', url: `/api/tasks/${id}/cancel`, headers: authed(built) });
    await built.engine.refreshFromProvider(id);
    expect(built.store.get(id)).toMatchObject({ status: 'failed', errorCode: 'cancelled' });
  });
});

describe('webhooks from Retell', () => {
  it('refuses a delivery that is not signed with the API key', async () => {
    const { app: built } = retellApp();
    const { id } = (await placeCall(built)).json();
    const event = { event: 'call_started', call: { call_id: 'call_1', metadata: { task_id: id } } };

    expect((await deliver(built, event, { sign: false })).statusCode).toBe(401);
    // The secret in the address alone is not enough when signatures are checked.
    const withToken = await deliver(built, event, {
      sign: false,
      path: `/webhooks/retell/${built.webhookSecret}`,
    });
    expect(withToken.statusCode).toBe(401);
    expect(built.store.get(id)?.status).toBe('dialing');

    const tampered = await built.fastify.inject({
      method: 'POST',
      url: '/webhooks/retell',
      headers: {
        'content-type': 'application/json',
        'x-retell-signature': signRetellPayload(JSON.stringify(event), API_KEY),
      },
      payload: JSON.stringify({ ...event, event: 'call_ended' }),
    });
    expect(tampered.statusCode).toBe(401);

    // Signed, but sent to an address with the wrong secret in it.
    expect((await deliver(built, event, { path: '/webhooks/retell/wrong' })).statusCode).toBe(401);
  });

  it('follows a call from pick-up to report', async () => {
    const { app: built, requests } = retellApp();
    const { id } = (await placeCall(built)).json();
    const meta = { call_id: 'call_1', metadata: { task_id: id }, direction: 'outbound' };

    expect((await deliver(built, { event: 'call_started', call: meta })).statusCode).toBe(200);
    expect(built.store.get(id)?.status).toBe('in_progress');

    // The transcript arrives while people are still talking.
    await deliver(built, {
      event: 'transcript_updated',
      call: { ...meta, transcript_object: conversation.slice(0, 2) },
    });
    let task = built.store.get(id)!;
    expect(task.status).toBe('in_progress');
    expect(task.lines).toEqual([
      { role: 'other', text: 'Praxis am Park, guten Tag.' },
      { role: 'assistant', text: conversation[1]!.content },
    ]);
    expect(task.transcript).toContain('Gesprächspartner: Praxis am Park');

    // An older, shorter snapshot arriving late must not shrink it.
    await deliver(built, {
      event: 'transcript_updated',
      call: { ...meta, transcript_object: conversation.slice(0, 1) },
    });
    expect(built.store.get(id)?.lines).toHaveLength(2);

    await deliver(built, {
      event: 'call_ended',
      call: {
        ...meta,
        call_status: 'ended',
        disconnection_reason: 'agent_hangup',
        duration_ms: 185_000,
        transcript_object: conversation,
      },
    });
    task = await until(() => {
      const current = built.store.get(id);
      return current?.summary ? current : null;
    });
    expect(task.status).toBe('completed');
    expect(task.lines).toHaveLength(4);
    // Talk time as Retell measured it, not time since the task was created.
    expect(task.durationSeconds).toBe(185);
    // No Claude key in tests: a plain statement that there is no report yet.
    expect(task.summarySource).toBe('placeholder');
    expect(task.summary).toContain('Arama tamamlandı');

    // Retell's own summary then replaces the placeholder.
    await deliver(built, {
      event: 'call_analyzed',
      call: {
        ...meta,
        call_status: 'ended',
        disconnection_reason: 'agent_hangup',
        transcript_object: conversation,
        call_analysis: { call_summary: 'Appointment booked for Tuesday 10:30.', call_successful: true },
      },
    });
    task = built.store.get(id)!;
    expect(task.summary).toBe('Appointment booked for Tuesday 10:30.');
    expect(task.summarySource).toBe('provider');
    expect(task.outcome).toBe('achieved');

    // The call — recording included — is then removed at Retell.
    await until(() => requests.some((r) => r.method === 'DELETE'));
    expect(requests.find((r) => r.method === 'DELETE')?.url).toBe(
      'https://api.retellai.com/v2/delete-call/call_1',
    );
  });

  it('keeps Retell’s summary when it arrives before the end of the call is processed', async () => {
    const { app: built } = retellApp();
    const { id } = (await placeCall(built)).json();
    await deliver(built, {
      event: 'call_analyzed',
      call: {
        call_id: 'call_1',
        metadata: { task_id: id },
        call_status: 'ended',
        disconnection_reason: 'user_hangup',
        transcript_object: conversation,
        call_analysis: { call_summary: 'They agreed on Tuesday.', call_successful: true },
      },
    });
    await pause(30);
    const task = built.store.get(id)!;
    expect(task.status).toBe('completed');
    expect(task.summary).toBe('They agreed on Tuesday.');
    expect(task.summarySource).toBe('provider');
  });

  it('reads the call object under "data" as well as under "call"', async () => {
    const { app: built } = retellApp();
    const { id } = (await placeCall(built)).json();
    await deliver(built, { event: 'call_started', data: { call_id: 'call_1', metadata: { task_id: id } } });
    expect(built.store.get(id)?.status).toBe('in_progress');
  });

  it('accepts a flat transcript when there is no structured one', async () => {
    const { app: built } = retellApp();
    const { id } = (await placeCall(built)).json();
    await deliver(built, {
      event: 'call_ended',
      call: {
        call_id: 'call_1',
        metadata: { task_id: id },
        disconnection_reason: 'user_hangup',
        transcript: 'Agent: Guten Tag!\nUser: Termin am Dienstag um 10:30 Uhr.',
      },
    });
    const task = built.store.get(id)!;
    expect(task.status).toBe('completed');
    expect(task.lines).toEqual([
      { role: 'assistant', text: 'Guten Tag!' },
      { role: 'other', text: 'Termin am Dienstag um 10:30 Uhr.' },
    ]);
  });

  it('ignores an event that names one of our tasks but another call', async () => {
    const { app: built } = retellApp();
    const { id } = (await placeCall(built)).json();
    const res = await deliver(built, {
      event: 'call_ended',
      call: { call_id: 'someone_elses_call', metadata: { task_id: id }, disconnection_reason: 'user_hangup', transcript_object: conversation },
    });
    expect(res.json()).toEqual({ ok: true, ignored: true });
    expect(built.store.get(id)?.status).toBe('dialing');
  });

  it('ends a call that turns up although its task was given up on', async () => {
    // Retell did not confirm the call, so the owner was told it failed —
    // and would try again. But the call was placed after all.
    const { app: built, requests } = retellApp({ RETELL_SEND_OVERRIDES: 'false' }, (request) =>
      request.url.endsWith('/v2/create-phone-call')
        ? { status: 402, body: { message: 'Insufficient balance' } }
        : undefined,
    );
    const failed = (await placeCall(built)).json();
    expect(failed).toMatchObject({ status: 'failed', providerCallId: null });

    await deliver(built, {
      event: 'call_started',
      call: { call_id: 'call_ghost', call_status: 'ongoing', metadata: { task_id: failed.id } },
    });
    // Nobody is watching it: it is ended, once, and the task stays as the owner saw it.
    await deliver(built, {
      event: 'transcript_updated',
      call: { call_id: 'call_ghost', call_status: 'ongoing', metadata: { task_id: failed.id } },
    });
    expect(requests.filter((r) => r.url.includes('/v2/stop-call/call_ghost'))).toHaveLength(1);
    expect(built.store.get(failed.id)).toMatchObject({ status: 'failed', providerCallId: 'call_ghost' });
  });

  it('ends a second call that turns up under a task that follows another', async () => {
    const { app: built, requests } = retellApp();
    const { id } = (await placeCall(built)).json();
    const res = await deliver(built, {
      event: 'call_started',
      call: { call_id: 'call_twin', call_status: 'ongoing', metadata: { task_id: id } },
    });
    expect(res.json()).toEqual({ ok: true, ignored: true });
    expect(requests.some((r) => r.url.includes('/v2/stop-call/call_twin'))).toBe(true);
    // The call the task does follow is left alone.
    expect(requests.some((r) => r.url.includes('/v2/stop-call/call_1'))).toBe(false);
    expect(built.store.get(id)).toMatchObject({ status: 'dialing', providerCallId: 'call_1' });
  });

  it('does not let a repeated or late event reopen a finished call', async () => {
    const { app: built } = retellApp();
    const { id } = (await placeCall(built)).json();
    const meta = { call_id: 'call_1', metadata: { task_id: id } };
    await deliver(built, { event: 'call_ended', call: { ...meta, disconnection_reason: 'dial_no_answer' } });
    expect(built.store.get(id)).toMatchObject({ status: 'failed', errorCode: 'no_answer', outcome: 'no_answer' });

    await deliver(built, { event: 'call_started', call: meta });
    await deliver(built, { event: 'transcript_updated', call: { ...meta, transcript_object: conversation } });
    const task = built.store.get(id)!;
    expect(task.status).toBe('failed');
    expect(task.lines).toEqual([]);
    // A call that never connected has no duration.
    expect(task.durationSeconds).toBeNull();
  });

  it.each([
    ['dial_no_answer', 'no_answer', 'no_answer'],
    ['dial_busy', 'busy', 'no_answer'],
    ['user_declined', 'declined', 'no_answer'],
    ['invalid_destination', 'invalid_number', 'unknown'],
    ['telephony_provider_permission_denied', 'blocked', 'unknown'],
    ['credit_exhausted', 'provider_account', 'unknown'],
    ['concurrency_limit_reached', 'provider_account', 'unknown'],
    ['sip_routing_error', 'provider_error', 'unknown'],
    ['voicemail_reached', 'voicemail', 'no_answer'],
    ['error_llm_websocket_open', 'technical', 'unknown'],
  ])('files "%s" as a failed call (%s)', async (reason, errorCode, outcome) => {
    const { app: built } = retellApp();
    const { id } = (await placeCall(built)).json();
    await deliver(built, {
      event: 'call_ended',
      call: { call_id: 'call_1', metadata: { task_id: id }, disconnection_reason: reason },
    });
    expect(built.store.get(id)).toMatchObject({ status: 'failed', errorCode, outcome });
  });

  it('keeps the conversation when a technical fault cuts a call short', async () => {
    const { app: built } = retellApp();
    const { id } = (await placeCall(built)).json();
    const meta = { call_id: 'call_1', metadata: { task_id: id } };
    await deliver(built, { event: 'call_started', call: meta });
    await deliver(built, {
      event: 'call_ended',
      call: { ...meta, disconnection_reason: 'error_asr', transcript_object: conversation },
    });
    const task = built.store.get(id)!;
    expect(task.status).toBe('completed');
    expect(task.errorCode).toBe('technical');
    expect(task.lines).toHaveLength(4);
  });

  it('treats a call where only the AI spoke as not answered', async () => {
    const { app: built } = retellApp();
    const { id } = (await placeCall(built)).json();
    await deliver(built, {
      event: 'call_ended',
      call: {
        call_id: 'call_1',
        metadata: { task_id: id },
        disconnection_reason: 'inactivity',
        transcript_object: [{ role: 'agent', content: 'Guten Tag! Hier spricht ein KI-Assistent.' }],
      },
    });
    expect(built.store.get(id)).toMatchObject({ status: 'failed', errorCode: 'no_answer' });
  });

  it('accepts a large delivery', async () => {
    const { app: built } = retellApp();
    const { id } = (await placeCall(built)).json();
    const res = await deliver(built, {
      event: 'transcript_updated',
      call: {
        call_id: 'call_1',
        metadata: { task_id: id },
        transcript_object: conversation,
        transcript_with_tool_calls: 'x'.repeat(2 * 1024 * 1024),
      },
    });
    expect(res.statusCode).toBe(200);
    expect(built.store.get(id)?.lines).toHaveLength(4);
  });
});

describe('without a public address', () => {
  it('brings a call up to date from Retell’s own record of it', async () => {
    const { app: built } = retellApp();
    const { id } = (await placeCall(built)).json();
    const task = built.store.get(id)!;

    built.engine.applySnapshot(task, { call_id: 'call_1', call_status: 'ongoing', transcript_object: conversation.slice(0, 2) });
    expect(built.store.get(id)).toMatchObject({ status: 'in_progress' });
    expect(built.store.get(id)?.lines).toHaveLength(2);

    built.engine.applySnapshot(built.store.get(id)!, {
      call_id: 'call_1',
      call_status: 'ended',
      disconnection_reason: 'user_hangup',
      duration_ms: 61_000,
      transcript_object: conversation,
    });
    expect(built.store.get(id)).toMatchObject({ status: 'completed', durationSeconds: 61 });
  });

  it('says so in the session, so the app can explain the missing live transcript', async () => {
    const { app: built } = retellApp();
    const session = (
      await built.fastify.inject({ method: 'GET', url: '/api/session', headers: authed(built) })
    ).json();
    expect(session.reachable).toBe(false);
    expect(session.simulated).toBe(false);
    expect(session.canAnswerCalls).toBe(false);
  });
});

describe('answering calls for the owner', () => {
  const INBOUND = {
    RETELL_INBOUND_AGENT_ID: 'agent_inbound',
    PUBLIC_BASE_URL: 'https://yaver.example.com',
  };

  async function switchOn(built: App) {
    return built.fastify.inject({
      method: 'PUT',
      url: '/api/profile',
      headers: authed(built),
      payload: { name: 'Ali', language: 'tr', answerCalls: true, answerNote: 'Back after six.' },
    });
  }

  it('puts the answering agent on the number when switched on, and takes it off again', async () => {
    const { app: built, requests } = retellApp(INBOUND);
    expect((await switchOn(built)).statusCode).toBe(200);

    const bind = requests.find((r) => r.url.includes('/update-phone-number/'))!;
    expect(bind.method).toBe('PATCH');
    expect(decodeURIComponent(bind.url)).toContain('+493000000000');
    expect(bind.body.inbound_agents).toEqual([{ agent_id: 'agent_inbound', weight: 1 }]);
    // Nobody is asked before a call is answered: a server that is asleep must
    // not cost the caller the call.
    expect(bind.body.inbound_webhook_url).toBeNull();

    const agent = requests.find((r) => r.url.includes('/update-agent/agent_inbound'))!;
    expect(agent.body.webhook_events).toContain('transcript_updated');
    expect(agent.body.webhook_url).toBe(
      `https://yaver.example.com/webhooks/retell/${built.webhookSecret}`,
    );
    // A message has to survive a weekend with the computer off.
    expect(agent.body.data_storage_retention_days).toBe(7);

    await built.fastify.inject({
      method: 'PUT',
      url: '/api/profile',
      headers: authed(built),
      payload: { answerCalls: false },
    });
    const unbind = requests.filter((r) => r.url.includes('/update-phone-number/')).at(-1)!;
    expect(unbind.body.inbound_agents).toBeNull();
    expect(unbind.body.inbound_webhook_url).toBeNull();
  });

  it('gives the agent its greeting ahead of time, so it can answer while this server is off', async () => {
    const { app: built, requests } = retellApp(INBOUND);
    await switchOn(built);
    const told = requests.find((r) => r.url.includes('/update-retell-llm/llm_inbound'))!;
    expect(told.method).toBe('PATCH');
    expect(told.body.default_dynamic_variables).toMatchObject({
      owner_name: 'Ali',
      owner_note: 'Back after six.',
      owner_language: 'Turkish',
    });
    // The greeting says at once that an AI is answering — and is what the
    // agent opens with, word for word.
    expect(told.body.default_dynamic_variables.greeting).toContain('yapay zekâ asistanıyım');
    expect(told.body.begin_message).toBe(told.body.default_dynamic_variables.greeting);
    // The agent knows before the number rings.
    const order = requests.map((r) => r.url.split('/').slice(3, 4)[0]);
    expect(order.indexOf('update-retell-llm')).toBeLessThan(order.indexOf('update-phone-number'));
  });

  it('tells the agent again when the name, the note or a language changes', async () => {
    const { app: built, requests } = retellApp(INBOUND);
    await switchOn(built);
    const before = requests.filter((r) => r.url.includes('/update-retell-llm/')).length;

    await built.fastify.inject({
      method: 'PUT',
      url: '/api/profile',
      headers: authed(built),
      payload: { answerNote: 'On holiday until Monday.', callLanguage: 'de' },
    });
    const updates = requests.filter((r) => r.url.includes('/update-retell-llm/'));
    expect(updates).toHaveLength(before + 1);
    expect(updates.at(-1)!.body.default_dynamic_variables).toMatchObject({
      owner_note: 'On holiday until Monday.',
      greeting:
        'Guten Tag! Hier ist der KI-Assistent von Ali. Ali ist gerade nicht erreichbar. Wie kann ich Ihnen helfen?',
    });
    // The number itself was not touched again.
    expect(requests.filter((r) => r.url.includes('/update-phone-number/'))).toHaveLength(1);

    // Saving the same thing again says nothing to anyone.
    await built.fastify.inject({
      method: 'PUT',
      url: '/api/profile',
      headers: authed(built),
      payload: { answerNote: 'On holiday until Monday.' },
    });
    expect(requests.filter((r) => r.url.includes('/update-retell-llm/'))).toHaveLength(before + 1);
  });

  it('keeps the name to itself while answering is off', async () => {
    const { app: built, requests } = retellApp(INBOUND);
    const saved = await built.fastify.inject({
      method: 'PUT',
      url: '/api/profile',
      headers: authed(built),
      payload: { name: 'Ali', language: 'tr' },
    });
    expect(saved.statusCode).toBe(200);
    expect(requests).toHaveLength(0);
  });

  it('does not save a note the phone service did not take', async () => {
    let refuse = false;
    const { app: built } = retellApp(INBOUND, (request) =>
      refuse && request.url.includes('/update-retell-llm/')
        ? { status: 400, body: { message: 'no' } }
        : undefined,
    );
    await switchOn(built);
    refuse = true;
    const res = await built.fastify.inject({
      method: 'PUT',
      url: '/api/profile',
      headers: authed(built),
      payload: { answerNote: 'Call my office instead.' },
    });
    expect(res.statusCode).toBe(502);
    expect(res.json().code).toBe('provider_failed');
    const profile = (
      await built.fastify.inject({ method: 'GET', url: '/api/profile', headers: authed(built) })
    ).json();
    // What the app shows is what callers hear.
    expect(profile.answerNote).toBe('Back after six.');
  });

  it('explains what is missing instead of pretending it worked', async () => {
    const noAgent = retellApp({ PUBLIC_BASE_URL: 'https://yaver.example.com' });
    const first = await switchOn(noAgent.app);
    expect(first.statusCode).toBe(409);
    expect(first.json().code).toBe('answering_not_set_up');
    // Nothing was saved as switched on.
    const profile = (
      await noAgent.app.fastify.inject({
        method: 'GET',
        url: '/api/profile',
        headers: authed(noAgent.app),
      })
    ).json();
    expect(profile.answerCalls).toBe(false);
  });

  it('answers calls for a server nobody can reach from outside, too', async () => {
    // The usual case: a laptop at home, no public address.
    const { app: built, requests } = retellApp({ RETELL_INBOUND_AGENT_ID: 'agent_inbound' });
    const res = await switchOn(built);
    expect(res.statusCode).toBe(200);
    expect(res.json().answerCalls).toBe(true);
    const agent = requests.find((r) => r.url.includes('/update-agent/agent_inbound'))!;
    // No address to report to: the calls are fetched instead.
    expect(agent.body.webhook_url).toBeNull();
    const bind = requests.find((r) => r.url.includes('/update-phone-number/'))!;
    expect(bind.body.inbound_agents).toEqual([{ agent_id: 'agent_inbound', weight: 1 }]);
  });

  it('answers for one phone at a time: whoever switches it on takes it over', async () => {
    const { app: built } = retellApp(INBOUND);
    await switchOn(built);
    const other = { 'x-device-id': 'device-ipad', authorization: `Bearer ${built.accessKey}` };
    const taken = await built.fastify.inject({
      method: 'PUT',
      url: '/api/profile',
      headers: other,
      payload: { name: 'Ayşe', language: 'de', answerCalls: true },
    });
    expect(taken.json()).toMatchObject({ answerCalls: true, name: 'Ayşe' });

    const first = (
      await built.fastify.inject({ method: 'GET', url: '/api/profile', headers: authed(built) })
    ).json();
    expect(first.answerCalls).toBe(false);
    expect(built.store.inboundOwner()?.deviceId).toBe('device-ipad');

    // A call that comes in now is hers.
    await deliver(built, {
      event: 'call_started',
      call: { call_id: 'call_for_her', direction: 'inbound', from_number: '+4915112345678' },
    });
    expect(built.store.listByDevice('device-ipad')).toHaveLength(1);
    expect(built.store.listByDevice(DEVICE['x-device-id'])).toHaveLength(0);
  });

  it('tells Retell who it is answering for when a call comes in', async () => {
    const { app: built } = retellApp(INBOUND);
    await switchOn(built);
    const res = await deliver(built, {
      event: 'call_inbound',
      call_inbound: { agent_id: 'agent_inbound', from_number: '+4915112345678', to_number: '+493000000000' },
    });
    expect(res.statusCode).toBe(200);
    const variables = res.json().call_inbound.dynamic_variables;
    expect(variables.owner_name).toBe('Ali');
    expect(variables.owner_note).toBe('Back after six.');
    // The greeting says at once that an AI is answering.
    expect(variables.greeting).toContain('yapay zekâ asistanıyım');
  });

  it('greets callers in the language they speak, not the one the owner reads', async () => {
    const { app: built } = retellApp(INBOUND);
    await switchOn(built);
    // The owner reads Turkish and lives in Germany: callers speak German.
    const saved = await built.fastify.inject({
      method: 'PUT',
      url: '/api/profile',
      headers: authed(built),
      payload: { callLanguage: 'de' },
    });
    expect(saved.json()).toMatchObject({ language: 'tr', callLanguage: 'de', answerCalls: true });

    const res = await deliver(built, {
      event: 'call_inbound',
      call_inbound: { agent_id: 'agent_inbound', from_number: '+4915112345678', to_number: '+493000000000' },
    });
    const variables = res.json().call_inbound.dynamic_variables;
    expect(variables.greeting).toBe(
      'Guten Tag! Hier ist der KI-Assistent von Ali. Ali ist gerade nicht erreichbar. Wie kann ich Ihnen helfen?',
    );

    // The call is expected in German and reported in Turkish.
    await deliver(built, {
      event: 'call_started',
      call: { call_id: 'call_in_lang', direction: 'inbound', from_number: '+4915112345678', to_number: '+493000000000' },
    });
    const task = built.store.listByDevice(DEVICE['x-device-id'])[0];
    expect(task).toMatchObject({ direction: 'inbound', language: 'de', summaryLanguage: 'tr' });
  });

  it('records an answered call for the owner, with who rang', async () => {
    const { app: built } = retellApp(INBOUND);
    await switchOn(built);
    const meta = {
      call_id: 'call_in_1',
      direction: 'inbound',
      from_number: '+4915112345678',
      to_number: '+493000000000',
    };
    await deliver(built, { event: 'call_started', call: meta });

    const list = () => built.store.listByDevice(DEVICE['x-device-id']);
    expect(list()).toHaveLength(1);
    expect(list()[0]).toMatchObject({
      direction: 'inbound',
      status: 'in_progress',
      phoneNumber: '+4915112345678',
      summaryLanguage: 'tr',
      userName: 'Ali',
      simulated: false,
    });

    await deliver(built, {
      event: 'call_ended',
      call: {
        ...meta,
        disconnection_reason: 'user_hangup',
        duration_ms: 42_000,
        transcript_object: [
          { role: 'agent', content: 'Merhaba! Ben Ali adına telefona bakan yapay zekâ asistanıyım.' },
          { role: 'user', content: 'Guten Tag, hier ist die Praxis Dr. Weber.' },
        ],
      },
    });
    const task = await until(() => {
      const current = list()[0];
      return current?.summary ? current : null;
    });
    expect(task.status).toBe('completed');
    expect(task.durationSeconds).toBe(42);
    expect(task.transcript).toContain('Arayan: Guten Tag');
    expect(task.summary).toContain('Sizin adınıza bir arama yanıtlandı');
  });

  it('still records a caller who hung up without a word', async () => {
    const { app: built } = retellApp(INBOUND);
    await switchOn(built);
    await deliver(built, {
      event: 'call_ended',
      call: {
        call_id: 'call_in_2',
        direction: 'inbound',
        from_number: '+4915112345678',
        disconnection_reason: 'user_hangup',
        transcript_object: [{ role: 'agent', content: 'Merhaba!' }],
      },
    });
    const task = await until(() => {
      const current = built.store.listByDevice(DEVICE['x-device-id'])[0];
      return current?.summary ? current : null;
    });
    expect(task).toMatchObject({ status: 'completed', outcome: 'no_answer' });
    expect(task.summary).toContain('mesaj bırakmadan');
  });

  it('ignores an unknown outgoing call rather than inventing a task for it', async () => {
    const { app: built } = retellApp(INBOUND);
    const res = await deliver(built, {
      event: 'call_started',
      call: { call_id: 'not_ours', direction: 'outbound' },
    });
    expect(res.json()).toEqual({ ok: true, ignored: true });
  });
});

describe('calls answered while the server was not listening', () => {
  const INBOUND = { RETELL_INBOUND_AGENT_ID: 'agent_inbound' };
  const HOUR = 3_600_000;

  /** An answered call the way Retell lists it: that it happened, not what was said. */
  function listed(id: string, startedAgoMs: number, extra: Record<string, unknown> = {}) {
    const start = Date.now() - startedAgoMs;
    return {
      call_id: id,
      call_type: 'phone_call',
      direction: 'inbound',
      agent_id: 'agent_inbound',
      from_number: '+4915112345678',
      to_number: '+493000000000',
      call_status: 'ended',
      start_timestamp: start,
      end_timestamp: start + 40_000,
      duration_ms: 40_000,
      disconnection_reason: 'user_hangup',
      call_analysis: { call_summary: `Summary of ${id}`, call_successful: true },
      ...extra,
    };
  }

  const said = [
    { role: 'agent', content: 'Merhaba! Ben Ali adına telefona bakan yapay zekâ asistanıyım.' },
    { role: 'user', content: 'Guten Tag, hier ist die Praxis Dr. Weber. Bitte rufen Sie zurück.' },
  ];

  /** A server whose phone service has these answered calls on record. */
  function withCalls(calls: () => Array<Record<string, unknown>>, env: NodeJS.ProcessEnv = {}) {
    return retellApp({ ...INBOUND, ...env }, (request) => {
      if (request.url.endsWith('/v3/list-calls')) {
        return { body: { has_more: false, items: calls() } };
      }
      const fetched = /\/v2\/get-call\/([^/?]+)/.exec(request.url);
      if (fetched) {
        const call = calls().find((entry) => entry.call_id === fetched[1]);
        return call ? { body: { ...call, transcript_object: said } } : { status: 404, body: {} };
      }
      return undefined;
    });
  }

  async function switchOn(built: App) {
    return built.fastify.inject({
      method: 'PUT',
      url: '/api/profile',
      headers: authed(built),
      payload: { name: 'Ali', language: 'tr', callLanguage: 'de', answerCalls: true },
    });
  }

  const mine = (built: App) => built.store.listByDevice(DEVICE['x-device-id']);

  it('fetches them when it starts, each under the time it came in', async () => {
    const calls = [listed('call_night', 9 * HOUR), listed('call_morning', 2 * HOUR)];
    // Retell lists the newest first, and other kinds of calls with them.
    const onRecord = [
      { call_id: 'web_1', call_type: 'web_call', call_status: 'ended' },
      calls[1]!,
      { ...listed('call_out', HOUR), direction: 'outbound' },
      calls[0]!,
    ];
    const { app: built, requests, said: lines } = withCalls(() => onRecord);
    await switchOn(built);
    await until(() => mine(built).length === 2);

    const asked = requests.find((r) => r.url.endsWith('/v3/list-calls'))!;
    expect(asked.method).toBe('POST');
    expect(asked.body.filter_criteria.agent).toEqual([{ agent_id: 'agent_inbound' }]);
    expect(asked.body.filter_criteria.start_timestamp).toMatchObject({ op: 'bt', type: 'range' });
    // As far back as Retell keeps a call: seven days.
    const [from, to] = asked.body.filter_criteria.start_timestamp.value;
    expect(to - from).toBeGreaterThan(6.9 * 24 * HOUR);
    expect(to - from).toBeLessThan(7.1 * 24 * HOUR);

    const tasks = mine(built);
    expect(tasks.map((task) => task.providerCallId)).toEqual(['call_morning', 'call_night']);
    const night = tasks[1]!;
    expect(night).toMatchObject({
      direction: 'inbound',
      status: 'completed',
      phoneNumber: '+4915112345678',
      durationSeconds: 40,
      language: 'de',
      summaryLanguage: 'tr',
      summary: 'Summary of call_night',
      summarySource: 'provider',
    });
    expect(night.createdAt).toBe(new Date(calls[0]!.start_timestamp as number).toISOString());
    expect(night.transcript).toContain('Praxis Dr. Weber');
    // Fetched and filed: Retell has no reason to keep them.
    await until(() => requests.filter((r) => r.url.includes('/v2/delete-call/')).length === 2);
    // The window says what came in.
    expect(lines.join('\n')).toContain('+4915112345678');
  });

  it('takes each call once, however often it looks', async () => {
    const onRecord = [listed('call_once', HOUR)];
    const { app: built, requests } = withCalls(() => onRecord, { RETELL_DELETE_AFTER_CALL: 'false' });
    await switchOn(built);
    // Switching on looks by itself.
    await until(() => mine(built).length === 1);
    await pause(10);
    expect(await built.engine.importAnsweredCalls()).toBe(0);
    expect(await built.engine.importAnsweredCalls()).toBe(0);
    expect(mine(built)).toHaveLength(1);
    expect(requests.filter((r) => r.url.includes('/v2/get-call/'))).toHaveLength(1);
  });

  it('leaves a call that has only just ended until its summary is there', async () => {
    const justOver = listed('call_fresh', 45_000, { call_analysis: undefined });
    let onRecord: Array<Record<string, unknown>> = [justOver];
    const { app: built } = withCalls(() => onRecord);
    await switchOn(built);
    await pause(20);
    expect(await built.engine.importAnsweredCalls()).toBe(0);
    expect(mine(built)).toHaveLength(0);

    onRecord = [{ ...justOver, call_analysis: { call_summary: 'They want a call back.' } }];
    expect(await built.engine.importAnsweredCalls()).toBe(1);
    expect(mine(built)[0]).toMatchObject({ summary: 'They want a call back.', status: 'completed' });
  });

  it('shows a call that is still going on, and follows it', async () => {
    const onRecord = [
      listed('call_live', 20_000, {
        call_status: 'ongoing',
        end_timestamp: undefined,
        duration_ms: undefined,
        disconnection_reason: undefined,
        call_analysis: undefined,
      }),
    ];
    const { app: built } = withCalls(() => onRecord);
    await switchOn(built);
    const task = await until(() => mine(built)[0]);
    expect(task).toMatchObject({ status: 'in_progress', direction: 'inbound' });
    expect(task.lines).toHaveLength(2);
  });

  it('looks when the app opens its list — but only while answering is on', async () => {
    const onRecord = [listed('call_seen', HOUR)];
    const { app: built, requests } = withCalls(() => onRecord);
    const list = () =>
      built.fastify.inject({ method: 'GET', url: '/api/tasks', headers: authed(built) });

    await list();
    await pause(20);
    expect(requests.filter((r) => r.url.endsWith('/v3/list-calls'))).toHaveLength(0);

    await switchOn(built);
    // Switching on looks once; the list asks again only after a while.
    await until(() => mine(built).length === 1);
    const looks = requests.filter((r) => r.url.endsWith('/v3/list-calls')).length;
    await list();
    await list();
    await pause(20);
    expect(requests.filter((r) => r.url.endsWith('/v3/list-calls'))).toHaveLength(looks);
    expect((await list()).json()).toHaveLength(1);
  });

  it('collects what was taken up to the moment answering is switched off', async () => {
    let onRecord: Array<Record<string, unknown>> = [];
    const { app: built } = withCalls(() => onRecord);
    await switchOn(built);
    await pause(20);
    onRecord = [listed('call_last', 5 * 60_000)];
    await built.fastify.inject({
      method: 'PUT',
      url: '/api/profile',
      headers: authed(built),
      payload: { answerCalls: false },
    });
    const task = await until(() => mine(built)[0]);
    expect(task.providerCallId).toBe('call_last');
  });

  it('brings answering up to date at every start, and fetches first', async () => {
    const onRecord = [listed('call_weekend', 30 * HOUR)];
    const { app: built, requests } = withCalls(() => onRecord);
    await switchOn(built);
    await until(() => mine(built).length === 1);
    requests.length = 0;

    await built.refreshCallAnswering();
    await pause(10);
    const paths = requests.map((r) => new URL(r.url).pathname.split('/').filter(Boolean).join('/'));
    // What was answered meanwhile is asked for before anything else ...
    expect(paths[0]).toBe('v3/list-calls');
    // ... and the agent is told again who it answers for and where this server is now.
    expect(paths.some((path) => path.startsWith('update-retell-llm/'))).toBe(true);
    expect(paths.some((path) => path.startsWith('update-agent/'))).toBe(true);
    expect(paths.some((path) => path.startsWith('update-phone-number/'))).toBe(true);
  });

  it('says in the window when a fetched call came in, not that it is being answered now', async () => {
    const onRecord = [listed('call_saturday', 40 * HOUR)];
    const { app: built, said: lines } = withCalls(() => onRecord);
    await switchOn(built);
    await until(() => mine(built).length === 1);
    const about = lines.filter((line) => line.includes('+4915112345678'));
    expect(about).toHaveLength(1);
    expect(about[0]).toMatch(/^Fetched a call from \+4915112345678 that was answered on .* at \d\d:\d\d/);
  });

  it('says nothing to the phone service at start while answering is off', async () => {
    const { app: built, requests } = withCalls(() => []);
    await built.refreshCallAnswering();
    expect(requests).toHaveLength(0);
  });

  it('asks for more when one answer does not hold them all', async () => {
    const older = listed('call_older', 30 * HOUR);
    const newer = listed('call_newer', 2 * HOUR);
    const { app: built, requests } = retellApp(INBOUND, (request) => {
      if (request.url.endsWith('/v3/list-calls')) {
        return request.body.pagination_key === 'page-2'
          ? { body: { has_more: false, items: [older] } }
          : { body: { has_more: true, pagination_key: 'page-2', items: [newer] } };
      }
      const fetched = /\/v2\/get-call\/([^/?]+)/.exec(request.url);
      if (fetched) {
        const call = [older, newer].find((entry) => entry.call_id === fetched[1]);
        return { body: { ...call, transcript_object: said } };
      }
      return undefined;
    });
    await switchOn(built);
    await until(() => mine(built).length === 2);
    expect(mine(built).map((task) => task.providerCallId)).toEqual(['call_newer', 'call_older']);
    const pages = requests.filter((r) => r.url.endsWith('/v3/list-calls'));
    expect(pages[1]!.body.pagination_key).toBe('page-2');
  });

  it('keeps going when the phone service cannot be asked', async () => {
    const { app: built } = retellApp(INBOUND, (request) =>
      request.url.endsWith('/v3/list-calls') ? { status: 500, body: { message: 'down' } } : undefined,
    );
    await switchOn(built);
    await pause(20);
    expect(await built.engine.importAnsweredCalls()).toBe(0);
    expect(mine(built)).toHaveLength(0);
  });
});

describe('the summary of a call nobody reported on', () => {
  it('is asked for when no event brings it', async () => {
    // No public address: Retell cannot say that its summary is ready.
    let analysed = false;
    const { app: built, requests } = retellApp({}, (request) => {
      if (!request.url.includes('/v2/get-call/')) return undefined;
      return {
        body: {
          call_id: 'call_1',
          call_status: 'ended',
          disconnection_reason: 'user_hangup',
          transcript_object: conversation,
          ...(analysed
            ? { call_analysis: { call_summary: 'An appointment on Tuesday at 9:30 was agreed.', call_successful: true } }
            : {}),
        },
      };
    });
    const { id } = (await placeCall(built)).json();
    built.engine.applySnapshot(built.store.get(id)!, {
      call_id: 'call_1',
      call_status: 'ended',
      disconnection_reason: 'user_hangup',
      duration_ms: 61_000,
      transcript_object: conversation,
    });
    // Without a report writer there is only the plain note that there is none.
    expect(built.store.get(id)).toMatchObject({ status: 'completed', summarySource: 'placeholder' });

    analysed = true;
    const task = await until(() => {
      const current = built.store.get(id);
      return current?.summarySource === 'provider' ? current : null;
    });
    expect(task.summary).toBe('An appointment on Tuesday at 9:30 was agreed.');
    expect(task.outcome).toBe('achieved');
    // With its summary read, the call is deleted at Retell.
    await until(() => requests.some((r) => r.url.includes('/v2/delete-call/call_1')));
  });

  it('stops asking after a few tries', async () => {
    const { app: built, requests } = retellApp({}, (request) =>
      request.url.includes('/v2/get-call/')
        ? { body: { call_id: 'call_1', call_status: 'ended', transcript_object: conversation } }
        : undefined,
    );
    const { id } = (await placeCall(built)).json();
    built.engine.applySnapshot(built.store.get(id)!, {
      call_id: 'call_1',
      call_status: 'ended',
      disconnection_reason: 'user_hangup',
      transcript_object: conversation,
    });
    await pause(120);
    expect(requests.filter((r) => r.url.includes('/v2/get-call/'))).toHaveLength(2);
    expect(built.store.get(id)?.summarySource).toBe('placeholder');
  });
});

describe('reading a Retell call', () => {
  it('prefers the structured transcript and maps the roles', () => {
    const call: RetellCall = {
      transcript: 'Agent: wrong source',
      transcript_object: [
        { role: 'agent', content: 'Hello.' },
        { role: 'user', content: 'Hi.' },
        { role: 'transfer_target', content: 'Front desk.' },
      ],
    };
    expect(linesFromCall(call)).toEqual([
      { role: 'assistant', text: 'Hello.' },
      { role: 'other', text: 'Hi. Front desk.' },
    ]);
    expect(linesFromCall({})).toEqual([]);
  });

  it('takes the duration from Retell, falling back to the timestamps', () => {
    expect(callDurationSeconds({ duration_ms: 185_400 })).toBe(185);
    expect(callDurationSeconds({ start_timestamp: 1_000, end_timestamp: 31_000 })).toBe(30);
    expect(callDurationSeconds({})).toBeNull();
  });

  it('judges a reason it has never seen by what actually happened', () => {
    const future = { disconnection_reason: 'some_reason_added_next_year' };
    expect(classifyEnding(future, { hadConversation: true, wasConnected: true })).toMatchObject({
      status: 'completed',
      errorCode: null,
    });
    expect(classifyEnding(future, { hadConversation: false, wasConnected: true })).toMatchObject({
      status: 'failed',
      errorCode: 'no_answer',
    });
    expect(classifyEnding(future, { hadConversation: false, wasConnected: false })).toMatchObject({
      status: 'failed',
      errorCode: 'provider_error',
    });
    expect(
      classifyEnding({ call_status: 'not_connected' }, { hadConversation: false, wasConnected: true }),
    ).toMatchObject({ status: 'failed', errorCode: 'provider_error' });
  });

  it('counts a machine picking up as nobody answering', () => {
    expect(
      classifyEnding(
        { disconnection_reason: 'agent_hangup', call_analysis: { in_voicemail: true } },
        { hadConversation: true, wasConnected: true },
      ),
    ).toMatchObject({ status: 'failed', errorCode: 'voicemail', outcome: 'no_answer' });
  });
});

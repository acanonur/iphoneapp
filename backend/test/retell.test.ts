import { afterEach, describe, expect, it } from 'vitest';
import { buildApp, type App } from '../src/app.js';
import {
  classifyEnding,
  linesFromCall,
  callDurationSeconds,
  type RetellCall,
} from '../src/providers/retell.js';
import { signRetellPayload } from '../src/retell-signature.js';
import { DEVICE, fakeFetch, pause, testConfig, until, type RecordedRequest } from './helpers.js';

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
  respond: (request: RecordedRequest) => { status?: number; body?: unknown } | undefined = () =>
    undefined,
) {
  let created = 0;
  const net = fakeFetch((request) => {
    const custom = respond(request);
    if (custom) return custom;
    if (request.url.endsWith('/v2/create-phone-call')) {
      created += 1;
      return { status: 201, body: { call_id: `call_${created}`, call_status: 'registered' } };
    }
    return { body: {} };
  });
  app = buildApp(testConfig({ ...RETELL_ENV, ...env }), { retellFetch: net.fetch });
  return { app, requests: net.requests };
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

  it('hangs up through Retell when the user ends the call', async () => {
    const { app: built, requests } = retellApp();
    const { id } = (await placeCall(built)).json();
    const res = await built.fastify.inject({
      method: 'POST',
      url: `/api/tasks/${id}/cancel`,
      headers: authed(built),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'failed', errorCode: 'cancelled' });
    const stop = requests.find((r) => r.url.endsWith('/v2/stop-call/call_1'));
    expect(stop?.method).toBe('POST');
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
    expect(bind.body.inbound_webhook_url).toBe(
      `https://yaver.example.com/webhooks/retell/${built.webhookSecret}`,
    );
    const agent = requests.find((r) => r.url.includes('/update-agent/agent_inbound'))!;
    expect(agent.body.webhook_events).toContain('transcript_updated');

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

  it('explains what is missing instead of pretending it worked', async () => {
    const noAgent = retellApp({ PUBLIC_BASE_URL: 'https://yaver.example.com' });
    const first = await switchOn(noAgent.app);
    expect(first.statusCode).toBe(409);
    expect(first.json().code).toBe('answering_not_set_up');
    await noAgent.app.fastify.close();

    const noAddress = retellApp({ RETELL_INBOUND_AGENT_ID: 'agent_inbound' });
    const second = await switchOn(noAddress.app);
    expect(second.statusCode).toBe(409);
    expect(second.json().code).toBe('public_address_needed');
    // Nothing was saved as switched on.
    const profile = (
      await noAddress.app.fastify.inject({
        method: 'GET',
        url: '/api/profile',
        headers: authed(noAddress.app),
      })
    ).json();
    expect(profile.answerCalls).toBe(false);
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

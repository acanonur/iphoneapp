/**
 * One-time setup of the phone side: creates (or updates) the two voice agents
 * this backend uses at Retell — the one that places calls and the one that
 * answers them — and writes their ids into backend/.env.
 *
 *   npm run retell:setup
 *
 * It needs a Retell API key: it asks for one the first time and keeps it in
 * backend/.env (RETELL_API_KEY). It never buys a phone number: that costs
 * money every month, so it is left to a person (see docs/real-calls.md).
 * Running it again updates the existing agents instead of making new ones.
 */
import '../src/env.js';
import Retell from 'retell-sdk';
import {
  AGENT_PROMPT_TEMPLATE,
  INBOUND_PROMPT_TEMPLATE,
  disclosureLine,
  greetingLine,
} from '../src/prompt.js';
import {
  ANSWERED_CALLS_KEPT_DAYS,
  WEBHOOK_EVENTS,
  describeError,
} from '../src/providers/retell.js';
import { ask, saveToEnv, say } from './terminal.js';

const END_CALL_TOOL: Retell.LlmCreateParams.EndCallTool = {
  type: 'end_call',
  name: 'end_call',
  description:
    'End the call when the task is done and goodbyes are said, when the other side cannot help, when it is a wrong number, when a mailbox answered, or when they refuse to talk to an AI.',
};

/** What the agent that places calls is told. Per-call values replace the defaults. */
const OUTBOUND_LLM: Retell.LlmCreateParams = {
  general_prompt: AGENT_PROMPT_TEMPLATE,
  start_speaker: 'agent',
  begin_message: '{{disclosure}}',
  general_tools: [END_CALL_TOOL],
  default_dynamic_variables: {
    user_name: 'the client',
    language_name: 'English',
    goal: 'Ask politely whether this is a good time to talk, then end the call.',
    disclosure: disclosureLine('en', null),
  },
};

/** What the agent that answers calls is told. */
const INBOUND_LLM: Retell.LlmCreateParams = {
  general_prompt: INBOUND_PROMPT_TEMPLATE,
  start_speaker: 'agent',
  begin_message: '{{greeting}}',
  general_tools: [END_CALL_TOOL],
  default_dynamic_variables: {
    greeting: greetingLine('en', null),
    owner_name: 'the person you called',
    owner_language: 'English',
    owner_note: 'No special instructions.',
  },
};

type AgentSettings = Omit<Retell.AgentCreateParams, 'response_engine' | 'voice_id'>;

const SHARED_AGENT: AgentSettings = {
  timezone: 'Europe/Berlin',
  max_call_duration_ms: 600_000,
  end_call_after_silence_ms: 90_000,
  // Automatic deletion as a safety net; the backend deletes each call sooner.
  data_storage_retention_days: 1,
  webhook_events: [...WEBHOOK_EVENTS],
};

const OUTBOUND_AGENT: AgentSettings = {
  ...SHARED_AGENT,
  agent_name: 'Yaver — places calls',
  language: 'de-DE',
  voicemail_option: { action: { type: 'hangup' } },
};

const INBOUND_AGENT: AgentSettings = {
  ...SHARED_AGENT,
  agent_name: 'Yaver — answers calls',
  // Calls are answered while the server is off, too: a message has to wait
  // for it longer than a day. The server deletes each call once it has it.
  data_storage_retention_days: ANSWERED_CALLS_KEPT_DAYS,
  // Callers may speak any of the three; the agent follows the caller.
  language: ['de-DE', 'tr-TR', 'en-US'],
};

function pickVoice(voices: Retell.VoiceListResponse, wanted: string | undefined): Retell.VoiceResponse {
  if (wanted) {
    const chosen = voices.find((voice) => voice.voice_id === wanted);
    if (chosen) return chosen;
    say(`  ! The voice "${wanted}" (RETELL_VOICE_ID) is not in this account; choosing another.`);
  }
  // Retell does not say which language a voice speaks. ElevenLabs and OpenAI
  // voices are multilingual, so they are the safe choice for German and Turkish.
  const preferred =
    voices.find((voice) => voice.provider === 'elevenlabs') ??
    voices.find((voice) => voice.provider === 'openai') ??
    voices[0];
  if (!preferred) throw new Error('This Retell account has no voices to choose from.');
  return preferred;
}

async function upsertAgent(
  client: Retell,
  existingId: string | undefined,
  llm: Retell.LlmCreateParams,
  settings: AgentSettings,
  voiceId: string,
): Promise<{ agentId: string; created: boolean }> {
  if (existingId) {
    try {
      const agent = await client.agent.retrieve(existingId);
      const engine = agent.response_engine;
      if (engine.type === 'retell-llm') {
        await client.llm.update(engine.llm_id, llm);
        await client.agent.update(existingId, { ...settings, voice_id: voiceId });
        return { agentId: existingId, created: false };
      }
      say(`  ! Agent ${existingId} is not a single-prompt agent; creating a new one.`);
    } catch (error) {
      if (!(error instanceof Retell.NotFoundError)) throw error;
      say(`  ! Agent ${existingId} no longer exists; creating a new one.`);
    }
  }
  const created = await client.llm.create(llm);
  const agent = await client.agent.create({
    ...settings,
    voice_id: voiceId,
    response_engine: { type: 'retell-llm', llm_id: created.llm_id },
  });
  return { agentId: agent.agent_id, created: true };
}

async function main(): Promise<void> {
  let apiKey = process.env.RETELL_API_KEY?.trim();
  if (!apiKey && process.stdin.isTTY) {
    // Nobody should have to edit a settings file to get started.
    say('Real phone calls go through Retell AI. Yaver needs a key from your account there:');
    say('  1. Open https://dashboard.retellai.com and sign in (or create an account).');
    say('  2. Go to Settings → API Keys and copy the key. It starts with "key_".');
    say('     (If there are several, take the one marked "Webhook".)');
    say();
    apiKey = await ask('Paste the key here and press Enter (or just press Enter to stop): ');
    if (apiKey) {
      saveToEnv({ RETELL_API_KEY: apiKey });
      say('Saved in backend/.env. The key stays on this computer.');
      say();
    }
  }
  if (!apiKey) {
    say('No Retell API key yet.');
    say('1. Create an account at https://dashboard.retellai.com');
    say('2. Copy an API key from Settings → API Keys');
    say('3. Run this again and paste the key when asked');
    say('   (or put it in backend/.env as  RETELL_API_KEY=key_...).');
    process.exitCode = 1;
    return;
  }
  const client = new Retell({ apiKey });

  say('Checking the key and listing voices…');
  const voices = await client.voice.list();
  const voice = pickVoice(voices, process.env.RETELL_VOICE_ID?.trim());
  say(`  Voice: ${voice.voice_name} (${voice.provider}, id ${voice.voice_id})`);
  if (voice.preview_audio_url) say(`  Listen: ${voice.preview_audio_url}`);

  say('Setting up the agent that places calls…');
  const outbound = await upsertAgent(
    client,
    process.env.RETELL_AGENT_ID?.trim(),
    OUTBOUND_LLM,
    OUTBOUND_AGENT,
    voice.voice_id,
  );
  say(`  ${outbound.created ? 'Created' : 'Updated'} ${outbound.agentId}`);

  say('Setting up the agent that answers calls…');
  const inbound = await upsertAgent(
    client,
    process.env.RETELL_INBOUND_AGENT_ID?.trim(),
    INBOUND_LLM,
    INBOUND_AGENT,
    voice.voice_id,
  );
  say(`  ${inbound.created ? 'Created' : 'Updated'} ${inbound.agentId}`);

  const numbers = (await client.phoneNumber.list()).items;
  const configured = process.env.RETELL_FROM_NUMBER?.trim();
  const fromNumber =
    configured || (numbers.length === 1 ? numbers[0]?.phone_number : undefined);

  saveToEnv({
    RETELL_AGENT_ID: outbound.agentId,
    RETELL_INBOUND_AGENT_ID: inbound.agentId,
    ...(fromNumber ? { RETELL_FROM_NUMBER: fromNumber, CALL_PROVIDER: 'retell' } : {}),
  });

  say();
  say('Saved to backend/.env.');
  if (fromNumber) {
    say(`Calls will be placed from ${fromNumber}. Restart the server (npm start) to use it.`);
  } else if (numbers.length > 1) {
    say('This account has several phone numbers. Put the one to use in backend/.env, as one of:');
    for (const number of numbers) say(`  RETELL_FROM_NUMBER=${number.phone_number}`);
    say('Then run "npm run retell:setup" once more — that switches real calls on.');
  } else {
    say('One thing is still missing: a phone number.');
    say('Real calls need a number in your Retell account — see docs/real-calls.md,');
    say('section "A phone number". When you have one, run this script again.');
  }
}

main().catch((error) => {
  say();
  say(`Setup failed: ${describeError(error)}`);
  if (error instanceof Retell.AuthenticationError) {
    say('The API key was not accepted. Check RETELL_API_KEY in backend/.env.');
  }
  process.exitCode = 1;
});

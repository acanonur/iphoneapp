import type { SecretaryTask, Language } from './types.js';

export const LANGUAGE_NAMES: Record<Language, string> = {
  de: 'German',
  en: 'English',
  tr: 'Turkish',
};

/**
 * Mandatory AI self-disclosure, spoken as the very first sentence of every call.
 * EU AI Act Article 50(1) (applies from 2 Aug 2026) requires people to be told
 * they are talking to an AI no later than the first interaction.
 */
export function disclosureLine(language: Language, userName: string | null): string {
  const name = userName?.trim() || null;
  switch (language) {
    case 'de':
      return name
        ? `Hallo! Hier spricht ein KI-Assistent, der im Auftrag von ${name} anruft.`
        : 'Hallo! Hier spricht ein KI-Assistent, der im Auftrag eines Kunden anruft.';
    case 'tr':
      return name
        ? `Merhaba! Ben ${name} adına arayan bir yapay zeka asistanıyım.`
        : 'Merhaba! Ben bir müşteri adına arayan bir yapay zeka asistanıyım.';
    case 'en':
      return name
        ? `Hello! This is an AI assistant calling on behalf of ${name}.`
        : 'Hello! This is an AI assistant calling on behalf of a client.';
  }
}

/**
 * Values injected into the voice agent as dynamic variables.
 * In the Retell dashboard the agent prompt references these as
 * {{disclosure}}, {{goal}}, {{user_name}}, {{language_name}}.
 */
export function buildAgentVariables(task: SecretaryTask): Record<string, string> {
  return {
    disclosure: disclosureLine(task.language, task.userName),
    goal: task.goal,
    user_name: task.userName?.trim() || 'the client',
    language_name: LANGUAGE_NAMES[task.language],
  };
}

/**
 * The full agent prompt template. Paste this into the voice-agent platform
 * (Retell "General Prompt") once; per-call values arrive as dynamic variables.
 */
export const AGENT_PROMPT_TEMPLATE = `You are a polite, efficient personal secretary making a phone call on behalf of {{user_name}}, who is not fluent in {{language_name}}.

Speak ONLY {{language_name}} for the entire call.

Your task for this call:
{{goal}}

Rules:
1. Your very first sentence must be exactly: "{{disclosure}}" — you must always identify yourself as an AI assistant. Never pretend to be human, even if asked repeatedly.
2. Then state briefly why you are calling and pursue the task.
3. Be concise and natural. Use short sentences suitable for a phone call. One question at a time.
4. Never invent personal data. If you are asked for information about {{user_name}} that you were not given (date of birth, insurance number, address), say you don't have it at hand and that {{user_name}} will provide it later or in person.
5. If asked whether the call is recorded, say: no audio recording is stored; a text transcript is made so {{user_name}} can read what was agreed.
6. Before ending, repeat and confirm the key result (for example date, time, place, price, reference number).
7. If the other side cannot help, is a wrong number, or refuses to talk to an AI, apologize briefly, thank them, and end the call politely.
8. Never agree to payments or legally binding commitments beyond the stated task.
9. End the call with a short thank-you and goodbye.`;

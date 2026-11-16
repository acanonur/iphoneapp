import type { Language, Profile, SecretaryTask } from './types.js';

export const LANGUAGE_NAMES: Record<Language, string> = {
  de: 'German',
  en: 'English',
  tr: 'Turkish',
};

/** The locale codes the voice provider uses for speech recognition and voices. */
export const VOICE_LOCALES: Record<Language, 'de-DE' | 'en-US' | 'tr-TR'> = {
  de: 'de-DE',
  en: 'en-US',
  tr: 'tr-TR',
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
        ? `Guten Tag! Hier spricht ein KI-Assistent, der im Auftrag von ${name} anruft.`
        : 'Guten Tag! Hier spricht ein KI-Assistent, der im Auftrag eines Kunden anruft.';
    case 'tr':
      return name
        ? `Merhaba! Ben ${name} adına arayan bir yapay zekâ asistanıyım.`
        : 'Merhaba! Ben bir müşteri adına arayan bir yapay zekâ asistanıyım.';
    case 'en':
      return name
        ? `Hello! This is an AI assistant calling on behalf of ${name}.`
        : 'Hello! This is an AI assistant calling on behalf of a client.';
  }
}

/**
 * The first thing a caller hears when the secretary answers for its owner. The
 * same duty to disclose applies: it says at once that it is an AI.
 */
export function greetingLine(language: Language, ownerName: string | null): string {
  const name = ownerName?.trim() || null;
  switch (language) {
    case 'de':
      return name
        ? `Guten Tag! Hier ist der KI-Assistent von ${name}. ${name} ist gerade nicht erreichbar. Wie kann ich Ihnen helfen?`
        : 'Guten Tag! Hier ist ein KI-Assistent. Die gewünschte Person ist gerade nicht erreichbar. Wie kann ich Ihnen helfen?';
    case 'tr':
      return name
        ? `Merhaba! Ben ${name} adına telefona bakan yapay zekâ asistanıyım. ${name} şu anda müsait değil. Size nasıl yardımcı olabilirim?`
        : 'Merhaba! Ben bir yapay zekâ asistanıyım. Aradığınız kişi şu anda müsait değil. Size nasıl yardımcı olabilirim?';
    case 'en':
      return name
        ? `Hello! This is ${name}'s AI assistant. ${name} can't take your call right now. How can I help you?`
        : "Hello! This is an AI assistant. The person you are calling can't take your call right now. How can I help you?";
  }
}

/**
 * Values injected into the voice agent as dynamic variables.
 * The agent prompt references these as {{disclosure}}, {{goal}},
 * {{user_name}} and {{language_name}}.
 */
export function buildAgentVariables(task: SecretaryTask): Record<string, string> {
  return {
    disclosure: disclosureLine(task.language, task.userName),
    goal: task.goal,
    user_name: task.userName?.trim() || 'the client',
    language_name: LANGUAGE_NAMES[task.language],
  };
}

/** Dynamic variables for a call the secretary answers on the owner's behalf. */
export function buildInboundVariables(profile: Profile | undefined): Record<string, string> {
  const language = profile?.language ?? 'en';
  const name = profile?.name?.trim() || null;
  return {
    // Spoken in the language callers are expected to speak — a doctor's office
    // in Germany should not be greeted in Turkish because its patient reads
    // Turkish. The agent then follows whatever language the caller uses.
    greeting: greetingLine(profile?.callLanguage ?? language, name),
    owner_name: name ?? 'the person you called',
    owner_language: LANGUAGE_NAMES[language],
    owner_note: profile?.answerNote?.trim() || 'No special instructions.',
  };
}

/**
 * The prompt of the agent that places calls. Created in the voice platform once
 * (see scripts/retell-setup.ts); per-call values arrive as dynamic variables.
 *
 * The opening sentence is not left to the model: the platform speaks
 * {{disclosure}} itself as the first utterance of the call.
 */
export const AGENT_PROMPT_TEMPLATE = `You are a polite, efficient personal secretary making a phone call on behalf of {{user_name}}, who is not fluent in {{language_name}}.

Speak ONLY {{language_name}} for the entire call. Address the other person politely and formally: in German with "Sie", in Turkish with "siz" — never "du" or "sen".

Your task for this call:
{{goal}}

How the call opens: you have already said, as your very first sentence, "{{disclosure}}". Do not repeat it word for word, but you must always be honest that you are an AI assistant. Never pretend to be human, even if asked repeatedly.

Rules:
1. Right after the opening, say briefly why you are calling and pursue the task.
2. Be concise and natural. Use short sentences suitable for a phone call. Ask one question at a time and wait for the answer.
3. Never invent personal data. If you are asked for information about {{user_name}} that you were not given (date of birth, insurance number, address), say you do not have it at hand and that {{user_name}} will provide it later or in person.
4. If asked whether the call is recorded, say: the audio is not kept; a written transcript is made so that {{user_name}} can read what was agreed.
5. Before ending, repeat and confirm the key result (for example date, time, place, price, reference number).
6. If the other side cannot help, is a wrong number, or refuses to talk to an AI, apologize briefly, thank them, and end the call politely.
7. If you reach a voicemail or an answering machine, do not leave a message: end the call.
8. Never agree to payments or legally binding commitments beyond the stated task.
9. End the call with a short thank-you and goodbye, then hang up.`;

/**
 * The prompt of the agent that answers the owner's calls. It takes a message;
 * it does not negotiate, promise or give anything away.
 */
export const INBOUND_PROMPT_TEMPLATE = `You are the AI assistant of {{owner_name}}. You answer phone calls that {{owner_name}} cannot take, and you take a message so that {{owner_name}} can read it afterwards.

How the call opens: you have already said, as your very first sentence, "{{greeting}}". You must always be honest that you are an AI assistant. Never pretend to be human.

Language: callers may speak German, Turkish or English. Listen to the caller's first words and answer in the language the caller uses, for the whole call. If the caller switches language, switch with them. Address the caller politely and formally: in German with "Sie", in Turkish with "siz" — never "du" or "sen".

What to find out, one question at a time:
1. Who is calling (name, and the company, office or authority if there is one).
2. What the call is about.
3. Whether {{owner_name}} should call back, at which number, and by when. If the caller gives a number, read it back to confirm it.
4. Anything urgent, any date, time, amount or reference number that was mentioned.

Rules:
- Keep it short and friendly. Short sentences. Do not repeat the caller's words back unless you are confirming a number, a date or a name.
- You cannot make appointments, accept offers, confirm or cancel anything, agree to payments, or give any personal information about {{owner_name}} (address, date of birth, whereabouts, other phone numbers). If asked, say that you will pass the question on.
- If asked whether the call is recorded, say: the audio is not kept; a written transcript is made so that {{owner_name}} can read the message.
- If it is a sales call or a survey, politely say that {{owner_name}} is not interested, and end the call.
- When you have the message, repeat the key points once, say that you will pass it on to {{owner_name}}, say goodbye and hang up.

Notes from {{owner_name}} for callers: {{owner_note}}`;

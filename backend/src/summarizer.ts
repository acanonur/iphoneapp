import { askForJson, type ClaudeSettings } from './claude.js';
import { LANGUAGE_NAMES } from './prompt.js';
import { linesToText } from './transcript.js';
import type { CallOutcome, Language, SecretaryTask } from './types.js';

/** What the user reads after a call the secretary placed for them. */
export interface CallReport {
  summary: string;
  outcome: CallOutcome;
  todo: string | null;
  todoWhen: string | null;
}

/** What the user reads after a call the secretary answered for them. */
export interface AnsweredCallReport {
  /** Who rang and why — the headline in the list of calls. */
  subject: string;
  summary: string;
  todo: string | null;
  todoWhen: string | null;
  /** False when the caller hung up or said nothing that could be passed on. */
  messageTaken: boolean;
}

const OUTCOMES: CallOutcome[] = [
  'achieved',
  'partially_achieved',
  'not_achieved',
  'no_answer',
  'unknown',
];

const NULLABLE_STRING = { type: ['string', 'null'] } as const;

const REPORT_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    outcome: { type: 'string', enum: OUTCOMES },
    todo: NULLABLE_STRING,
    todoWhen: NULLABLE_STRING,
  },
  required: ['summary', 'outcome', 'todo', 'todoWhen'],
  additionalProperties: false,
};

const ANSWERED_SCHEMA = {
  type: 'object',
  properties: {
    subject: { type: 'string' },
    summary: { type: 'string' },
    todo: NULLABLE_STRING,
    todoWhen: NULLABLE_STRING,
    messageTaken: { type: 'boolean' },
  },
  required: ['subject', 'summary', 'todo', 'todoWhen', 'messageTaken'],
  additionalProperties: false,
};

const ONLY_WHAT_WAS_SAID =
  'Report only what the transcript supports. A detail that was not said — a time, a price, a name, a promise — must not appear, and anything that was left open must be described as open.';

/** How the reader is spoken to, so a report does not change its tone half-way. */
export const READER_ADDRESS =
  'Address the reader politely and formally throughout: in German with "Sie", in Turkish with "siz" — never "du" or "sen". That includes the to-do line: in German an infinitive phrase ("Versichertenkarte mitbringen"), in Turkish a polite imperative ("Sigorta kartınızı getirin"), in English an imperative ("Bring your insurance card").';

function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function transcriptOf(task: SecretaryTask): string {
  return task.lines.length > 0
    ? linesToText(task.lines, task.language, task.direction)
    : (task.transcript ?? '');
}

/**
 * Writes the report on a call the secretary placed, in the user's language.
 * Returns null on any failure so the caller can fall back gracefully.
 */
export async function summarizeCall(
  settings: ClaudeSettings,
  task: SecretaryTask,
): Promise<CallReport | null> {
  const language = LANGUAGE_NAMES[task.summaryLanguage];
  const answer = await askForJson(settings, {
    purpose: 'call report',
    effort: 'low',
    schema: REPORT_SCHEMA,
    system: [
      'You write the short report a person reads on their phone after an AI secretary made a phone call for them.',
      'The reader does not speak the language of the call well — that is why the secretary called for them — so your report is their only reliable account of what was said.',
      ONLY_WHAT_WAS_SAID,
    ].join(' '),
    prompt: [
      'What the reader asked the secretary to do:',
      `<request>${task.goal}</request>`,
      '',
      `The call was held in ${LANGUAGE_NAMES[task.language]}. In the transcript, the AI assistant is the secretary.`,
      `<transcript>\n${transcriptOf(task)}\n</transcript>`,
      '',
      `Write every text field in ${language}. ${READER_ADDRESS}`,
      '- "summary": two to four short sentences telling the reader what happened and what was agreed. Include every concrete detail they will need later: date, time, place, price, reference number, the name of the person spoken to.',
      '- "outcome": how far the request was met — "achieved", "partially_achieved", "not_achieved", "no_answer" (nobody who could help was reached) or "unknown" (the transcript does not tell).',
      '- "todo": the one thing the reader still has to do themselves (bring a document, call back, pay, turn up), as a short phrase; null if nothing is left for them to do.',
      '- "todoWhen": when that is due, as a short date or time the way it was said in the call; null if no time was mentioned.',
    ].join('\n'),
  });

  if (!answer || typeof answer !== 'object') return null;
  const { summary, outcome, todo, todoWhen } = answer as Record<string, unknown>;
  if (typeof summary !== 'string' || !summary.trim()) return null;
  if (typeof outcome !== 'string' || !OUTCOMES.includes(outcome as CallOutcome)) return null;
  return {
    summary: summary.trim(),
    outcome: outcome as CallOutcome,
    todo: optionalText(todo),
    todoWhen: optionalText(todoWhen),
  };
}

/** Writes the note on a call the secretary answered for its owner. */
export async function summarizeAnsweredCall(
  settings: ClaudeSettings,
  task: SecretaryTask,
): Promise<AnsweredCallReport | null> {
  const language = LANGUAGE_NAMES[task.summaryLanguage];
  const owner = task.userName?.trim() || 'the reader';
  const answer = await askForJson(settings, {
    purpose: 'answered-call note',
    effort: 'low',
    schema: ANSWERED_SCHEMA,
    system: [
      'You write the short note a person reads on their phone after their AI assistant answered a phone call for them.',
      "The reader was not on the call and may not speak the caller's language, so your note is their only account of it.",
      ONLY_WHAT_WAS_SAID,
    ].join(' '),
    prompt: [
      `The assistant answered this call for ${owner}. In the transcript, the AI assistant is the one who answered; the other speaker is the caller.`,
      `<transcript>\n${transcriptOf(task)}\n</transcript>`,
      '',
      `Write every text field in ${language}. ${READER_ADDRESS}`,
      '- "subject": who called and why, in at most eight words. It is the headline in a list of calls, so lead with the caller. If the caller gave no name, describe them by what they wanted.',
      '- "summary": two to four short sentences: who called, what they wanted, and every concrete detail — callback number, date, time, amount, reference number.',
      '- "todo": what the reader should do next (usually: call back, with the number), as a short phrase; null if nothing is needed.',
      '- "todoWhen": by when, the way it was said in the call; null if no time was mentioned.',
      '- "messageTaken": true if the caller said what they wanted; false if they hung up or said nothing that can be passed on.',
    ].join('\n'),
  });

  if (!answer || typeof answer !== 'object') return null;
  const { subject, summary, todo, todoWhen, messageTaken } = answer as Record<string, unknown>;
  if (typeof summary !== 'string' || !summary.trim()) return null;
  return {
    subject: typeof subject === 'string' ? subject.trim() : '',
    summary: summary.trim(),
    todo: optionalText(todo),
    todoWhen: optionalText(todoWhen),
    messageTaken: messageTaken !== false,
  };
}

/** Shown when there is no report writer, or it failed. The transcript is still there. */
export function fallbackSummary(language: Language): string {
  switch (language) {
    case 'de':
      return 'Der Anruf ist beendet. Ein KI-Bericht ist gerade nicht verfügbar – die vollständige Mitschrift steht unten.';
    case 'tr':
      return 'Arama tamamlandı. Yapay zekâ özeti şu anda kullanılamıyor — görüşmenin tam dökümü aşağıdadır.';
    case 'en':
      return 'The call has finished. An AI report is not available right now — the full transcript is below.';
  }
}

export function answeredFallbackSummary(language: Language): string {
  switch (language) {
    case 'de':
      return 'Ein Anruf wurde für Sie angenommen. Eine KI-Zusammenfassung ist gerade nicht verfügbar – die vollständige Mitschrift steht unten.';
    case 'tr':
      return 'Sizin adınıza bir arama yanıtlandı. Yapay zekâ özeti şu anda kullanılamıyor — görüşmenin tamamı aşağıdadır.';
    case 'en':
      return 'A call was answered for you. An AI summary is not available right now — the full conversation is below.';
  }
}

export function noMessageSummary(language: Language): string {
  switch (language) {
    case 'de':
      return 'Der Anrufer hat aufgelegt, ohne eine Nachricht zu hinterlassen.';
    case 'tr':
      return 'Arayan kişi mesaj bırakmadan kapattı.';
    case 'en':
      return 'The caller hung up without leaving a message.';
  }
}

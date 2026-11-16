import { askForJson, type ClaudeSettings } from './claude.js';
import type {
  CallErrorCode,
  CallOutcome,
  Language,
  SecretaryTask,
  TaskKind,
  TaskStatus,
} from './types.js';
import { LANGUAGE_NAMES } from './prompt.js';
import { READER_ADDRESS } from './summarizer.js';

/**
 * The paperwork side of the secretary: the letters, messages, forms and
 * follow-ups the app offers next to phone calls. These are text tasks, so they
 * are handled here with Claude rather than through the voice provider.
 */
export interface DocumentResult {
  status: TaskStatus;
  /** What the user reads. Null when the app explains the state in its own words. */
  summary: string | null;
  /** The artefact produced: a reply draft, a translation, the filled form. */
  result: string | null;
  todo: string | null;
  todoWhen: string | null;
  outcome: CallOutcome | null;
  errorCode?: CallErrorCode;
  error?: string;
}

/** Kinds handled here rather than by the call provider. */
export const DOCUMENT_KINDS: TaskKind[] = ['letter', 'message', 'form', 'followup'];

export function isDocumentKind(kind: TaskKind): boolean {
  return DOCUMENT_KINDS.includes(kind);
}

/**
 * Where each kind lands when the work is done. These are the states the app's
 * ledger renders — "Draft ready", "Needs your details", "Scheduled".
 */
const RESULTING_STATUS: Record<string, TaskStatus> = {
  letter: 'completed',
  message: 'draft',
  form: 'needs_input',
  followup: 'scheduled',
};

const INSTRUCTIONS: Record<string, string> = {
  letter: [
    'The user received an official letter they cannot read well and wants to know what it says.',
    'Write "summary" as a plain explanation: who sent it, what it asks for, any deadline, and whether money is due.',
    'Write "result" as a short reply the user could send back, in the language of the letter.',
    'Set "todo" to the single thing the user must still do (or leave it null), and "todoWhen" to its deadline.',
  ].join('\n'),
  message: [
    'The user wants a message or email written on their behalf, which they will review before it is sent.',
    'Write "result" as the finished message, ready to send, in the language the recipient reads.',
    'Write "summary" as one or two sentences telling the user what was drafted and that it is waiting for their approval.',
    'Leave "todo" null unless the user must supply something before it can be sent.',
  ].join('\n'),
  form: [
    'The user wants help filling in an official form.',
    'Write "result" as the form filled in as far as the information allows, marking anything unknown clearly.',
    'Write "summary" as one or two sentences saying how far it got and which fields still need the user.',
    'Set "todo" to the details the user must supply.',
  ].join('\n'),
};

const DOCUMENT_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    result: { type: ['string', 'null'] },
    todo: { type: ['string', 'null'] },
    todoWhen: { type: ['string', 'null'] },
  },
  required: ['summary', 'result', 'todo', 'todoWhen'],
  additionalProperties: false,
};

interface DocumentReply {
  summary: string;
  result: string | null;
  todo: string | null;
  todoWhen: string | null;
}

/**
 * Runs a document task through Claude. Returns null on any failure so the
 * caller can fall back to the offline result rather than leaving the task
 * stuck in `queued`.
 */
export async function processDocumentTask(
  settings: ClaudeSettings,
  task: SecretaryTask,
): Promise<DocumentResult | null> {
  const instruction = INSTRUCTIONS[task.kind];
  if (!instruction) return null;

  const answer = await askForJson(settings, {
    purpose: `${task.kind} task`,
    effort: 'medium',
    schema: DOCUMENT_SCHEMA,
    system:
      'You are a personal secretary for someone living in a country whose language they do not speak well. You read their official post, draft their replies and fill in their forms. Be factual and concrete; never invent personal data (dates of birth, insurance or reference numbers, addresses) that you were not given — mark anything missing so the user can fill it in.',
    prompt: [
      `The user asked: ${task.goal}`,
      task.documentText
        ? `\nThe document they provided:\n<document>\n${task.documentText}\n</document>`
        : '\nThey did not attach a document, so work from the request alone.',
      '',
      instruction,
      '',
      `Write "summary" in ${LANGUAGE_NAMES[task.summaryLanguage]} — this is what the user reads.`,
      `Anything addressed to the other side ("result") goes in ${LANGUAGE_NAMES[task.language]}.`,
      `Write "todo" in ${LANGUAGE_NAMES[task.summaryLanguage]}, and "todoWhen" as a short human date or time, or null.`,
      READER_ADDRESS,
    ].join('\n'),
  });

  if (!answer || typeof answer !== 'object') return null;
  const parsed = answer as Partial<DocumentReply>;
  if (typeof parsed.summary !== 'string' || !parsed.summary.trim()) return null;

  return {
    status: RESULTING_STATUS[task.kind] ?? 'completed',
    summary: parsed.summary,
    result: typeof parsed.result === 'string' ? parsed.result : null,
    todo: typeof parsed.todo === 'string' ? parsed.todo : null,
    todoWhen: typeof parsed.todoWhen === 'string' ? parsed.todoWhen : null,
    outcome: task.kind === 'letter' ? 'achieved' : null,
  };
}

/**
 * What a letter, message or form resolves to when it could not be worked on:
 * either no AI report writer is set up on this server, or it was asked and
 * did not deliver. The task says so honestly rather than pretending to be
 * done; the app puts the reason — and what to do about it — into the user's
 * own language from the code.
 */
export function unworkedDocumentResult(reason: 'reports_off' | 'report_failed'): DocumentResult {
  return {
    status: 'failed',
    summary: null,
    result: null,
    todo: null,
    todoWhen: null,
    outcome: null,
    errorCode: reason,
    error:
      reason === 'reports_off'
        ? 'No AI report writer is set up on this server (npm run claude:setup)'
        : 'The AI report writer did not deliver a result',
  };
}

const SCHEDULED_SUMMARY: Record<Language, string> = {
  en: 'The reminder is set. You will be reminded at the time you chose.',
  de: 'Die Erinnerung ist eingetragen. Sie werden zum gewählten Zeitpunkt daran erinnert.',
  tr: 'Hatırlatma kaydedildi. Seçtiğiniz zamanda size hatırlatılacak.',
};

/**
 * A follow-up needs no model: it is a date the app will remind the user about.
 * Handled separately so it resolves instantly and works with no keys at all.
 */
export function scheduleResult(task: SecretaryTask): DocumentResult {
  return {
    status: 'scheduled',
    summary: SCHEDULED_SUMMARY[task.summaryLanguage],
    result: null,
    todo: task.goal,
    todoWhen: task.todoWhen,
    outcome: null,
  };
}

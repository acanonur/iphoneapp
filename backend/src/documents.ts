import Anthropic from '@anthropic-ai/sdk';
import type { CallOutcome, Language, SecretaryTask, TaskKind, TaskStatus } from './types.js';
import { LANGUAGE_NAMES } from './prompt.js';

/**
 * The paperwork side of the secretary: the letters, messages, forms and
 * follow-ups the app offers next to phone calls. These are text tasks, so they
 * are handled here with Claude rather than through the voice provider.
 */
export interface DocumentResult {
  status: TaskStatus;
  summary: string;
  /** The artefact produced: a reply draft, a translation, the filled form. */
  result: string | null;
  todo: string | null;
  todoWhen: string | null;
  outcome: CallOutcome | null;
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
} as const;

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
  apiKey: string,
  task: SecretaryTask,
): Promise<DocumentResult | null> {
  const instruction = INSTRUCTIONS[task.kind];
  if (!instruction) return null;

  const client = new Anthropic({ apiKey });
  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 2000,
      system:
        'You are a personal secretary for someone living in a country whose language they do not speak well. You read their official post, draft their replies and fill in their forms. Be factual and concrete; never invent personal data (dates of birth, insurance or reference numbers, addresses) that you were not given — mark anything missing so the user can fill it in.',
      output_config: { format: { type: 'json_schema', schema: DOCUMENT_SCHEMA } },
      messages: [
        {
          role: 'user',
          content: [
            `The user asked: ${task.goal}`,
            task.documentText
              ? `\nThe document they provided:\n${task.documentText}`
              : '\nThey did not attach a document, so work from the request alone.',
            '',
            instruction,
            '',
            `Write "summary" in ${LANGUAGE_NAMES[task.summaryLanguage]} — this is what the user reads.`,
            `Anything addressed to the other side ("result") goes in ${LANGUAGE_NAMES[task.language]}.`,
            'Write "todoWhen" as a short human date or time, or null.',
          ].join('\n'),
        },
      ],
    });

    if (response.stop_reason === 'refusal') return null;
    const text = response.content.find((b) => b.type === 'text')?.text;
    if (!text) return null;
    const parsed = JSON.parse(text) as DocumentReply;
    if (typeof parsed.summary !== 'string' || !parsed.summary.trim()) return null;

    return {
      status: RESULTING_STATUS[task.kind] ?? 'completed',
      summary: parsed.summary,
      result: parsed.result ?? null,
      todo: parsed.todo ?? null,
      todoWhen: parsed.todoWhen ?? null,
      outcome: task.kind === 'letter' ? 'achieved' : null,
    };
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error(`Claude document task failed (${error.status}): ${error.message}`);
    } else {
      console.error('Claude document task failed:', error);
    }
    return null;
  }
}

/**
 * What a document task resolves to with no Anthropic key configured — the same
 * shape the app renders, so the whole product is demoable offline. The wording
 * matches the states the design shows for each kind.
 */
type OfflineKind = 'letter' | 'message' | 'form' | 'followup';

const OFFLINE_SUMMARIES = {
  letter: {
    en: 'The letter is saved and waiting to be read. Add an Anthropic API key to the backend and the secretary will translate it and draft a reply.',
    de: 'Der Brief ist gespeichert und wartet auf die Auswertung. Mit einem Anthropic-API-Schlüssel übersetzt die Sekretärin ihn und entwirft eine Antwort.',
    tr: 'Mektup kaydedildi ve okunmayı bekliyor. Arka uca bir Anthropic API anahtarı eklerseniz sekreter mektubu çevirir ve bir yanıt taslağı hazırlar.',
  },
  message: {
    en: 'The request is saved as a draft, waiting for your approval before it is sent. Add an Anthropic API key to the backend and the secretary will write it for you.',
    de: 'Die Anfrage liegt als Entwurf bereit und wartet vor dem Versand auf Ihre Freigabe. Mit einem Anthropic-API-Schlüssel schreibt die Sekretärin sie für Sie.',
    tr: 'İstek taslak olarak kaydedildi; gönderilmeden önce onayınızı bekliyor. Arka uca bir Anthropic API anahtarı eklerseniz sekreter metni sizin için yazar.',
  },
  form: {
    en: 'The form is saved. Your details are still needed before it can be filled in — add an Anthropic API key to the backend and the secretary will complete what it can.',
    de: 'Das Formular ist gespeichert. Es fehlen noch Ihre Angaben — mit einem Anthropic-API-Schlüssel füllt die Sekretärin aus, was möglich ist.',
    tr: 'Form kaydedildi. Doldurulabilmesi için hâlâ bilgileriniz gerekiyor — arka uca bir Anthropic API anahtarı eklerseniz sekreter yapabildiği kadarını tamamlar.',
  },
  followup: {
    en: 'The follow-up is scheduled. You will be reminded on the day.',
    de: 'Die Erinnerung ist eingetragen. Sie werden am Tag daran erinnert.',
    tr: 'Takip planlandı. Gününde hatırlatılacak.',
  },
} satisfies Record<OfflineKind, Record<Language, string>>;

function offlineSummary(kind: TaskKind, language: Language): string {
  const key: OfflineKind =
    kind === 'letter' || kind === 'message' || kind === 'form' ? kind : 'followup';
  return OFFLINE_SUMMARIES[key][language];
}

export function offlineDocumentResult(task: SecretaryTask): DocumentResult {
  return {
    status: RESULTING_STATUS[task.kind] ?? 'completed',
    summary: offlineSummary(task.kind, task.summaryLanguage),
    result: null,
    todo: null,
    todoWhen: null,
    outcome: null,
  };
}

/**
 * A follow-up needs no model: it is a date the app will remind the user about.
 * Handled separately so it resolves instantly and works with no keys at all.
 */
export function scheduleResult(task: SecretaryTask): DocumentResult {
  return {
    status: 'scheduled',
    summary: offlineSummary('followup', task.summaryLanguage),
    result: null,
    todo: task.goal,
    todoWhen: task.todoWhen,
    outcome: null,
  };
}

export type Language = 'de' | 'en' | 'tr';

/**
 * What the user asked the secretary to do. `call` places a real phone call;
 * the rest are handled as text work (see documents.ts). `reminder` is created
 * by the app itself when the user turns a report's "still to do" into a nudge.
 */
export type TaskKind = 'call' | 'letter' | 'message' | 'form' | 'followup' | 'reminder';

export const TASK_KINDS: TaskKind[] = [
  'call',
  'letter',
  'message',
  'form',
  'followup',
  'reminder',
];

export type TaskStatus =
  | 'queued' // accepted, not yet started
  | 'dialing' // provider is placing the call
  | 'in_progress' // conversation is happening
  | 'completed' // finished; transcript and/or report available
  | 'failed' // could not be placed or errored
  | 'draft' // a message is written and waiting for the user's approval
  | 'needs_input' // the secretary needs details only the user has
  | 'scheduled'; // a follow-up or reminder is set for a date

/** Statuses no later event may move a task away from. */
export const TERMINAL_STATUSES: TaskStatus[] = [
  'completed',
  'failed',
  'draft',
  'needs_input',
  'scheduled',
];

export type CallOutcome =
  | 'achieved'
  | 'partially_achieved'
  | 'not_achieved'
  | 'no_answer'
  | 'unknown';

export interface SecretaryTask {
  id: string;
  deviceId: string;
  kind: TaskKind;
  /** What the user asked for, in their own words. */
  goal: string;
  /** E.164 destination — calls only; null for every other kind. */
  phoneNumber: string | null;
  /** Language the AI speaks on the call, or that a document is written in. */
  language: Language;
  /** Language the report/summary is written in for the user. */
  summaryLanguage: Language;
  userName: string | null;
  status: TaskStatus;
  providerCallId: string | null;
  /**
   * Text the user handed over with the task: the OCR of a letter, the contents
   * of a form. Never a photograph — only text leaves the phone.
   */
  documentText: string | null;
  transcript: string | null;
  /** The report the user reads, in `summaryLanguage`. */
  summary: string | null;
  /** What the secretary produced: a drafted reply, a translation. */
  result: string | null;
  /** The report's "still to do" line, and when it is due. */
  todo: string | null;
  todoWhen: string | null;
  outcome: CallOutcome | null;
  /** How long the call lasted, once it has ended. Calls only. */
  durationSeconds: number | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StartCallResult {
  providerCallId: string;
}

export interface CallProvider {
  readonly name: string;
  startCall(task: SecretaryTask): Promise<StartCallResult>;
}

/** Callback a provider uses to push call-state changes back into the app. */
export type TaskUpdateHandler = (taskId: string, patch: Partial<SecretaryTask>) => void;

export type Language = 'de' | 'en' | 'tr';

export const LANGUAGES: Language[] = ['de', 'en', 'tr'];

export function isLanguage(value: unknown): value is Language {
  return value === 'de' || value === 'en' || value === 'tr';
}

/**
 * What the user asked the secretary to do. `call` is a phone call (placed for
 * the user, or answered for them — see `direction`); the rest are handled as
 * text work (see documents.ts). `reminder` is created by the app itself when
 * the user turns a report's "still to do" into a nudge.
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

/** A call that is still going on, or about to. */
export const ACTIVE_CALL_STATUSES: TaskStatus[] = ['queued', 'dialing', 'in_progress'];

export type CallOutcome =
  | 'achieved'
  | 'partially_achieved'
  | 'not_achieved'
  | 'no_answer'
  | 'unknown';

/** `outbound`: the secretary called someone. `inbound`: it answered for the user. */
export type CallDirection = 'outbound' | 'inbound';

/**
 * One turn of a call. `assistant` is the AI secretary; `other` is whoever is
 * on the line with it — the office that was called, or the person who rang.
 */
export interface TranscriptLine {
  role: 'assistant' | 'other';
  text: string;
}

/**
 * Why a call did not work out, as a code the app can put into the user's own
 * language. `error` keeps the provider's raw wording for the server log and
 * for whoever runs the server.
 */
export type CallErrorCode =
  | 'no_answer' // rang out
  | 'busy'
  | 'declined' // the other side rejected the call
  | 'voicemail' // a mailbox or a phone menu answered, not a person
  | 'invalid_number'
  | 'blocked' // the carrier or the number's permissions refused the destination
  | 'provider_account' // credit, concurrency or payment problem at the provider
  | 'provider_error' // the provider could not place the call at all
  | 'technical' // the call was cut off by a technical fault
  | 'cancelled' // the user ended it
  | 'limit_reached' // this server's own daily cap
  | 'reports_off' // paperwork needs the AI report writer, and none is set up
  | 'report_failed'; // the AI report writer was asked and did not deliver

/** Where the report text came from — decides what may replace it later. */
export type SummarySource = 'claude' | 'provider' | 'placeholder' | 'script';

export interface SecretaryTask {
  id: string;
  deviceId: string;
  kind: TaskKind;
  /**
   * What the user asked for, in their own words. For an answered (inbound)
   * call it is the subject the secretary wrote down: who rang and why.
   */
  goal: string;
  /** Calls only: the number dialled, or the caller's number. */
  phoneNumber: string | null;
  /** Language the AI speaks on the call, or that a document is written in. */
  language: Language;
  /** Language the report/summary is written in for the user. */
  summaryLanguage: Language;
  userName: string | null;
  status: TaskStatus;
  direction: CallDirection;
  /** True when no real phone call happened — the built-in simulator ran it. */
  simulated: boolean;
  providerCallId: string | null;
  /**
   * Text the user handed over with the task: the OCR of a letter, the contents
   * of a form. Never a photograph — only text leaves the phone.
   */
  documentText: string | null;
  /** The call so far, turn by turn. Grows while the call is in progress. */
  lines: TranscriptLine[];
  /** The same conversation as plain text, one "Speaker: words" line per turn. */
  transcript: string | null;
  /** The report the user reads, in `summaryLanguage`. */
  summary: string | null;
  summarySource: SummarySource | null;
  /** What the secretary produced: a drafted reply, a translation. */
  result: string | null;
  /** The report's "still to do" line, and when it is due. */
  todo: string | null;
  todoWhen: string | null;
  outcome: CallOutcome | null;
  /** How long the call lasted, once it has ended. Calls only. */
  durationSeconds: number | null;
  error: string | null;
  errorCode: CallErrorCode | null;
  createdAt: string;
  updatedAt: string;
}

/** What the secretary needs to know about the person it works for. */
export interface Profile {
  deviceId: string;
  name: string | null;
  /** The language the owner reads reports in. */
  language: Language;
  /**
   * The language most of the owner's callers speak — that of the country they
   * live in, which is usually not their own. An answered call is greeted in
   * it. Null: not said yet; the owner's own language is used.
   */
  callLanguage: Language | null;
  /** Whether the secretary should pick up calls the owner cannot take. */
  answerCalls: boolean;
  /**
   * Whether answering was switched on while this server placed real calls —
   * that is, after the app had asked the owner whether the phone service may
   * have their callers. Switched on while calls were only simulated, it is
   * not carried over to real calls: the owner is asked first.
   */
  answerCallsReal: boolean;
  /** Anything the owner wants callers told, in their own words. */
  answerNote: string | null;
  updatedAt: string;
}

export interface StartCallResult {
  providerCallId: string;
}

export interface CallProvider {
  readonly name: string;
  /** True when calls are simulated rather than placed on the phone network. */
  readonly simulated: boolean;
  startCall(task: SecretaryTask): Promise<StartCallResult>;
  /** Hangs up a call that is still going on. */
  stopCall?(task: SecretaryTask): Promise<void>;
}

/** Callback a provider uses to push call-state changes back into the app. */
export type TaskUpdateHandler = (taskId: string, patch: Partial<SecretaryTask>) => void;

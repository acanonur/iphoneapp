export type Language = 'de' | 'en' | 'tr';

export type CallStatus =
  | 'queued'       // accepted, not yet dialing
  | 'dialing'      // provider is placing the call
  | 'in_progress'  // conversation is happening
  | 'completed'    // call finished, transcript available
  | 'failed';      // could not be placed or errored

export type CallOutcome =
  | 'achieved'
  | 'partially_achieved'
  | 'not_achieved'
  | 'no_answer'
  | 'unknown';

export interface CallTask {
  id: string;
  deviceId: string;
  goal: string;
  phoneNumber: string;
  /** Language the AI speaks on the call. */
  language: Language;
  /** Language the report/summary is written in for the user. */
  summaryLanguage: Language;
  userName: string | null;
  status: CallStatus;
  providerCallId: string | null;
  transcript: string | null;
  summary: string | null;
  outcome: CallOutcome | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StartCallResult {
  providerCallId: string;
}

export interface CallProvider {
  readonly name: string;
  startCall(task: CallTask): Promise<StartCallResult>;
}

/** Callback a provider uses to push call-state changes back into the app. */
export type CallUpdateHandler = (taskId: string, patch: Partial<CallTask>) => void;

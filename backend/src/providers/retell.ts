import Retell from 'retell-sdk';
import type {
  CallErrorCode,
  CallOutcome,
  CallProvider,
  SecretaryTask,
  StartCallResult,
  TranscriptLine,
} from '../types.js';
import type { RetellConfig } from '../config.js';
import { buildAgentVariables, disclosureLine, VOICE_LOCALES } from '../prompt.js';
import { textToLines, tidyLines } from '../transcript.js';

/** The events this backend asks Retell for. `transcript_updated` is opt-in. */
export const WEBHOOK_EVENTS = [
  'call_started',
  'call_ended',
  'call_analyzed',
  'transcript_updated',
] as const;

export interface RetellProviderOptions {
  /** Where Retell should deliver this call's events, if this server is reachable. */
  webhookUrl: () => string | null;
  maxCallMinutes: number;
  /** Replaces the network layer in tests. */
  fetch?: typeof fetch;
  log?: (message: string) => void;
}

/**
 * Places and controls phone calls through Retell AI (https://docs.retellai.com).
 *
 * Needs, once (scripts/retell-setup.ts does it):
 *  - an agent whose prompt is AGENT_PROMPT_TEMPLATE from prompt.ts
 *  - a phone number bought in, or imported into, Retell (RETELL_FROM_NUMBER)
 *
 * Everything that varies per call — language, where events go, the live
 * transcript, the time limit, the opening sentence — is sent with the call, so
 * nothing has to be kept in step by hand in the Retell dashboard.
 */
export class RetellProvider implements CallProvider {
  readonly name = 'retell';
  readonly simulated = false;
  private readonly cfg: RetellConfig;
  private readonly options: RetellProviderOptions;
  private readonly client: Retell;

  constructor(cfg: RetellConfig, options: RetellProviderOptions) {
    this.cfg = cfg;
    this.options = options;
    this.client = new Retell({
      apiKey: cfg.apiKey,
      ...(options.fetch ? { fetch: options.fetch } : {}),
    });
  }

  private agentIdFor(task: SecretaryTask): string {
    return this.cfg.agentIds[task.language] ?? this.cfg.agentId;
  }

  /** The request without any per-call settings: what an agent set up by hand needs. */
  private baseParams(task: SecretaryTask, to: string): Retell.CallCreatePhoneCallParams {
    return {
      from_number: this.cfg.fromNumber,
      to_number: to,
      override_agent_id: this.agentIdFor(task),
      retell_llm_dynamic_variables: buildAgentVariables(task),
      metadata: { task_id: task.id },
      // Lets a retried request reach the same call instead of dialling twice.
      idempotency_key: task.id,
    };
  }

  private overrides(task: SecretaryTask): Retell.CallCreatePhoneCallParams.AgentOverride {
    const webhookUrl = this.options.webhookUrl();
    return {
      agent: {
        language: VOICE_LOCALES[task.language],
        webhook_events: [...WEBHOOK_EVENTS],
        ...(webhookUrl ? { webhook_url: webhookUrl } : {}),
        max_call_duration_ms: Math.round(this.options.maxCallMinutes * 60_000),
        // Long enough for "one moment, I'll check the calendar"; short enough
        // not to sit on a dead line for the ten minutes Retell allows by default.
        end_call_after_silence_ms: 90_000,
        // A mailbox answered: end the call, leave no message.
        voicemail_option: { action: { type: 'hangup' } },
        ...(this.cfg.deleteAfterCall ? { data_storage_retention_days: 1 } : {}),
      },
      retell_llm: {
        // The AI disclosure is spoken by the platform itself, word for word,
        // before the model says anything.
        start_speaker: 'agent',
        begin_message: disclosureLine(task.language, task.userName),
      },
    };
  }

  async startCall(task: SecretaryTask): Promise<StartCallResult> {
    if (!task.phoneNumber) {
      throw new Error('Cannot place a call for a task without a phone number');
    }
    const base = this.baseParams(task, task.phoneNumber);

    let call: Retell.PhoneCallResponse;
    if (this.cfg.sendOverrides) {
      try {
        call = await this.client.call.createPhoneCall({
          ...base,
          agent_override: this.overrides(task),
        });
      } catch (error) {
        // An agent this backend did not create may not accept every per-call
        // setting (a Conversation Flow agent has no begin message to override).
        // Its own dashboard settings then apply — better than no call at all.
        if (!(error instanceof Retell.BadRequestError) && !isUnprocessable(error)) throw error;
        this.options.log?.(
          `Retell rejected the per-call settings (${describeError(error)}); placing the call with the agent's own settings`,
        );
        call = await this.client.call.createPhoneCall({
          ...base,
          idempotency_key: `${task.id}-plain`,
        });
      }
    } else {
      call = await this.client.call.createPhoneCall(base);
    }

    if (!call.call_id) {
      throw new Error('Retell create-phone-call returned no call_id');
    }
    return { providerCallId: call.call_id };
  }

  async stopCall(task: SecretaryTask): Promise<void> {
    if (!task.providerCallId) return;
    await this.client.call.stop(task.providerCallId);
  }

  /** The call as Retell has it now — used to recover from a missed webhook. */
  async getCall(callId: string): Promise<RetellCall> {
    return (await this.client.call.retrieve(callId)) as RetellCall;
  }

  /** Removes the call and everything Retell stored for it, the recording included. */
  async deleteCall(callId: string): Promise<void> {
    await this.client.call.delete(callId);
  }

  /**
   * Points the phone number at the answering agent, or takes the agent off it.
   * With no agent bound, Retell does not pick up calls to the number.
   */
  async setInboundAnswering(enabled: boolean, inboundWebhookUrl: string | null): Promise<void> {
    if (!this.cfg.inboundAgentId) {
      throw new Error('No answering agent is configured (RETELL_INBOUND_AGENT_ID)');
    }
    await this.client.phoneNumber.update(this.cfg.fromNumber, {
      inbound_agents: enabled ? [{ agent_id: this.cfg.inboundAgentId, weight: 1 }] : null,
      inbound_webhook_url: enabled ? inboundWebhookUrl : null,
    });
    if (enabled && inboundWebhookUrl) {
      await this.client.agent.update(this.cfg.inboundAgentId, {
        webhook_url: inboundWebhookUrl,
        webhook_events: [...WEBHOOK_EVENTS],
      });
    }
  }

  get canAnswerCalls(): boolean {
    return this.cfg.inboundAgentId !== null;
  }
}

function isUnprocessable(error: unknown): boolean {
  return error instanceof Retell.UnprocessableEntityError;
}

export function describeError(error: unknown): string {
  if (error instanceof Retell.APIError) {
    return `${error.status ?? 'network'}: ${error.message}`;
  }
  return error instanceof Error ? error.message : String(error);
}

// MARK: - Webhook payloads

/**
 * The fields of Retell's call object this backend reads. Deliberately loose:
 * the payload comes from outside, and Retell adds fields and values over time.
 */
export interface RetellCall {
  call_id?: string;
  call_status?: string;
  direction?: string;
  from_number?: string;
  to_number?: string;
  agent_id?: string;
  disconnection_reason?: string;
  transcript?: string;
  transcript_object?: Array<{ role?: string; content?: string }>;
  duration_ms?: number;
  start_timestamp?: number;
  end_timestamp?: number;
  metadata?: { task_id?: string } | null;
  call_analysis?: {
    call_summary?: string;
    call_successful?: boolean;
    in_voicemail?: boolean;
  } | null;
}

/** A call event: `{ event, call }`. Older Retell samples carry the call under `data`. */
export interface RetellCallEvent {
  event?: string;
  call?: RetellCall;
  data?: RetellCall;
}

/** Sent before an incoming call is answered, to ask how it should be handled. */
export interface RetellInboundEvent {
  event?: 'call_inbound' | string;
  call_inbound?: {
    call_id?: string;
    agent_id?: string;
    from_number?: string;
    to_number?: string;
  };
}

export type RetellWebhookBody = RetellCallEvent & RetellInboundEvent;

/** The turns of the conversation, from the structured transcript where there is one. */
export function linesFromCall(call: RetellCall): TranscriptLine[] {
  if (Array.isArray(call.transcript_object) && call.transcript_object.length > 0) {
    return tidyLines(
      call.transcript_object.flatMap((utterance): TranscriptLine[] => {
        if (typeof utterance?.content !== 'string') return [];
        return [
          { role: utterance.role === 'agent' ? 'assistant' : 'other', text: utterance.content },
        ];
      }),
    );
  }
  if (typeof call.transcript === 'string' && call.transcript.trim()) {
    return tidyLines(textToLines(call.transcript));
  }
  return [];
}

export function callDurationSeconds(call: RetellCall): number | null {
  if (typeof call.duration_ms === 'number' && call.duration_ms >= 0) {
    return Math.round(call.duration_ms / 1000);
  }
  if (
    typeof call.start_timestamp === 'number' &&
    typeof call.end_timestamp === 'number' &&
    call.end_timestamp >= call.start_timestamp
  ) {
    return Math.round((call.end_timestamp - call.start_timestamp) / 1000);
  }
  return null;
}

// MARK: - Why a call ended

/** The call never reached a person, and why. */
const NEVER_CONNECTED: Record<string, CallErrorCode> = {
  dial_no_answer: 'no_answer',
  registered_call_timeout: 'no_answer',
  error_user_not_joined: 'no_answer',
  dial_busy: 'busy',
  user_declined: 'declined',
  invalid_destination: 'invalid_number',
  telephony_provider_permission_denied: 'blocked',
  marked_as_spam: 'blocked',
  network_blocked: 'blocked',
  scam_detected: 'blocked',
  concurrency_limit_reached: 'provider_account',
  no_concurrency_fallback: 'provider_account',
  no_valid_payment: 'provider_account',
  credit_exhausted: 'provider_account',
  budget_reached: 'provider_account',
  dial_failed: 'provider_error',
  telephony_provider_unavailable: 'provider_error',
  sip_routing_error: 'provider_error',
};

/** A machine picked up instead of a person. */
const MACHINE_ANSWERED = new Set(['voicemail_reached', 'ivr_reached']);

export interface CallEnding {
  /** `completed`: a conversation took place. `failed`: there is nothing to report on. */
  status: 'completed' | 'failed';
  errorCode: CallErrorCode | null;
  outcome: CallOutcome | null;
  /** The provider's own wording, for the log and for whoever runs the server. */
  error: string | null;
}

/**
 * Decides what the end of a call means. Retell names 39 reasons today and adds
 * more with most releases, so a reason this code has never seen is judged by
 * the evidence: was the call ever connected, and did anybody say anything.
 */
export function classifyEnding(
  call: RetellCall,
  evidence: { hadConversation: boolean; wasConnected: boolean },
): CallEnding {
  const reason = call.disconnection_reason ?? '';
  const failed = (errorCode: CallErrorCode, outcome: CallOutcome): CallEnding => ({
    status: 'failed',
    errorCode,
    outcome,
    error: `Call not connected (${reason || call.call_status || 'no reason given'})`,
  });

  const neverConnected = NEVER_CONNECTED[reason];
  if (neverConnected) {
    const rangOut = ['no_answer', 'busy', 'declined'].includes(neverConnected);
    return failed(neverConnected, rangOut ? 'no_answer' : 'unknown');
  }

  if (MACHINE_ANSWERED.has(reason) || call.call_analysis?.in_voicemail === true) {
    return failed('voicemail', 'no_answer');
  }

  if (reason.startsWith('error_')) {
    // A technical fault. If people had already been talking, the part of the
    // conversation that exists is still worth a report.
    return evidence.hadConversation
      ? {
          status: 'completed',
          errorCode: 'technical',
          outcome: null,
          error: `Call cut off (${reason})`,
        }
      : failed('technical', 'unknown');
  }

  if (!evidence.hadConversation) {
    if (call.call_status === 'not_connected' || !evidence.wasConnected) {
      return failed('provider_error', 'unknown');
    }
    // Connected, and then nobody spoke.
    return failed('no_answer', 'no_answer');
  }

  return { status: 'completed', errorCode: null, outcome: null, error: null };
}

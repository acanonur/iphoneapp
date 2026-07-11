import type { CallProvider, CallTask, StartCallResult } from '../types.js';
import type { RetellConfig } from '../config.js';
import { buildAgentVariables } from '../prompt.js';

const RETELL_API_BASE = 'https://api.retellai.com';

/**
 * Places outbound calls through Retell AI (https://docs.retellai.com).
 *
 * Prerequisites (see README):
 *  - a Retell agent configured with the prompt in docs/retell-agent-prompt.md,
 *    referencing the dynamic variables {{disclosure}}, {{goal}}, {{user_name}},
 *    {{language_name}}
 *  - a phone number purchased/imported in Retell (RETELL_FROM_NUMBER)
 *  - the agent's webhook pointed at POST {BASE_URL}/webhooks/retell/{WEBHOOK_SECRET}
 */
export class RetellProvider implements CallProvider {
  readonly name = 'retell';
  private readonly cfg: RetellConfig;

  constructor(cfg: RetellConfig) {
    this.cfg = cfg;
  }

  private agentIdFor(task: CallTask): string {
    return this.cfg.agentIds[task.language] ?? this.cfg.agentId;
  }

  async startCall(task: CallTask): Promise<StartCallResult> {
    const res = await fetch(`${RETELL_API_BASE}/v2/create-phone-call`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.cfg.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from_number: this.cfg.fromNumber,
        to_number: task.phoneNumber,
        override_agent_id: this.agentIdFor(task),
        retell_llm_dynamic_variables: buildAgentVariables(task),
        metadata: { task_id: task.id },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Retell create-phone-call failed (${res.status}): ${body}`);
    }

    const data = (await res.json()) as { call_id?: string };
    if (!data.call_id) {
      throw new Error('Retell create-phone-call returned no call_id');
    }
    return { providerCallId: data.call_id };
  }
}

/** Shape of the Retell webhook payload fields this backend consumes. */
export interface RetellWebhookBody {
  event?: 'call_started' | 'call_ended' | 'call_analyzed' | string;
  call?: {
    call_id?: string;
    call_status?: string;
    disconnection_reason?: string;
    transcript?: string;
    metadata?: { task_id?: string };
    call_analysis?: {
      call_summary?: string;
      call_successful?: boolean;
    };
  };
}

const DIAL_FAILURE_REASONS = new Set([
  'dial_failed',
  'dial_busy',
  'dial_no_answer',
  'invalid_destination',
  'error',
]);

export function isDialFailure(reason: string | undefined): boolean {
  if (!reason) return false;
  return DIAL_FAILURE_REASONS.has(reason) || reason.startsWith('error');
}

import Anthropic from '@anthropic-ai/sdk';
import type { CallOutcome, CallTask, Language } from './types.js';
import { LANGUAGE_NAMES } from './prompt.js';

export interface CallReport {
  summary: string;
  outcome: CallOutcome;
}

const OUTCOMES: CallOutcome[] = [
  'achieved',
  'partially_achieved',
  'not_achieved',
  'no_answer',
  'unknown',
];

const REPORT_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    outcome: { type: 'string', enum: OUTCOMES },
  },
  required: ['summary', 'outcome'],
  additionalProperties: false,
} as const;

/**
 * Summarizes the finished call in the user's own language with Claude.
 * Returns null on any failure so the caller can fall back gracefully.
 */
export async function summarizeCall(
  apiKey: string,
  task: CallTask,
  transcript: string,
): Promise<CallReport | null> {
  const client = new Anthropic({ apiKey });
  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1500,
      system:
        'You write short reports about phone calls that an AI secretary made on behalf of a user who does not speak the local language well. Be factual; never invent details that are not in the transcript.',
      output_config: { format: { type: 'json_schema', schema: REPORT_SCHEMA } },
      messages: [
        {
          role: 'user',
          content: [
            `The user's goal for this call was: ${task.goal}`,
            `The call was conducted in ${LANGUAGE_NAMES[task.language]}.`,
            '',
            'Call transcript:',
            transcript,
            '',
            `Write "summary" in ${LANGUAGE_NAMES[task.summaryLanguage]} (2-4 short sentences aimed at the user: what happened, what was agreed — include any date, time, place, price or reference number — and what the user still needs to do).`,
            'Set "outcome" to how well the goal was achieved.',
          ].join('\n'),
        },
      ],
    });

    if (response.stop_reason === 'refusal') return null;
    const text = response.content.find((b) => b.type === 'text')?.text;
    if (!text) return null;
    const parsed = JSON.parse(text) as CallReport;
    if (typeof parsed.summary !== 'string' || !OUTCOMES.includes(parsed.outcome)) {
      return null;
    }
    return parsed;
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error(`Claude summary failed (${error.status}): ${error.message}`);
    } else {
      console.error('Claude summary failed:', error);
    }
    return null;
  }
}

/** Used when no Anthropic key is configured or the summary call failed. */
export function fallbackSummary(language: Language): string {
  switch (language) {
    case 'de':
      return 'Der Anruf ist beendet. Ein KI-Bericht ist gerade nicht verfügbar — das vollständige Gesprächsprotokoll steht unten.';
    case 'tr':
      return 'Arama tamamlandı. Yapay zeka özeti şu anda kullanılamıyor — görüşmenin tam dökümü aşağıdadır.';
    case 'en':
      return 'The call has finished. An AI report is not available right now — the full transcript is below.';
  }
}

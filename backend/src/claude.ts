import Anthropic from '@anthropic-ai/sdk';

export interface ClaudeSettings {
  apiKey: string;
  model: string;
}

export interface JsonRequest {
  system: string;
  prompt: string;
  /** JSON Schema the answer must follow. */
  schema: { [key: string]: unknown };
  /** How much thought the task deserves; a call summary needs little. */
  effort: 'low' | 'medium' | 'high';
  /** Shown in the log when the request fails. */
  purpose: string;
}

/**
 * When the main model declines a request, the API re-runs it on this one
 * inside the same call. A secretary reads official letters about debt, health
 * and immigration; a refusal there would leave the user with nothing.
 */
const FALLBACK_BETA = 'server-side-fallback-2026-06-01';
const FALLBACK_MODEL = 'claude-opus-4-8';
const MODEL_WITH_FALLBACK = 'claude-opus-5-5';

const MAX_TOKENS = 16_000;

/** The JSON the model wrote: the last text block of the answer. */
function answerText(content: ReadonlyArray<{ type: string; text?: string }>): string | null {
  for (let index = content.length - 1; index >= 0; index -= 1) {
    const block = content[index];
    if (block?.type === 'text' && typeof block.text === 'string') return block.text;
  }
  return null;
}

/**
 * Asks Claude for an answer in a fixed JSON shape. Returns null on any
 * failure — a refusal, a timeout, a bad key — so the caller can fall back to
 * something useful instead of leaving a task stuck.
 */
export async function askForJson(
  settings: ClaudeSettings,
  request: JsonRequest,
): Promise<unknown | null> {
  const client = new Anthropic({ apiKey: settings.apiKey, timeout: 90_000, maxRetries: 2 });
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: request.prompt }];
  const outputConfig = {
    effort: request.effort,
    format: { type: 'json_schema' as const, schema: request.schema },
  };

  try {
    let response: { stop_reason: string | null; content: ReadonlyArray<{ type: string; text?: string }> };
    const plain = () =>
      client.messages.create({
        model: settings.model,
        max_tokens: MAX_TOKENS,
        system: request.system,
        messages,
        output_config: outputConfig,
      });

    if (settings.model === MODEL_WITH_FALLBACK) {
      try {
        response = await client.beta.messages.create({
          model: settings.model,
          max_tokens: MAX_TOKENS,
          system: request.system,
          messages,
          output_config: outputConfig,
          betas: [FALLBACK_BETA],
          fallbacks: [{ model: FALLBACK_MODEL }],
        });
      } catch (error) {
        // The fallback option is a beta; if the API turns the request down as
        // malformed, ask again the ordinary way rather than give up.
        if (!(error instanceof Anthropic.BadRequestError)) throw error;
        console.warn(`Claude ${request.purpose}: retrying without the fallback option (${error.message})`);
        response = await plain();
      }
    } else {
      response = await plain();
    }

    if (response.stop_reason === 'refusal') {
      console.warn(`Claude ${request.purpose}: the request was declined`);
      return null;
    }
    if (response.stop_reason === 'max_tokens') {
      console.warn(`Claude ${request.purpose}: the answer was cut off`);
      return null;
    }
    const text = answerText(response.content);
    if (!text) return null;
    return JSON.parse(text) as unknown;
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      console.error(`Claude ${request.purpose} failed: the Anthropic API key was not accepted`);
    } else if (error instanceof Anthropic.RateLimitError) {
      console.error(`Claude ${request.purpose} failed: rate limited`);
    } else if (error instanceof Anthropic.APIError) {
      console.error(`Claude ${request.purpose} failed (${error.status}): ${error.message}`);
    } else {
      console.error(`Claude ${request.purpose} failed:`, error);
    }
    return null;
  }
}

import type { Language } from './types.js';

export interface RetellConfig {
  apiKey: string;
  fromNumber: string;
  /** Default agent, used when no per-language agent is configured. */
  agentId: string;
  /** Optional per-language agent overrides. */
  agentIds: Partial<Record<Language, string>>;
}

export interface Config {
  port: number;
  host: string;
  dbPath: string;
  provider: 'mock' | 'retell';
  /** Shared secret embedded in the webhook URL path. */
  webhookSecret: string;
  /** Destinations the backend is willing to dial, by E.164 prefix. */
  allowedCountryPrefixes: string[];
  retell: RetellConfig | null;
  anthropicApiKey: string | null;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const provider = env.CALL_PROVIDER === 'retell' ? 'retell' : 'mock';

  let retell: RetellConfig | null = null;
  if (provider === 'retell') {
    const apiKey = env.RETELL_API_KEY;
    const fromNumber = env.RETELL_FROM_NUMBER;
    const agentId = env.RETELL_AGENT_ID;
    if (!apiKey || !fromNumber || !agentId) {
      throw new Error(
        'CALL_PROVIDER=retell requires RETELL_API_KEY, RETELL_FROM_NUMBER and RETELL_AGENT_ID',
      );
    }
    retell = {
      apiKey,
      fromNumber,
      agentId,
      agentIds: {
        de: env.RETELL_AGENT_ID_DE || undefined,
        en: env.RETELL_AGENT_ID_EN || undefined,
        tr: env.RETELL_AGENT_ID_TR || undefined,
      },
    };
  }

  return {
    port: Number(env.PORT ?? 8787),
    host: env.HOST ?? '0.0.0.0',
    dbPath: env.DB_PATH ?? './data/calls.db',
    provider,
    webhookSecret: env.WEBHOOK_SECRET ?? 'dev-webhook-secret-change-me',
    allowedCountryPrefixes: (env.ALLOWED_COUNTRY_PREFIXES ?? '+49,+90,+44,+1')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean),
    retell,
    anthropicApiKey: env.ANTHROPIC_API_KEY || null,
  };
}

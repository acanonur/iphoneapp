import type { Language } from './types.js';

export interface RetellConfig {
  apiKey: string;
  /**
   * The key Retell signs webhooks with. Normally the same as `apiKey`; a
   * workspace with several keys signs with the one marked for webhooks.
   */
  webhookKey: string;
  fromNumber: string;
  /** Default agent, used when no per-language agent is configured. */
  agentId: string;
  /** Optional per-language agent overrides. */
  agentIds: Partial<Record<Language, string>>;
  /** The agent that answers calls for the owner, if answering is set up. */
  inboundAgentId: string | null;
  /** Check the signature Retell puts on every webhook. Leave on. */
  verifySignature: boolean;
  /**
   * Send the per-call settings (language, webhook address, live transcript,
   * time limit) with each call. Off means the agent's dashboard settings apply.
   */
  sendOverrides: boolean;
  /** Delete the call — recording included — at Retell once the report is saved. */
  deleteAfterCall: boolean;
}

export interface Config {
  port: number;
  host: string;
  dbPath: string;
  provider: 'mock' | 'retell';
  /**
   * The access key the app must send. Null means "make one up on first start
   * and keep it in the database" — nobody has to invent a secret.
   */
  apiKey: string | null;
  /** `auto`: a key is needed as soon as anything real or paid for is switched on. */
  requireKey: 'auto' | 'always' | 'never';
  /** Second factor in the webhook address. Null: generated and kept, like the key. */
  webhookSecret: string | null;
  /** Where this server can be reached from the internet, e.g. https://x.example.com */
  publicBaseUrl: string | null;
  /** Destinations the backend is willing to dial, by E.164 prefix. */
  allowedCountryPrefixes: string[];
  /** Real outbound calls allowed per rolling 24 hours. 0 switches the cap off. */
  maxCallsPerDay: number;
  /** Hard time limit for one call. */
  maxCallMinutes: number;
  retell: RetellConfig | null;
  anthropicApiKey: string | null;
  anthropicModel: string;
  /** Speed of the simulated call: 1 is real time, 0.1 is ten times faster. */
  mockPace: number;
  /** Announce the server on the local network so the app can find it. */
  advertise: boolean;
  /** Open a public tunnel on start (needs `cloudflared`). */
  tunnel: boolean;
}

function flag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return !['0', 'false', 'no', 'off'].includes(value.trim().toLowerCase());
}

function positiveNumber(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function cleanUrl(value: string | undefined): string | null {
  const trimmed = value?.trim().replace(/\/+$/, '');
  return trimmed ? trimmed : null;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const provider = env.CALL_PROVIDER === 'retell' ? 'retell' : 'mock';

  let retell: RetellConfig | null = null;
  if (provider === 'retell') {
    const apiKey = env.RETELL_API_KEY?.trim();
    const fromNumber = env.RETELL_FROM_NUMBER?.trim();
    const agentId = env.RETELL_AGENT_ID?.trim();
    if (!apiKey || !fromNumber || !agentId) {
      throw new Error(
        'CALL_PROVIDER=retell requires RETELL_API_KEY, RETELL_FROM_NUMBER and RETELL_AGENT_ID',
      );
    }
    retell = {
      apiKey,
      webhookKey: env.RETELL_WEBHOOK_KEY?.trim() || apiKey,
      fromNumber,
      agentId,
      agentIds: {
        de: env.RETELL_AGENT_ID_DE?.trim() || undefined,
        en: env.RETELL_AGENT_ID_EN?.trim() || undefined,
        tr: env.RETELL_AGENT_ID_TR?.trim() || undefined,
      },
      inboundAgentId: env.RETELL_INBOUND_AGENT_ID?.trim() || null,
      verifySignature: flag(env.RETELL_VERIFY_SIGNATURE, true),
      sendOverrides: flag(env.RETELL_SEND_OVERRIDES, true),
      deleteAfterCall: flag(env.RETELL_DELETE_AFTER_CALL, true),
    };
  }

  const requireKey =
    env.REQUIRE_KEY === 'always' || env.REQUIRE_KEY === 'never' ? env.REQUIRE_KEY : 'auto';

  return {
    port: Number(env.PORT ?? 8787),
    host: env.HOST ?? '0.0.0.0',
    dbPath: env.DB_PATH ?? './data/calls.db',
    provider,
    apiKey: env.API_KEY?.trim() || null,
    requireKey,
    webhookSecret: env.WEBHOOK_SECRET?.trim() || null,
    publicBaseUrl: cleanUrl(env.PUBLIC_BASE_URL),
    allowedCountryPrefixes: (env.ALLOWED_COUNTRY_PREFIXES ?? '+49,+90,+44,+1')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean),
    maxCallsPerDay: Math.floor(positiveNumber(env.MAX_CALLS_PER_DAY, 20)),
    maxCallMinutes: Math.min(120, Math.max(1, positiveNumber(env.MAX_CALL_MINUTES, 10))),
    retell,
    anthropicApiKey: env.ANTHROPIC_API_KEY?.trim() || null,
    anthropicModel: env.ANTHROPIC_MODEL?.trim() || 'claude-opus-5-5',
    mockPace: positiveNumber(env.MOCK_PACE, 1),
    advertise: flag(env.ADVERTISE, true),
    tunnel: flag(env.TUNNEL, false),
  };
}

/**
 * Whether the app has to present the access key. With `auto`, a server that
 * only simulates calls and writes nothing with a paid model stays open, so a
 * first try on the home network needs no setup at all; the moment real calls,
 * a paid model or a public address are involved, the key is required.
 */
export function keyRequired(config: Config): boolean {
  if (config.requireKey === 'always') return true;
  if (config.requireKey === 'never') return false;
  return (
    config.provider === 'retell' ||
    config.anthropicApiKey !== null ||
    config.publicBaseUrl !== null ||
    config.tunnel
  );
}

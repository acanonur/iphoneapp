export interface Config {
  port: number;
  host: string;
  dbPath: string;
  /**
   * Allowed browser origins. The phone apps don't need CORS, but the web
   * fallback and local development do.
   */
  corsOrigins: string[];
  /**
   * When set, joining a space also requires this secret. Stops a stranger who
   * guesses an invite code from walking in; leave unset for a private network.
   */
  signupSecret: string | null;
  /** Largest WhatsApp export accepted, in bytes. */
  maxImportBytes: number;
  /** Enables the link-preview fetcher, which makes outbound HTTP requests. */
  linkPreviews: boolean;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: Number(env.PORT ?? 8788),
    host: env.HOST ?? '0.0.0.0',
    dbPath: env.DB_PATH ?? './data/ortak.db',
    corsOrigins: (env.CORS_ORIGINS ?? '*')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    signupSecret: env.SIGNUP_SECRET || null,
    maxImportBytes: Number(env.MAX_IMPORT_BYTES ?? 25 * 1024 * 1024),
    linkPreviews: env.LINK_PREVIEWS !== 'false',
  };
}

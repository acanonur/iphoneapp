import type { DatabaseSync } from 'node:sqlite';
import type { Config } from './config.js';
import type { Store, AuthenticatedUser } from './db.js';
import type { SyncEngine } from './sync.js';
import type { SearchIndex } from './search.js';
import type { Hub } from './hub.js';

export interface Ctx {
  config: Config;
  db: DatabaseSync;
  store: Store;
  sync: SyncEngine;
  search: SearchIndex;
  hub: Hub;
}

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by the auth preHandler on every /api route except join/health. */
    user: AuthenticatedUser;
  }
}

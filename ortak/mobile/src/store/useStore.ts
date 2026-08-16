/**
 * The app's single source of truth.
 *
 * Offline-first by design, because the two places this app gets used most are a
 * supermarket basement and a holiday abroad:
 *
 *  - every edit lands in local state immediately and is queued in `pending`
 *  - the queue is flushed whenever there is a connection, and survives restarts
 *  - the server's reply tells us what was accepted; anything the server had a
 *    newer version of is dropped from the queue and the server's copy is kept
 *
 * The chat archive is deliberately *not* mirrored onto the phone. A five-year
 * group chat is tens of thousands of rows, and holding it locally would make
 * every sync slow to serve a screen that is nearly always used online anyway.
 * The archive tab talks to the server directly.
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError, OrtakApi, normaliseServerUrl, type Session } from '../api/client.js';
import { ENTITY_KINDS, type EntityKind, type Member, type PresenceEntry } from '../../../shared/src/types.js';

/** Kinds the phone keeps a local copy of. */
export const SYNCED_KINDS: EntityKind[] = ENTITY_KINDS.filter((k) => k !== 'archiveMessages');

const STORAGE_KEY = 'ortak:state:v1';
const SAVE_DEBOUNCE_MS = 400;
const SYNC_DEBOUNCE_MS = 600;

export interface SyncRecord {
  id: string;
  spaceId?: string;
  rev?: number;
  updatedAt: number;
  deleted: boolean;
  createdBy?: string;
  [key: string]: unknown;
}

type EntityMap = Record<string, SyncRecord>;
export type Entities = Record<EntityKind, EntityMap>;

function emptyEntities(): Entities {
  return Object.fromEntries(ENTITY_KINDS.map((k) => [k, {}])) as Entities;
}

function emptyPending(): Record<EntityKind, Record<string, SyncRecord>> {
  return Object.fromEntries(ENTITY_KINDS.map((k) => [k, {}])) as Record<
    EntityKind,
    Record<string, SyncRecord>
  >;
}

export interface StoreState {
  status: 'loading' | 'unconfigured' | 'ready';
  serverUrl: string;
  token: string | null;
  user: Member | null;
  space: { id: string; name: string; baseCurrency: string; inviteCode: string } | null;
  members: Member[];
  presence: PresenceEntry[];

  rev: number;
  entities: Entities;
  pending: Record<EntityKind, Record<string, SyncRecord>>;

  online: boolean;
  syncing: boolean;
  lastSyncAt: number | null;
  lastError: string | null;

  // actions
  bootstrap: () => Promise<void>;
  signIn: (session: Session, serverUrl: string) => Promise<void>;
  signOut: () => Promise<void>;
  upsert: (kind: EntityKind, record: Partial<SyncRecord> & { id: string }) => void;
  remove: (kind: EntityKind, id: string) => void;
  sync: (options?: { force?: boolean }) => Promise<void>;
  refreshMembers: () => Promise<void>;
  setPresence: (entries: PresenceEntry[]) => void;
  api: () => OrtakApi;
}

/** Shared client instance; its base URL and token follow the store. */
const api = new OrtakApi('', null);

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let syncInFlight: Promise<void> | null = null;

interface PersistedState {
  serverUrl: string;
  token: string | null;
  user: Member | null;
  space: StoreState['space'];
  members: Member[];
  rev: number;
  entities: Entities;
  pending: Record<EntityKind, Record<string, SyncRecord>>;
}

async function persist(state: StoreState): Promise<void> {
  const snapshot: PersistedState = {
    serverUrl: state.serverUrl,
    token: state.token,
    user: state.user,
    space: state.space,
    members: state.members,
    rev: state.rev,
    entities: state.entities,
    pending: state.pending,
  };
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // A failed write costs us the offline cache, not the data — the server
    // still has everything that was pushed.
  }
}

function schedulePersist(get: () => StoreState): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void persist(get()), SAVE_DEBOUNCE_MS);
}

export const useStore = create<StoreState>((set, get) => ({
  status: 'loading',
  serverUrl: '',
  token: null,
  user: null,
  space: null,
  members: [],
  presence: [],

  rev: 0,
  entities: emptyEntities(),
  pending: emptyPending(),

  online: true,
  syncing: false,
  lastSyncAt: null,
  lastError: null,

  api: () => api,

  async bootstrap() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) {
        set({ status: 'unconfigured' });
        return;
      }

      const saved = JSON.parse(raw) as PersistedState;
      api.setBaseUrl(saved.serverUrl ?? '');
      api.setToken(saved.token ?? null);

      set({
        status: saved.token ? 'ready' : 'unconfigured',
        serverUrl: saved.serverUrl ?? '',
        token: saved.token ?? null,
        user: saved.user ?? null,
        space: saved.space ?? null,
        members: saved.members ?? [],
        rev: saved.rev ?? 0,
        // Merge over a fresh skeleton so a stored snapshot from an older
        // version that predates an entity kind still loads.
        entities: { ...emptyEntities(), ...(saved.entities ?? {}) },
        pending: { ...emptyPending(), ...(saved.pending ?? {}) },
      });

      if (saved.token) void get().sync({ force: true });
    } catch {
      set({ status: 'unconfigured' });
    }
  },

  async signIn(session, serverUrl) {
    const url = normaliseServerUrl(serverUrl);
    api.setBaseUrl(url);
    api.setToken(session.token);

    set({
      status: 'ready',
      serverUrl: url,
      token: session.token,
      user: session.user,
      space: session.space,
      members: [session.user],
      rev: 0,
      entities: emptyEntities(),
      pending: emptyPending(),
      lastError: null,
    });

    await persist(get());
    await get().sync({ force: true });
    await get().refreshMembers();
  },

  async signOut() {
    api.setToken(null);
    await AsyncStorage.removeItem(STORAGE_KEY);
    set({
      status: 'unconfigured',
      token: null,
      user: null,
      space: null,
      members: [],
      presence: [],
      rev: 0,
      entities: emptyEntities(),
      pending: emptyPending(),
    });
  },

  /**
   * Create or update a record locally and queue it for the server.
   *
   * `updatedAt` is stamped here, on the device that made the edit — that stamp
   * is what decides conflicts, so it has to be the moment the person acted, not
   * the moment the request happens to reach the server.
   */
  upsert(kind, record) {
    const state = get();
    const existing = state.entities[kind][record.id];
    const merged: SyncRecord = {
      ...(existing ?? {}),
      ...record,
      id: record.id,
      updatedAt: Date.now(),
      deleted: record.deleted ?? existing?.deleted ?? false,
      createdBy: existing?.createdBy ?? state.user?.id ?? '',
      spaceId: state.space?.id ?? '',
    };

    set({
      entities: { ...state.entities, [kind]: { ...state.entities[kind], [record.id]: merged } },
      pending: { ...state.pending, [kind]: { ...state.pending[kind], [record.id]: merged } },
    });

    schedulePersist(get);
    scheduleSync(get);
  },

  /** Deletes are tombstones so the other phone hears about them. */
  remove(kind, id) {
    const existing = get().entities[kind][id];
    if (!existing) return;
    get().upsert(kind, { ...existing, id, deleted: true });
  },

  async sync(options = {}) {
    const state = get();
    if (!state.token || state.status !== 'ready') return;
    if (syncInFlight && !options.force) return syncInFlight;

    syncInFlight = runSync(set, get).finally(() => {
      syncInFlight = null;
    });
    return syncInFlight;
  },

  async refreshMembers() {
    try {
      const me = await api.me();
      set({ members: me.members, space: me.space, user: me.user, presence: me.presence, online: true });
      schedulePersist(get);
    } catch (error) {
      if (error instanceof ApiError && error.isTransient) set({ online: false });
    }
  },

  setPresence(entries) {
    set({ presence: entries });
  },
}));

function scheduleSync(get: () => StoreState): void {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => void get().sync(), SYNC_DEBOUNCE_MS);
}

/**
 * One push-then-pull cycle.
 *
 * Push first so that a change made offline is on the server before we ask what
 * changed — otherwise a pull could overwrite the local edit with the older
 * server copy and the edit would be lost.
 */
async function runSync(
  set: (partial: Partial<StoreState>) => void,
  get: () => StoreState,
): Promise<void> {
  const state = get();
  if (!state.token) return;

  set({ syncing: true });

  try {
    // ---- push ----
    const outgoing: Partial<Record<EntityKind, SyncRecord[]>> = {};
    let outgoingCount = 0;
    for (const kind of SYNCED_KINDS) {
      const rows = Object.values(state.pending[kind] ?? {});
      if (rows.length) {
        outgoing[kind] = rows;
        outgoingCount += rows.length;
      }
    }

    if (outgoingCount > 0) {
      const result = await api.push(outgoing);
      const pending = { ...get().pending };

      for (const kind of SYNCED_KINDS) {
        const settled = [...(result.applied[kind] ?? []), ...(result.stale[kind] ?? [])];
        if (settled.length === 0) continue;
        const next = { ...pending[kind] };
        for (const id of settled) delete next[id];
        pending[kind] = next;
      }

      // A row the server rejected outright would otherwise retry forever.
      for (const failure of result.errors) {
        if (!failure.id) continue;
        const next = { ...pending[failure.kind] };
        delete next[failure.id];
        pending[failure.kind] = next;
      }

      set({ pending });
      if (result.errors.length > 0) {
        set({ lastError: `${result.errors.length} change(s) were rejected by the server.` });
      }
    }

    // ---- pull ----
    const since = get().rev;
    const response = await api.pull(since, SYNCED_KINDS);
    const entities = { ...get().entities };
    const stillPending = get().pending;

    for (const kind of SYNCED_KINDS) {
      const rows = response.changes[kind];
      if (!rows?.length) continue;

      const map = { ...entities[kind] };
      for (const raw of rows) {
        const row = raw as unknown as SyncRecord;
        // Anything still queued locally is a newer edit by definition — the
        // server just hasn't been told yet — so it wins until the next push.
        if (stillPending[kind]?.[row.id]) continue;
        map[row.id] = row;
      }
      entities[kind] = map;
    }

    set({
      entities,
      rev: response.rev,
      online: true,
      lastSyncAt: Date.now(),
      lastError: null,
    });
    schedulePersist(get);
  } catch (error) {
    if (error instanceof ApiError) {
      set({ online: !error.isTransient, lastError: error.isTransient ? null : error.message });
    }
  } finally {
    set({ syncing: false });
  }
}

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

/** Live (non-deleted) records of one kind, as an array. */
export function selectAll<T = SyncRecord>(state: StoreState, kind: EntityKind): T[] {
  return Object.values(state.entities[kind]).filter((r) => !r.deleted) as unknown as T[];
}

export function memberName(state: StoreState, userId: string | null | undefined): string {
  if (!userId) return '';
  return state.members.find((m) => m.id === userId)?.name ?? '';
}

export function memberColor(state: StoreState, userId: string | null | undefined): string {
  if (!userId) return '#8A90A2';
  return state.members.find((m) => m.id === userId)?.color ?? '#8A90A2';
}

export function pendingCount(state: StoreState): number {
  return SYNCED_KINDS.reduce((sum, kind) => sum + Object.keys(state.pending[kind] ?? {}).length, 0);
}

/**
 * HTTP client for the Ortak server.
 *
 * Every method throws `ApiError` on failure. Callers in the store treat network
 * errors as "we're offline, try again later" rather than as something to show
 * the user — the app is built to work without a connection and catch up after.
 */

import type { EntityKind, Member, PresenceEntry } from '../../../shared/src/types.js';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** True when retrying later might work (offline, server restarting). */
  get isTransient(): boolean {
    return this.status === 0 || this.status >= 500;
  }
}

const DEFAULT_TIMEOUT_MS = 20_000;
/** Imports carry a whole chat history, so they get much longer. */
const IMPORT_TIMEOUT_MS = 120_000;

export interface SpaceInfo {
  id: string;
  name: string;
  baseCurrency: string;
  inviteCode: string;
}

export interface Session {
  space: SpaceInfo;
  user: Member;
  token: string;
}

export interface PullResponse {
  rev: number;
  serverTime: number;
  changes: Partial<Record<EntityKind, Record<string, unknown>[]>>;
}

export interface PushResponse {
  rev: number;
  serverTime: number;
  applied: Partial<Record<EntityKind, string[]>>;
  stale: Partial<Record<EntityKind, string[]>>;
  errors: { kind: EntityKind; id: string | null; message: string }[];
}

export interface SearchHit {
  entityId: string;
  kind: EntityKind;
  title: string;
  snippet: string;
  context: string;
  sortAt: number;
  score: number;
}

export interface ImportResult {
  importId: string;
  chatName: string;
  messageCount: number;
  addedCount: number;
  duplicateCount: number;
  participants: string[];
  firstAt: number | null;
  lastAt: number | null;
  dateOrder: 'dmy' | 'mdy' | 'ymd';
  dateOrderAmbiguous: boolean;
  warnings: string[];
}

export interface ImportPreview {
  dryRun: true;
  chatName: string;
  messageCount: number;
  participants: string[];
  firstAt: number | null;
  lastAt: number | null;
  dateOrder: 'dmy' | 'mdy' | 'ymd';
  dateOrderAmbiguous: boolean;
  warnings: string[];
  sample: { sentAt: number; author: string | null; body: string; kind: string }[];
}

export interface ArchiveChat {
  chatName: string;
  messageCount: number;
  firstAt: number;
  lastAt: number;
  starredCount: number;
}

export interface ArchiveMessageRow {
  id: string;
  chatName: string;
  author: string | null;
  sentAt: number;
  body: string;
  kind: string;
  mediaName: string | null;
  starred: boolean;
  tags: string[];
}

export interface PendingCalendarWork {
  create: {
    event: Record<string, unknown>;
    existing: { calendarId: string; externalEventId: string } | null;
  }[];
  remove: { eventId: string; calendarId: string; externalEventId: string }[];
}

/** Normalise whatever the user typed into a base URL we can build paths on. */
export function normaliseServerUrl(input: string): string {
  let url = input.trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
  return url.replace(/\/+$/, '');
}

export class OrtakApi {
  constructor(
    private baseUrl: string,
    private token: string | null = null,
  ) {}

  setToken(token: string | null): void {
    this.token = token;
  }

  setBaseUrl(baseUrl: string): void {
    this.baseUrl = normaliseServerUrl(baseUrl);
  }

  get url(): string {
    return this.baseUrl;
  }

  /** WebSocket endpoint, with the token in the query — RN can't set headers on a handshake. */
  socketUrl(): string | null {
    if (!this.token) return null;
    const ws = this.baseUrl.replace(/^http/i, 'ws');
    return `${ws}/api/ws?token=${encodeURIComponent(this.token)}`;
  }

  private async request<T>(
    path: string,
    init: RequestInit & { timeoutMs?: number } = {},
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
          ...init.headers,
        },
      });

      const text = await response.text();
      const isJson = (response.headers.get('content-type') ?? '').includes('json');
      const body: unknown = isJson && text ? JSON.parse(text) : text;

      if (!response.ok) {
        const detail = body as { error?: string; message?: string };
        throw new ApiError(
          detail?.message ?? `Request failed (${response.status})`,
          response.status,
          detail?.error ?? null,
        );
      }

      return body as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      // AbortError and TypeError both mean "we didn't reach the server".
      const message = error instanceof Error ? error.message : 'Network request failed';
      throw new ApiError(message, 0);
    } finally {
      clearTimeout(timer);
    }
  }

  private post<T>(path: string, body: unknown, timeoutMs?: number): Promise<T> {
    return this.request<T>(path, { method: 'POST', body: JSON.stringify(body), timeoutMs });
  }

  // -- session ---------------------------------------------------------------

  health(): Promise<{ ok: boolean }> {
    return this.request('/health', { timeoutMs: 8000 });
  }

  createSpace(input: {
    spaceName: string;
    userName: string;
    baseCurrency?: string;
    signupSecret?: string;
  }): Promise<Session> {
    return this.post('/api/spaces', input);
  }

  joinSpace(input: {
    inviteCode: string;
    userName: string;
    signupSecret?: string;
  }): Promise<Session> {
    return this.post('/api/spaces/join', input);
  }

  me(): Promise<{
    user: Member;
    space: SpaceInfo;
    members: Member[];
    rev: number;
    presence: PresenceEntry[];
  }> {
    return this.request('/api/me');
  }

  rename(name: string): Promise<{ members: Member[] }> {
    return this.post('/api/me', { name });
  }

  rotateInvite(): Promise<{ inviteCode: string }> {
    return this.post('/api/spaces/rotate-invite', {});
  }

  // -- sync ------------------------------------------------------------------

  pull(since: number, kinds?: EntityKind[]): Promise<PullResponse> {
    const params = new URLSearchParams({ since: String(since) });
    if (kinds?.length) params.set('kinds', kinds.join(','));
    return this.request(`/api/sync?${params.toString()}`);
  }

  push(changes: Partial<Record<EntityKind, unknown[]>>): Promise<PushResponse> {
    return this.post('/api/sync', { changes });
  }

  // -- search ----------------------------------------------------------------

  search(
    query: string,
    options: { kinds?: EntityKind[]; limit?: number; offset?: number; order?: 'relevance' | 'recent' } = {},
  ): Promise<{ query: string; total: number; hits: SearchHit[] }> {
    const params = new URLSearchParams({ q: query });
    if (options.kinds?.length) params.set('kinds', options.kinds.join(','));
    if (options.limit) params.set('limit', String(options.limit));
    if (options.offset) params.set('offset', String(options.offset));
    if (options.order) params.set('order', options.order);
    return this.request(`/api/search?${params.toString()}`);
  }

  // -- archive ---------------------------------------------------------------

  previewImport(input: {
    content: string;
    filename?: string;
    utcOffsetMinutes?: number;
  }): Promise<ImportPreview> {
    return this.post('/api/archive/import', { ...input, dryRun: true }, IMPORT_TIMEOUT_MS);
  }

  runImport(input: {
    content: string;
    filename?: string;
    chatName?: string;
    utcOffsetMinutes?: number;
    dateOrder?: 'dmy' | 'mdy' | 'ymd';
  }): Promise<ImportResult> {
    return this.post('/api/archive/import', input, IMPORT_TIMEOUT_MS);
  }

  archiveChats(): Promise<{ chats: ArchiveChat[] }> {
    return this.request('/api/archive/chats');
  }

  archiveMessages(params: {
    chat: string;
    before?: number;
    limit?: number;
    starred?: boolean;
  }): Promise<{ messages: ArchiveMessageRow[]; hasMore: boolean }> {
    const query = new URLSearchParams({ chat: params.chat });
    if (params.before) query.set('before', String(params.before));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.starred) query.set('starred', 'true');
    return this.request(`/api/archive/messages?${query.toString()}`);
  }

  archiveImports(): Promise<{
    imports: {
      id: string;
      chatName: string;
      filename: string;
      messageCount: number;
      addedCount: number;
      createdAt: number;
    }[];
  }> {
    return this.request('/api/archive/imports');
  }

  deleteImport(importId: string): Promise<{ deleted: number }> {
    return this.request(`/api/archive/imports/${importId}`, { method: 'DELETE' });
  }

  // -- calendar --------------------------------------------------------------

  pendingCalendarWork(): Promise<PendingCalendarWork> {
    return this.request('/api/calendar/pending');
  }

  saveCalendarMirrors(
    mirrors: { eventId: string; calendarId: string; externalEventId: string; mirroredRev: number }[],
  ): Promise<{ saved: number }> {
    return this.post('/api/calendar/mirrors', { mirrors });
  }

  forgetCalendarMirror(eventId: string): Promise<{ ok: boolean }> {
    return this.request(`/api/calendar/mirrors/${eventId}`, { method: 'DELETE' });
  }

  // -- availability ----------------------------------------------------------

  publishAvailability(input: {
    windowStart: number;
    windowEnd: number;
    blocks: {
      startsAt: number;
      endsAt: number;
      allDay?: boolean;
      label?: string | null;
      sourceCalendarId?: string | null;
      externalId?: string | null;
    }[];
  }): Promise<{ published: number; changed: number; removed: number; rev: number }> {
    // A two-month window of a busy calendar is a big body, so it gets longer
    // than the default timeout.
    return this.post('/api/availability/publish', input, 60_000);
  }

  stopSharingAvailability(): Promise<{ removed: number }> {
    return this.request('/api/availability/mine', { method: 'DELETE' });
  }

  availability(
    from: number,
    to: number,
  ): Promise<{
    from: number;
    to: number;
    blocks: { ownerId: string; startsAt: number; endsAt: number; label: string | null }[];
    busyMinutes: Record<string, number>;
    sharing: string[];
  }> {
    return this.request(`/api/availability?from=${from}&to=${to}`);
  }

  findSlots(input: {
    from: number;
    to: number;
    durationMinutes: number;
    utcOffsetMinutes: number;
    participants?: string[];
    dayStartMinutes?: number;
    dayEndMinutes?: number;
    weekdays?: number[];
    bufferMinutes?: number;
    maxResults?: number;
  }): Promise<{
    slots: { startsAt: number; endsAt: number; availableTo: string[] }[];
    participants: string[];
    busyMinutes: Record<string, number>;
  }> {
    return this.post('/api/availability/slots', input);
  }

  // -- shopping --------------------------------------------------------------

  completeShoppingRun(input: {
    store?: string;
    prices?: Record<string, number>;
  }): Promise<{ runId: string; itemCount: number; totalCents: number }> {
    return this.post('/api/shopping/complete-run', input);
  }

  shoppingRuns(): Promise<{
    runs: { id: string; store: string | null; totalCents: number; itemCount: number; completedAt: number }[];
  }> {
    return this.request('/api/shopping/runs');
  }

  shoppingSuggestions(): Promise<{
    suggestions: { name: string; category: string | null; times: number; lastBought: number | null }[];
  }> {
    return this.request('/api/shopping/suggestions');
  }

  // -- trips -----------------------------------------------------------------

  tripSummary(tripId: string): Promise<Record<string, unknown>> {
    return this.request(`/api/trips/${tripId}/summary`);
  }

  // -- misc ------------------------------------------------------------------

  linkPreview(url: string): Promise<{
    url: string;
    title: string | null;
    description: string | null;
    imageUrl: string | null;
    siteName: string | null;
  }> {
    return this.post('/api/links/preview', { url }, 12_000);
  }

  presence(context: string): Promise<{ entries: PresenceEntry[] }> {
    return this.post('/api/presence', { context });
  }
}

/**
 * Entity types shared by the Ortak server and the mobile app.
 *
 * Every syncable record carries the same four sync fields so one delta-sync
 * engine can move all of them:
 *
 *   rev        server-assigned, monotonically increasing per space
 *   updatedAt  wall-clock ms from the device that made the edit (last-writer-wins)
 *   deleted    tombstone, so deletions propagate to the other phone
 *   createdBy  user id, used for "who added this" and for avatars in the UI
 */

export interface SyncFields {
  id: string;
  spaceId: string;
  rev: number;
  updatedAt: number;
  deleted: boolean;
  createdBy: string;
}

/** Every entity kind the sync engine knows about, in dependency order. */
export const ENTITY_KINDS = [
  'events',
  'notes',
  'tasks',
  'shoppingItems',
  'links',
  'archiveMessages',
  'trips',
  'tripMembers',
  'expenses',
  'settlements',
] as const;

export type EntityKind = (typeof ENTITY_KINDS)[number];

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

/**
 * A shared calendar entry. It lives in Ortak, and each member's phone mirrors
 * it into whichever device calendar that member picked (iCloud, Google, …).
 * The mirror bookkeeping is per-device and lives in `CalendarMirror`.
 */
export interface EventItem extends SyncFields {
  title: string;
  notes: string | null;
  location: string | null;
  /** Epoch ms, UTC. */
  startsAt: number;
  endsAt: number;
  allDay: boolean;
  /** IANA zone the event was entered in, e.g. "Europe/Berlin". */
  timezone: string | null;
  /** Minutes before start for an alarm, or null for none. */
  reminderMinutes: number | null;
  color: string | null;
}

/**
 * Records that a given user's device wrote this event into their own calendar.
 * Keyed by (eventId, userId): the same shared event exists once in Onur's
 * iCloud calendar and once in Tugce's Google calendar, with different native ids.
 */
export interface CalendarMirror {
  eventId: string;
  userId: string;
  /** Native calendar id from expo-calendar on that device. */
  calendarId: string;
  /** Native event id, so later edits update instead of duplicating. */
  externalEventId: string;
  /** The event `rev` that was last written to the device calendar. */
  mirroredRev: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Notes, tasks, shopping, links
// ---------------------------------------------------------------------------

export interface NoteItem extends SyncFields {
  title: string;
  body: string;
  tags: string[];
  pinned: boolean;
  /** Set once the note has been pushed to Apple Notes, for the "exported" badge. */
  exportedAt: number | null;
}

export interface TaskItem extends SyncFields {
  title: string;
  notes: string | null;
  /** Epoch ms, or null for "someday". */
  dueAt: number | null;
  assigneeId: string | null;
  done: boolean;
  doneAt: number | null;
  doneBy: string | null;
  /** Free-form grouping: "Home", "Wedding", "Bureaucracy", … */
  category: string | null;
  priority: 0 | 1 | 2;
  /** Sort key inside its category; fractional so reordering never renumbers. */
  position: number;
}

export interface ShoppingItem extends SyncFields {
  name: string;
  /** Free text so "2 kg" and "a bunch" both work. */
  quantity: string | null;
  category: string | null;
  store: string | null;
  checked: boolean;
  checkedBy: string | null;
  checkedAt: number | null;
  /** Optional price capture, in minor units of the space currency. */
  priceCents: number | null;
  note: string | null;
  position: number;
  /** Set when a shopping run is completed; null while the item is on the live list. */
  runId: string | null;
}

export interface LinkItem extends SyncFields {
  url: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
  tags: string[];
  note: string | null;
  archived: boolean;
}

// ---------------------------------------------------------------------------
// Chat archive (WhatsApp exports and shared messages)
// ---------------------------------------------------------------------------

export type ArchiveSource = 'whatsapp-export' | 'share' | 'manual';
export type ArchiveMessageKind = 'message' | 'system' | 'media' | 'deleted';

export interface ArchiveMessage extends SyncFields {
  /** Group or contact name, e.g. "Ev 🏠" or "Tugce". */
  chatName: string;
  author: string | null;
  /** Epoch ms of when the message was originally sent. */
  sentAt: number;
  body: string;
  kind: ArchiveMessageKind;
  /** Filename referenced by an attachment line, when the export had one. */
  mediaName: string | null;
  source: ArchiveSource;
  importId: string | null;
  starred: boolean;
  tags: string[];
}

export interface ArchiveImport {
  id: string;
  spaceId: string;
  chatName: string;
  filename: string;
  messageCount: number;
  firstAt: number | null;
  lastAt: number | null;
  createdAt: number;
  createdBy: string;
}

// ---------------------------------------------------------------------------
// Trips and expense splitting
// ---------------------------------------------------------------------------

export interface Trip extends SyncFields {
  name: string;
  /** ISO 4217 code the trip settles in, e.g. "EUR". */
  currency: string;
  startsAt: number | null;
  endsAt: number | null;
  notes: string | null;
  archived: boolean;
}

/**
 * A participant in a trip. `userId` is null for friends who don't use the app —
 * they still get balances, they just can't open them.
 */
export interface TripMember extends SyncFields {
  tripId: string;
  name: string;
  userId: string | null;
  color: string | null;
}

export type SplitMode = 'equal' | 'shares' | 'exact' | 'percent';

/**
 * One member's stake in an expense.
 *
 *   equal    only `memberId` matters; everyone listed pays the same
 *   shares   `weight` is a share count (2 adults + 1 kid → 2, 2, 1)
 *   percent  `weight` is a percentage; the list should total 100
 *   exact    `amountCents` is that member's exact slice
 */
export interface ExpenseSplit {
  memberId: string;
  weight?: number;
  amountCents?: number;
}

export interface Expense extends SyncFields {
  tripId: string;
  description: string;
  /** Minor units (cents) in `currency`. */
  amountCents: number;
  currency: string;
  /** Multiplier from `currency` into the trip currency. 1 when they match. */
  rateToTrip: number;
  /** Trip member id of whoever actually paid. */
  paidBy: string;
  spentAt: number;
  category: string | null;
  splitMode: SplitMode;
  splits: ExpenseSplit[];
  note: string | null;
}

/** A real-world repayment ("I sent you 40 €"), which cancels out a debt. */
export interface Settlement extends SyncFields {
  tripId: string;
  fromMemberId: string;
  toMemberId: string;
  amountCents: number;
  settledAt: number;
  note: string | null;
}

// ---------------------------------------------------------------------------
// Space, membership, presence
// ---------------------------------------------------------------------------

export interface Space {
  id: string;
  name: string;
  baseCurrency: string;
  rev: number;
  createdAt: number;
}

export interface Member {
  id: string;
  spaceId: string;
  name: string;
  color: string;
  createdAt: number;
}

/** "Tugce is in the shop right now" — drives the live shopping indicator. */
export interface Presence {
  userId: string;
  context: string;
  at: number;
}

// ---------------------------------------------------------------------------
// Sync payloads
// ---------------------------------------------------------------------------

export type ChangeSet = {
  [K in EntityKind]?: unknown[];
};

export interface SyncPullResponse {
  rev: number;
  serverTime: number;
  changes: ChangeSet;
}

export interface SyncPushResponse {
  rev: number;
  serverTime: number;
  /** Ids the server accepted, per entity kind. */
  applied: Record<string, string[]>;
  /** Ids rejected because the server already had a newer version. */
  stale: Record<string, string[]>;
}

/**
 * Database schema.
 *
 * Every syncable table carries the same five columns — id, space_id, rev,
 * updated_at, deleted, created_by — so one generic delta-sync engine can move
 * all of them (see sync.ts). `rev` is assigned by the server from a per-space
 * counter, which gives clients a single cursor to pull from.
 *
 * Search is one unified FTS5 index across every kind of content, so "that thing
 * about the plumber" is a single query over notes, tasks, links, shopping items
 * and the WhatsApp archive at once. It is maintained by the application rather
 * than by triggers because the indexed text is folded first — see search.ts for
 * why the Turkish dotless ı forces that.
 */

export const SCHEMA_VERSION = 1;

/** Columns shared by every syncable entity. */
export const SYNC_COLUMNS = `
  id          TEXT    PRIMARY KEY,
  space_id    TEXT    NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  rev         INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  deleted     INTEGER NOT NULL DEFAULT 0,
  created_by  TEXT    NOT NULL
`;

export const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- Space and membership
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS spaces (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  invite_code   TEXT NOT NULL UNIQUE,
  base_currency TEXT NOT NULL DEFAULT 'EUR',
  -- Monotonic revision counter. Every write bumps it; clients pull "everything
  -- above the rev I last saw".
  rev           INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY,
  space_id   TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#6C8AE4',
  -- SHA-256 of the bearer token; the plaintext is shown once, at join time.
  token_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS users_space ON users(space_id);

-- ---------------------------------------------------------------------------
-- Calendar
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS events (
  ${SYNC_COLUMNS},
  title            TEXT    NOT NULL,
  notes            TEXT,
  location         TEXT,
  starts_at        INTEGER NOT NULL,
  ends_at          INTEGER NOT NULL,
  all_day          INTEGER NOT NULL DEFAULT 0,
  timezone         TEXT,
  reminder_minutes INTEGER,
  color            TEXT,
  calendar_set     TEXT
);
CREATE INDEX IF NOT EXISTS events_space_rev ON events(space_id, rev);
CREATE INDEX IF NOT EXISTS events_span ON events(space_id, starts_at);

-- Which native calendar entry each member's phone created for a shared event.
-- Keyed per (event, user) because Onur mirrors into iCloud and Tugce into
-- Google, and each device needs its own native id to update rather than
-- duplicate on the next edit.
CREATE TABLE IF NOT EXISTS calendar_mirrors (
  event_id          TEXT    NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id           TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  calendar_id       TEXT    NOT NULL,
  external_event_id TEXT    NOT NULL,
  mirrored_rev      INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  PRIMARY KEY (event_id, user_id)
);

-- Time each member is already committed to, read from their own device
-- calendars. This is what makes the calendar two-way: without it the app can
-- write events out but can never answer "when are we both free?".
CREATE TABLE IF NOT EXISTS busy_blocks (
  ${SYNC_COLUMNS},
  owner_id           TEXT    NOT NULL,
  starts_at          INTEGER NOT NULL,
  ends_at            INTEGER NOT NULL,
  all_day            INTEGER NOT NULL DEFAULT 0,
  -- Null unless the owner opted into sharing titles as well as times.
  label              TEXT,
  source_calendar_id TEXT,
  external_id        TEXT
);
CREATE INDEX IF NOT EXISTS busy_space_rev ON busy_blocks(space_id, rev);
CREATE INDEX IF NOT EXISTS busy_owner_span ON busy_blocks(space_id, owner_id, starts_at);

-- ---------------------------------------------------------------------------
-- Notes, tasks, shopping, links
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS notes (
  ${SYNC_COLUMNS},
  title       TEXT NOT NULL DEFAULT '',
  body        TEXT NOT NULL DEFAULT '',
  tags        TEXT NOT NULL DEFAULT '[]',
  pinned      INTEGER NOT NULL DEFAULT 0,
  exported_at INTEGER,
  linked_event_id TEXT
);
CREATE INDEX IF NOT EXISTS notes_space_rev ON notes(space_id, rev);

CREATE TABLE IF NOT EXISTS tasks (
  ${SYNC_COLUMNS},
  title       TEXT    NOT NULL,
  notes       TEXT,
  due_at      INTEGER,
  defer_at    INTEGER,
  assignee_id TEXT,
  done        INTEGER NOT NULL DEFAULT 0,
  done_at     INTEGER,
  done_by     TEXT,
  category    TEXT,
  priority    INTEGER NOT NULL DEFAULT 0,
  position    REAL    NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS tasks_space_rev ON tasks(space_id, rev);
CREATE INDEX IF NOT EXISTS tasks_open ON tasks(space_id, done, due_at);

CREATE TABLE IF NOT EXISTS shopping_items (
  ${SYNC_COLUMNS},
  name        TEXT    NOT NULL,
  quantity    TEXT,
  category    TEXT,
  store       TEXT,
  checked     INTEGER NOT NULL DEFAULT 0,
  checked_by  TEXT,
  checked_at  INTEGER,
  price_cents INTEGER,
  note        TEXT,
  position    REAL    NOT NULL DEFAULT 0,
  run_id      TEXT
);
CREATE INDEX IF NOT EXISTS shopping_space_rev ON shopping_items(space_id, rev);
CREATE INDEX IF NOT EXISTS shopping_live ON shopping_items(space_id, run_id, checked);

-- A completed shopping run, so "what did we spend at Rewe last month" survives
-- clearing the live list.
CREATE TABLE IF NOT EXISTS shopping_runs (
  id           TEXT PRIMARY KEY,
  space_id     TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  store        TEXT,
  total_cents  INTEGER NOT NULL DEFAULT 0,
  item_count   INTEGER NOT NULL DEFAULT 0,
  completed_at INTEGER NOT NULL,
  completed_by TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS shopping_runs_space ON shopping_runs(space_id, completed_at DESC);

CREATE TABLE IF NOT EXISTS links (
  ${SYNC_COLUMNS},
  url         TEXT NOT NULL,
  title       TEXT,
  description TEXT,
  image_url   TEXT,
  site_name   TEXT,
  tags        TEXT NOT NULL DEFAULT '[]',
  note        TEXT,
  archived    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS links_space_rev ON links(space_id, rev);

-- ---------------------------------------------------------------------------
-- Chat archive
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS archive_messages (
  ${SYNC_COLUMNS},
  chat_name  TEXT    NOT NULL,
  author     TEXT,
  sent_at    INTEGER NOT NULL,
  body       TEXT    NOT NULL,
  kind       TEXT    NOT NULL DEFAULT 'message',
  media_name TEXT,
  source     TEXT    NOT NULL DEFAULT 'whatsapp-export',
  import_id  TEXT,
  starred    INTEGER NOT NULL DEFAULT 0,
  tags       TEXT    NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS archive_space_rev ON archive_messages(space_id, rev);
CREATE INDEX IF NOT EXISTS archive_chat ON archive_messages(space_id, chat_name, sent_at DESC);
CREATE INDEX IF NOT EXISTS archive_starred ON archive_messages(space_id, starred, sent_at DESC);

CREATE TABLE IF NOT EXISTS archive_imports (
  id            TEXT PRIMARY KEY,
  space_id      TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  chat_name     TEXT NOT NULL,
  filename      TEXT NOT NULL,
  message_count INTEGER NOT NULL,
  added_count   INTEGER NOT NULL DEFAULT 0,
  first_at      INTEGER,
  last_at       INTEGER,
  created_at    INTEGER NOT NULL,
  created_by    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS archive_imports_space ON archive_imports(space_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Trips and expenses
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS trips (
  ${SYNC_COLUMNS},
  name      TEXT    NOT NULL,
  currency  TEXT    NOT NULL DEFAULT 'EUR',
  starts_at INTEGER,
  ends_at   INTEGER,
  notes     TEXT,
  archived  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS trips_space_rev ON trips(space_id, rev);

CREATE TABLE IF NOT EXISTS trip_members (
  ${SYNC_COLUMNS},
  trip_id TEXT NOT NULL,
  name    TEXT NOT NULL,
  user_id TEXT,
  color   TEXT
);
CREATE INDEX IF NOT EXISTS trip_members_space_rev ON trip_members(space_id, rev);
CREATE INDEX IF NOT EXISTS trip_members_trip ON trip_members(trip_id);

CREATE TABLE IF NOT EXISTS expenses (
  ${SYNC_COLUMNS},
  trip_id      TEXT    NOT NULL,
  description  TEXT    NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency     TEXT    NOT NULL DEFAULT 'EUR',
  rate_to_trip REAL    NOT NULL DEFAULT 1,
  paid_by      TEXT    NOT NULL,
  spent_at     INTEGER NOT NULL,
  category     TEXT,
  split_mode   TEXT    NOT NULL DEFAULT 'equal',
  -- JSON array of {memberId, weight?, amountCents?}. Kept in one column so an
  -- expense edit is a single atomic row for last-writer-wins to reason about.
  splits       TEXT    NOT NULL DEFAULT '[]',
  note         TEXT
);
CREATE INDEX IF NOT EXISTS expenses_space_rev ON expenses(space_id, rev);
CREATE INDEX IF NOT EXISTS expenses_trip ON expenses(trip_id, spent_at DESC);

CREATE TABLE IF NOT EXISTS settlements (
  ${SYNC_COLUMNS},
  trip_id        TEXT    NOT NULL,
  from_member_id TEXT    NOT NULL,
  to_member_id   TEXT    NOT NULL,
  amount_cents   INTEGER NOT NULL,
  settled_at     INTEGER NOT NULL,
  note           TEXT
);
CREATE INDEX IF NOT EXISTS settlements_space_rev ON settlements(space_id, rev);
CREATE INDEX IF NOT EXISTS settlements_trip ON settlements(trip_id);

-- ---------------------------------------------------------------------------
-- Unified search
-- ---------------------------------------------------------------------------

-- Gives every indexed row a small stable integer to use as the FTS rowid, so
-- re-indexing one edited row is a primary-key lookup instead of a scan of the
-- whole index.
CREATE TABLE IF NOT EXISTS search_docs (
  doc_id    INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_id TEXT NOT NULL UNIQUE
);

CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
  title,
  body,
  context,               -- author / chat / category, searchable but lower weight
  entity_id  UNINDEXED,
  space_id   UNINDEXED,
  kind       UNINDEXED,
  sort_at    UNINDEXED,
  tokenize = 'unicode61 remove_diacritics 2'
);
`;

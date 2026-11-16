import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Language, Profile, SecretaryTask, TranscriptLine } from './types.js';

type SqlValue = string | number | null;
type Row = Record<string, SqlValue>;

/**
 * One column of the `tasks` table: how it is declared, and how its value moves
 * between the row and the task. Every statement below is generated from this
 * list, so a column cannot be added in one place and forgotten in another.
 */
interface Column {
  name: string;
  /** SQL type and constraints, as used both in CREATE TABLE and ALTER TABLE. */
  definition: string;
  /** False for the columns that are set once, when the row is inserted. */
  mutable: boolean;
  toSql(task: SecretaryTask): SqlValue;
}

function parseLines(value: SqlValue | undefined): TranscriptLine[] {
  if (typeof value !== 'string' || !value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry): TranscriptLine[] => {
      if (!entry || typeof entry !== 'object') return [];
      const { role, text } = entry as { role?: unknown; text?: unknown };
      if ((role !== 'assistant' && role !== 'other') || typeof text !== 'string') return [];
      return [{ role, text }];
    });
  } catch {
    return [];
  }
}

const COLUMNS: Column[] = [
  { name: 'id', definition: 'TEXT PRIMARY KEY', mutable: false, toSql: (t) => t.id },
  { name: 'device_id', definition: 'TEXT NOT NULL', mutable: false, toSql: (t) => t.deviceId },
  {
    name: 'kind',
    definition: "TEXT NOT NULL DEFAULT 'call'",
    mutable: false,
    toSql: (t) => t.kind,
  },
  { name: 'goal', definition: 'TEXT NOT NULL', mutable: true, toSql: (t) => t.goal },
  {
    // NOT NULL from the first schema, so "no number" is stored as ''.
    name: 'phone_number',
    definition: "TEXT NOT NULL DEFAULT ''",
    mutable: true,
    toSql: (t) => t.phoneNumber ?? '',
  },
  { name: 'language', definition: 'TEXT NOT NULL', mutable: true, toSql: (t) => t.language },
  {
    name: 'summary_language',
    definition: 'TEXT NOT NULL',
    mutable: true,
    toSql: (t) => t.summaryLanguage,
  },
  { name: 'user_name', definition: 'TEXT', mutable: true, toSql: (t) => t.userName },
  { name: 'status', definition: 'TEXT NOT NULL', mutable: true, toSql: (t) => t.status },
  {
    name: 'direction',
    definition: "TEXT NOT NULL DEFAULT 'outbound'",
    mutable: false,
    toSql: (t) => t.direction,
  },
  {
    name: 'simulated',
    definition: 'INTEGER NOT NULL DEFAULT 0',
    mutable: true,
    toSql: (t) => (t.simulated ? 1 : 0),
  },
  {
    name: 'provider_call_id',
    definition: 'TEXT',
    mutable: true,
    toSql: (t) => t.providerCallId,
  },
  { name: 'document_text', definition: 'TEXT', mutable: true, toSql: (t) => t.documentText },
  {
    name: 'lines_json',
    definition: 'TEXT',
    mutable: true,
    toSql: (t) => (t.lines.length ? JSON.stringify(t.lines) : null),
  },
  { name: 'transcript', definition: 'TEXT', mutable: true, toSql: (t) => t.transcript },
  { name: 'summary', definition: 'TEXT', mutable: true, toSql: (t) => t.summary },
  { name: 'summary_source', definition: 'TEXT', mutable: true, toSql: (t) => t.summarySource },
  { name: 'result', definition: 'TEXT', mutable: true, toSql: (t) => t.result },
  { name: 'todo', definition: 'TEXT', mutable: true, toSql: (t) => t.todo },
  { name: 'todo_when', definition: 'TEXT', mutable: true, toSql: (t) => t.todoWhen },
  { name: 'outcome', definition: 'TEXT', mutable: true, toSql: (t) => t.outcome },
  {
    name: 'duration_seconds',
    definition: 'INTEGER',
    mutable: true,
    toSql: (t) => t.durationSeconds,
  },
  { name: 'error', definition: 'TEXT', mutable: true, toSql: (t) => t.error },
  { name: 'error_code', definition: 'TEXT', mutable: true, toSql: (t) => t.errorCode },
  { name: 'created_at', definition: 'TEXT NOT NULL', mutable: false, toSql: (t) => t.createdAt },
  { name: 'updated_at', definition: 'TEXT NOT NULL', mutable: true, toSql: (t) => t.updatedAt },
];

const MUTABLE_COLUMNS = COLUMNS.filter((c) => c.mutable);

function text(row: Row, column: string): string | null {
  const value = row[column];
  return typeof value === 'string' ? value : null;
}

function rowToTask(row: Row): SecretaryTask {
  const duration = row['duration_seconds'];
  return {
    id: text(row, 'id') ?? '',
    deviceId: text(row, 'device_id') ?? '',
    kind: (text(row, 'kind') ?? 'call') as SecretaryTask['kind'],
    goal: text(row, 'goal') ?? '',
    phoneNumber: text(row, 'phone_number') || null,
    language: (text(row, 'language') ?? 'de') as Language,
    summaryLanguage: (text(row, 'summary_language') ?? 'en') as Language,
    userName: text(row, 'user_name'),
    status: (text(row, 'status') ?? 'failed') as SecretaryTask['status'],
    direction: text(row, 'direction') === 'inbound' ? 'inbound' : 'outbound',
    simulated: row['simulated'] === 1,
    providerCallId: text(row, 'provider_call_id'),
    documentText: text(row, 'document_text'),
    lines: parseLines(row['lines_json']),
    transcript: text(row, 'transcript'),
    summary: text(row, 'summary'),
    summarySource: text(row, 'summary_source') as SecretaryTask['summarySource'],
    result: text(row, 'result'),
    todo: text(row, 'todo'),
    todoWhen: text(row, 'todo_when'),
    outcome: text(row, 'outcome') as SecretaryTask['outcome'],
    durationSeconds: typeof duration === 'number' ? duration : null,
    error: text(row, 'error'),
    errorCode: text(row, 'error_code') as SecretaryTask['errorCode'],
    createdAt: text(row, 'created_at') ?? '',
    updatedAt: text(row, 'updated_at') ?? '',
  };
}

function rowToProfile(row: Row): Profile {
  const language = text(row, 'language');
  const callLanguage = text(row, 'call_language');
  return {
    deviceId: text(row, 'device_id') ?? '',
    name: text(row, 'name'),
    language: language === 'de' || language === 'tr' ? language : 'en',
    callLanguage:
      callLanguage === 'de' || callLanguage === 'tr' || callLanguage === 'en' ? callLanguage : null,
    answerCalls: row['answer_calls'] === 1,
    answerNote: text(row, 'answer_note'),
    updatedAt: text(row, 'updated_at') ?? '',
  };
}

export class TaskStore {
  private db: DatabaseSync;
  private closed = false;

  constructor(path: string) {
    if (path !== ':memory:') {
      mkdirSync(dirname(path), { recursive: true });
    }
    this.db = new DatabaseSync(path);
    this.migrate();
  }

  /**
   * The first version of this backend only knew about calls and stored them in
   * a `calls` table. Existing databases are carried forward rather than
   * dropped: rename the table, then add whatever columns it is missing.
   */
  private migrate(): void {
    const tables = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as unknown as { name: string }[];
    const names = new Set(tables.map((t) => t.name));
    if (names.has('calls') && !names.has('tasks')) {
      this.db.exec('ALTER TABLE calls RENAME TO tasks');
    }

    this.db.exec(
      `CREATE TABLE IF NOT EXISTS tasks (${COLUMNS.map((c) => `${c.name} ${c.definition}`).join(', ')})`,
    );

    const existing = new Set(
      (this.db.prepare('PRAGMA table_info(tasks)').all() as unknown as { name: string }[]).map(
        (c) => c.name,
      ),
    );
    for (const column of COLUMNS) {
      if (!existing.has(column.name)) {
        this.db.exec(`ALTER TABLE tasks ADD COLUMN ${column.name} ${column.definition}`);
      }
    }

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_tasks_device ON tasks(device_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_tasks_provider ON tasks(provider_call_id);
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS profiles (
        device_id TEXT PRIMARY KEY,
        name TEXT,
        language TEXT NOT NULL DEFAULT 'en',
        answer_calls INTEGER NOT NULL DEFAULT 0,
        answer_note TEXT,
        updated_at TEXT NOT NULL
      );
    `);
    // Added after the table first shipped: an existing database gains the column.
    const profileColumns = this.db.prepare('PRAGMA table_info(profiles)').all() as Row[];
    if (!profileColumns.some((column) => column['name'] === 'call_language')) {
      this.db.exec('ALTER TABLE profiles ADD COLUMN call_language TEXT');
    }
  }

  // MARK: Tasks

  create(task: SecretaryTask): void {
    this.db
      .prepare(
        `INSERT INTO tasks (${COLUMNS.map((c) => c.name).join(', ')})
         VALUES (${COLUMNS.map(() => '?').join(', ')})`,
      )
      .run(...COLUMNS.map((c) => c.toSql(task)));
  }

  get(id: string): SecretaryTask | undefined {
    if (this.closed) return undefined;
    const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Row | undefined;
    return row ? rowToTask(row) : undefined;
  }

  findByProviderCallId(providerCallId: string): SecretaryTask | undefined {
    if (this.closed) return undefined;
    const row = this.db
      .prepare('SELECT * FROM tasks WHERE provider_call_id = ?')
      .get(providerCallId) as Row | undefined;
    return row ? rowToTask(row) : undefined;
  }

  listByDevice(deviceId: string, limit = 100): SecretaryTask[] {
    if (this.closed) return [];
    const rows = this.db
      .prepare(
        'SELECT * FROM tasks WHERE device_id = ? ORDER BY created_at DESC, id DESC LIMIT ?',
      )
      .all(deviceId, limit) as unknown as Row[];
    return rows.map(rowToTask);
  }

  /** Calls that are still under way, oldest first — for the reconciler. */
  listActiveCalls(): SecretaryTask[] {
    if (this.closed) return [];
    const rows = this.db
      .prepare(
        `SELECT * FROM tasks
         WHERE kind = 'call' AND status IN ('queued', 'dialing', 'in_progress')
         ORDER BY created_at ASC`,
      )
      .all() as unknown as Row[];
    return rows.map(rowToTask);
  }

  /** Finished calls that never got a report — the server stopped while it was being written. */
  listUnreportedCalls(): SecretaryTask[] {
    if (this.closed) return [];
    const rows = this.db
      .prepare(
        `SELECT * FROM tasks
         WHERE kind = 'call' AND status = 'completed' AND summary_source IS NULL
         ORDER BY created_at DESC LIMIT 20`,
      )
      .all() as unknown as Row[];
    return rows.map(rowToTask);
  }

  /** Letters, messages and forms that were accepted but never worked on. */
  listQueuedDocuments(): SecretaryTask[] {
    if (this.closed) return [];
    const rows = this.db
      .prepare(
        `SELECT * FROM tasks
         WHERE status = 'queued' AND kind IN ('letter', 'message', 'form', 'followup')
         ORDER BY created_at ASC`,
      )
      .all() as unknown as Row[];
    return rows.map(rowToTask);
  }

  /** How many real outbound calls were started since `sinceIso`. */
  countOutboundCallsSince(sinceIso: string): number {
    if (this.closed) return 0;
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS n FROM tasks
         WHERE kind = 'call' AND direction = 'outbound' AND simulated = 0 AND created_at >= ?`,
      )
      .get(sinceIso) as { n: number } | undefined;
    return row?.n ?? 0;
  }

  update(id: string, patch: Partial<SecretaryTask>): SecretaryTask | undefined {
    if (this.closed) return undefined;
    const current = this.get(id);
    if (!current) return undefined;
    const next: SecretaryTask = {
      ...current,
      ...patch,
      id: current.id,
      deviceId: current.deviceId,
      kind: current.kind,
      direction: current.direction,
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString(),
    };
    this.db
      .prepare(
        `UPDATE tasks SET ${MUTABLE_COLUMNS.map((c) => `${c.name} = ?`).join(', ')} WHERE id = ?`,
      )
      .run(...MUTABLE_COLUMNS.map((c) => c.toSql(next)), id);
    return next;
  }

  // MARK: Settings

  getSetting(key: string): string | undefined {
    if (this.closed) return undefined;
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
      | { value: string }
      | undefined;
    return row?.value;
  }

  setSetting(key: string, value: string): void {
    if (this.closed) return;
    this.db
      .prepare(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      )
      .run(key, value);
  }

  /** Reads a setting, creating and storing it the first time it is asked for. */
  settingOrCreate(key: string, create: () => string): string {
    const existing = this.getSetting(key);
    if (existing) return existing;
    const value = create();
    this.setSetting(key, value);
    return value;
  }

  // MARK: Profiles

  getProfile(deviceId: string): Profile | undefined {
    if (this.closed) return undefined;
    const row = this.db.prepare('SELECT * FROM profiles WHERE device_id = ?').get(deviceId) as
      | Row
      | undefined;
    return row ? rowToProfile(row) : undefined;
  }

  saveProfile(profile: Omit<Profile, 'updatedAt'>): Profile {
    const saved: Profile = { ...profile, updatedAt: new Date().toISOString() };
    if (this.closed) return saved;
    this.db
      .prepare(
        `INSERT INTO profiles
           (device_id, name, language, call_language, answer_calls, answer_note, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(device_id) DO UPDATE SET
           name = excluded.name,
           language = excluded.language,
           call_language = excluded.call_language,
           answer_calls = excluded.answer_calls,
           answer_note = excluded.answer_note,
           updated_at = excluded.updated_at`,
      )
      .run(
        saved.deviceId,
        saved.name,
        saved.language,
        saved.callLanguage,
        saved.answerCalls ? 1 : 0,
        saved.answerNote,
        saved.updatedAt,
      );
    // One phone number, one person whose calls are answered: whoever switches
    // answering on takes it over. Otherwise two phones would both show "on"
    // while the notes go to only one of them.
    if (saved.answerCalls) {
      this.db
        .prepare('UPDATE profiles SET answer_calls = 0 WHERE device_id != ? AND answer_calls = 1')
        .run(saved.deviceId);
    }
    return saved;
  }

  /**
   * Who an answered call belongs to: the profile that has answering switched
   * on (there is at most one), or failing that the most recently saved one —
   * a call can still be reported after its owner has switched answering off.
   */
  inboundOwner(): Profile | undefined {
    if (this.closed) return undefined;
    const row = this.db
      .prepare('SELECT * FROM profiles ORDER BY answer_calls DESC, updated_at DESC LIMIT 1')
      .get() as Row | undefined;
    return row ? rowToProfile(row) : undefined;
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.db.close();
  }
}

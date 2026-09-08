import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { SecretaryTask } from './types.js';

interface TaskRow {
  id: string;
  device_id: string;
  kind: string;
  goal: string;
  phone_number: string;
  language: string;
  summary_language: string;
  user_name: string | null;
  status: string;
  provider_call_id: string | null;
  document_text: string | null;
  transcript: string | null;
  summary: string | null;
  result: string | null;
  todo: string | null;
  todo_when: string | null;
  outcome: string | null;
  duration_seconds: number | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

function rowToTask(row: TaskRow): SecretaryTask {
  return {
    id: row.id,
    deviceId: row.device_id,
    kind: row.kind as SecretaryTask['kind'],
    goal: row.goal,
    // The column is NOT NULL from the original schema, so non-call tasks store
    // an empty string; the API speaks in nulls.
    phoneNumber: row.phone_number || null,
    language: row.language as SecretaryTask['language'],
    summaryLanguage: row.summary_language as SecretaryTask['summaryLanguage'],
    userName: row.user_name,
    status: row.status as SecretaryTask['status'],
    providerCallId: row.provider_call_id,
    documentText: row.document_text,
    transcript: row.transcript,
    summary: row.summary,
    result: row.result,
    todo: row.todo,
    todoWhen: row.todo_when,
    outcome: row.outcome as SecretaryTask['outcome'],
    durationSeconds: row.duration_seconds,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Columns added after the call-only first version, with their definitions. */
const ADDED_COLUMNS: Record<string, string> = {
  kind: "TEXT NOT NULL DEFAULT 'call'",
  document_text: 'TEXT',
  result: 'TEXT',
  todo: 'TEXT',
  todo_when: 'TEXT',
  duration_seconds: 'INTEGER',
};

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

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        device_id TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'call',
        goal TEXT NOT NULL,
        phone_number TEXT NOT NULL DEFAULT '',
        language TEXT NOT NULL,
        summary_language TEXT NOT NULL,
        user_name TEXT,
        status TEXT NOT NULL,
        provider_call_id TEXT,
        document_text TEXT,
        transcript TEXT,
        summary TEXT,
        result TEXT,
        todo TEXT,
        todo_when TEXT,
        outcome TEXT,
        duration_seconds INTEGER,
        error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    const existing = new Set(
      (this.db.prepare('PRAGMA table_info(tasks)').all() as unknown as { name: string }[]).map(
        (c) => c.name,
      ),
    );
    for (const [column, definition] of Object.entries(ADDED_COLUMNS)) {
      if (!existing.has(column)) {
        this.db.exec(`ALTER TABLE tasks ADD COLUMN ${column} ${definition}`);
      }
    }

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_tasks_device ON tasks(device_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_tasks_provider ON tasks(provider_call_id);
    `);
  }

  create(task: SecretaryTask): void {
    this.db
      .prepare(
        `INSERT INTO tasks (
          id, device_id, kind, goal, phone_number, language, summary_language, user_name,
          status, provider_call_id, document_text, transcript, summary, result,
          todo, todo_when, outcome, duration_seconds, error, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        task.id,
        task.deviceId,
        task.kind,
        task.goal,
        task.phoneNumber ?? '',
        task.language,
        task.summaryLanguage,
        task.userName,
        task.status,
        task.providerCallId,
        task.documentText,
        task.transcript,
        task.summary,
        task.result,
        task.todo,
        task.todoWhen,
        task.outcome,
        task.durationSeconds,
        task.error,
        task.createdAt,
        task.updatedAt,
      );
  }

  get(id: string): SecretaryTask | undefined {
    if (this.closed) return undefined;
    const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as
      | TaskRow
      | undefined;
    return row ? rowToTask(row) : undefined;
  }

  findByProviderCallId(providerCallId: string): SecretaryTask | undefined {
    const row = this.db
      .prepare('SELECT * FROM tasks WHERE provider_call_id = ?')
      .get(providerCallId) as TaskRow | undefined;
    return row ? rowToTask(row) : undefined;
  }

  listByDevice(deviceId: string, limit = 100): SecretaryTask[] {
    const rows = this.db
      .prepare(
        'SELECT * FROM tasks WHERE device_id = ? ORDER BY created_at DESC, id DESC LIMIT ?',
      )
      .all(deviceId, limit) as unknown as TaskRow[];
    return rows.map(rowToTask);
  }

  update(id: string, patch: Partial<SecretaryTask>): SecretaryTask | undefined {
    if (this.closed) return undefined;
    const current = this.get(id);
    if (!current) return undefined;
    const next: SecretaryTask = {
      ...current,
      ...patch,
      id: current.id,
      updatedAt: new Date().toISOString(),
    };
    this.db
      .prepare(
        `UPDATE tasks SET
          status = ?, provider_call_id = ?, document_text = ?, transcript = ?,
          summary = ?, result = ?, todo = ?, todo_when = ?, outcome = ?,
          duration_seconds = ?, error = ?, updated_at = ?
        WHERE id = ?`,
      )
      .run(
        next.status,
        next.providerCallId,
        next.documentText,
        next.transcript,
        next.summary,
        next.result,
        next.todo,
        next.todoWhen,
        next.outcome,
        next.durationSeconds,
        next.error,
        next.updatedAt,
        id,
      );
    return next;
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.db.close();
  }
}

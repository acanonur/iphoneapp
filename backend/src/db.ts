import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { CallTask } from './types.js';

interface CallRow {
  id: string;
  device_id: string;
  goal: string;
  phone_number: string;
  language: string;
  summary_language: string;
  user_name: string | null;
  status: string;
  provider_call_id: string | null;
  transcript: string | null;
  summary: string | null;
  outcome: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

function rowToTask(row: CallRow): CallTask {
  return {
    id: row.id,
    deviceId: row.device_id,
    goal: row.goal,
    phoneNumber: row.phone_number,
    language: row.language as CallTask['language'],
    summaryLanguage: row.summary_language as CallTask['summaryLanguage'],
    userName: row.user_name,
    status: row.status as CallTask['status'],
    providerCallId: row.provider_call_id,
    transcript: row.transcript,
    summary: row.summary,
    outcome: row.outcome as CallTask['outcome'],
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class CallStore {
  private db: DatabaseSync;
  private closed = false;

  constructor(path: string) {
    if (path !== ':memory:') {
      mkdirSync(dirname(path), { recursive: true });
    }
    this.db = new DatabaseSync(path);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS calls (
        id TEXT PRIMARY KEY,
        device_id TEXT NOT NULL,
        goal TEXT NOT NULL,
        phone_number TEXT NOT NULL,
        language TEXT NOT NULL,
        summary_language TEXT NOT NULL,
        user_name TEXT,
        status TEXT NOT NULL,
        provider_call_id TEXT,
        transcript TEXT,
        summary TEXT,
        outcome TEXT,
        error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_calls_device ON calls(device_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_calls_provider ON calls(provider_call_id);
    `);
  }

  create(task: CallTask): void {
    this.db
      .prepare(
        `INSERT INTO calls (
          id, device_id, goal, phone_number, language, summary_language, user_name,
          status, provider_call_id, transcript, summary, outcome, error, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        task.id,
        task.deviceId,
        task.goal,
        task.phoneNumber,
        task.language,
        task.summaryLanguage,
        task.userName,
        task.status,
        task.providerCallId,
        task.transcript,
        task.summary,
        task.outcome,
        task.error,
        task.createdAt,
        task.updatedAt,
      );
  }

  get(id: string): CallTask | undefined {
    if (this.closed) return undefined;
    const row = this.db.prepare('SELECT * FROM calls WHERE id = ?').get(id) as
      | CallRow
      | undefined;
    return row ? rowToTask(row) : undefined;
  }

  findByProviderCallId(providerCallId: string): CallTask | undefined {
    const row = this.db
      .prepare('SELECT * FROM calls WHERE provider_call_id = ?')
      .get(providerCallId) as CallRow | undefined;
    return row ? rowToTask(row) : undefined;
  }

  listByDevice(deviceId: string, limit = 100): CallTask[] {
    const rows = this.db
      .prepare(
        'SELECT * FROM calls WHERE device_id = ? ORDER BY created_at DESC, id DESC LIMIT ?',
      )
      .all(deviceId, limit) as unknown as CallRow[];
    return rows.map(rowToTask);
  }

  update(id: string, patch: Partial<CallTask>): CallTask | undefined {
    if (this.closed) return undefined;
    const current = this.get(id);
    if (!current) return undefined;
    const next: CallTask = {
      ...current,
      ...patch,
      id: current.id,
      updatedAt: new Date().toISOString(),
    };
    this.db
      .prepare(
        `UPDATE calls SET
          status = ?, provider_call_id = ?, transcript = ?, summary = ?,
          outcome = ?, error = ?, updated_at = ?
        WHERE id = ?`,
      )
      .run(
        next.status,
        next.providerCallId,
        next.transcript,
        next.summary,
        next.outcome,
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

/**
 * Delta sync.
 *
 * The contract is deliberately small, because two phones that are often offline
 * (a supermarket basement, a plane, a Turkish holiday on roaming) need something
 * that recovers on its own rather than something clever:
 *
 *   pull(since)  → every row whose rev is greater than `since`, plus the new
 *                  high-water mark. Clients store that mark and pass it back.
 *   push(rows)   → last-writer-wins per row, by the `updatedAt` stamped on the
 *                  device that made the edit. Rows the server already has a
 *                  newer copy of come back in `stale` so the client can drop
 *                  its local version.
 *
 * Deletes are tombstones, never real DELETEs, so "Tugce removed milk" reaches
 * the other phone instead of the item quietly reappearing on the next pull.
 */

import type { DatabaseSync } from 'node:sqlite';
import { ENTITY_KINDS, type EntityKind } from '../../shared/src/types.js';
import { ENTITY_SPECS, ValidationError, fromRow, toColumns } from './entities.js';
import { SearchIndex, documentFor } from './search.js';

export interface PullResult {
  rev: number;
  serverTime: number;
  changes: Partial<Record<EntityKind, Record<string, unknown>[]>>;
}

export interface PushResult {
  rev: number;
  serverTime: number;
  applied: Partial<Record<EntityKind, string[]>>;
  stale: Partial<Record<EntityKind, string[]>>;
  errors: { kind: EntityKind; id: string | null; message: string }[];
}

/** Rows returned by a single pull, so one supermarket trip can't blow up memory. */
const MAX_PULL_ROWS = 5000;
/** Rows accepted in a single push. */
const MAX_PUSH_ROWS = 2000;

export class SyncEngine {
  private readonly search: SearchIndex;
  private readonly maxPullRows: number;

  /** `maxPullRows` is injectable so tests can exercise the paging path cheaply. */
  constructor(
    private readonly db: DatabaseSync,
    options: { maxPullRows?: number } = {},
  ) {
    this.search = new SearchIndex(db);
    this.maxPullRows = options.maxPullRows ?? MAX_PULL_ROWS;
  }

  /**
   * Keep the search index in step with a row that was just written.
   *
   * Reads the stored row back rather than trusting the request body, so a
   * partial update (client omitted a field that has a fallback) still indexes
   * what is actually in the database.
   */
  private reindex(spaceId: string, kind: EntityKind, id: string, deleted: boolean): void {
    if (deleted) {
      this.search.remove(id);
      return;
    }
    const spec = ENTITY_SPECS[kind];
    const stored = this.db.prepare(`SELECT * FROM ${spec.table} WHERE id = ?`).get(id) as
      | Record<string, unknown>
      | undefined;
    if (!stored) return;

    const doc = documentFor(kind, fromRow(spec, stored));
    if (!doc) return;
    this.search.upsert({ ...doc, entityId: id, spaceId });
  }

  /** Current revision of a space. Clients treat it as an opaque cursor. */
  currentRev(spaceId: string): number {
    const row = this.db.prepare('SELECT rev FROM spaces WHERE id = ?').get(spaceId) as
      | { rev: number }
      | undefined;
    return row?.rev ?? 0;
  }

  /**
   * Reserve the next revision number for a space.
   *
   * Must run inside the same transaction as the writes that use it, so a
   * concurrent push can never hand out the same number twice.
   */
  private nextRev(spaceId: string): number {
    this.db.prepare('UPDATE spaces SET rev = rev + 1 WHERE id = ?').run(spaceId);
    return this.currentRev(spaceId);
  }

  /**
   * Everything that changed after `since`, up to a row budget.
   *
   * The returned `rev` is the cursor the client should send next time, and it
   * always lands on a revision boundary: a client must never be told "you are
   * up to date through rev N" when only half of rev N was delivered.
   */
  pull(spaceId: string, since: number, kinds: readonly EntityKind[] = ENTITY_KINDS): PullResult {
    const rev = this.currentRev(spaceId);
    const changes: PullResult['changes'] = {};
    let budget = this.maxPullRows;
    /** The highest revision this response fully covers. */
    let deliveredThrough = rev;
    let truncated = false;

    for (const kind of kinds) {
      if (truncated) break;
      const spec = ENTITY_SPECS[kind];

      const rows = this.db
        .prepare(
          `SELECT * FROM ${spec.table}
           WHERE space_id = ? AND rev > ? AND rev <= ?
           ORDER BY rev ASC LIMIT ?`,
        )
        .all(spaceId, since, deliveredThrough, budget + 1) as Record<string, unknown>[];

      if (rows.length <= budget) {
        if (rows.length > 0) changes[kind] = rows.map((r) => fromRow(spec, r));
        budget -= rows.length;
        continue;
      }

      // Over budget. Cut at the revision boundary before the first row that
      // doesn't fit, so the cursor stays on a complete revision.
      const cut = Number(rows[budget]!.rev);
      const keep = rows.slice(0, budget).filter((r) => Number(r.rev) < cut);
      truncated = true;

      if (keep.length > 0) {
        changes[kind] = keep.map((r) => fromRow(spec, r));
        deliveredThrough = cut - 1;
        continue;
      }

      // A single revision is larger than the entire budget — which is exactly
      // what a big WhatsApp import produces, since it writes every message at
      // one revision. Send that revision whole rather than truncate it: an
      // under-budget response here would leave the cursor where it was and the
      // client would ask for the same thing forever.
      const whole = this.db
        .prepare(`SELECT * FROM ${spec.table} WHERE space_id = ? AND rev = ? ORDER BY id`)
        .all(spaceId, cut) as Record<string, unknown>[];
      changes[kind] = whole.map((r) => fromRow(spec, r));
      deliveredThrough = cut;
    }

    return { rev: deliveredThrough, serverTime: Date.now(), changes };
  }

  /**
   * Apply a batch of client changes.
   *
   * The whole batch runs in one transaction: either the phone's edits all land
   * with a single new revision, or none of them do and the client retries.
   */
  push(
    spaceId: string,
    userId: string,
    incoming: Partial<Record<EntityKind, unknown[]>>,
  ): PushResult {
    const applied: PushResult['applied'] = {};
    const stale: PushResult['stale'] = {};
    const errors: PushResult['errors'] = [];

    const total = Object.values(incoming).reduce((sum, rows) => sum + (rows?.length ?? 0), 0);
    if (total > MAX_PUSH_ROWS) {
      throw new ValidationError(`push contains ${total} rows, the limit is ${MAX_PUSH_ROWS}`);
    }
    if (total === 0) {
      return { rev: this.currentRev(spaceId), serverTime: Date.now(), applied, stale, errors };
    }

    this.db.exec('BEGIN IMMEDIATE');
    try {
      const rev = this.nextRev(spaceId);

      for (const kind of ENTITY_KINDS) {
        const rows = incoming[kind];
        if (!rows || rows.length === 0) continue;

        const spec = ENTITY_SPECS[kind];
        const appliedIds: string[] = [];
        const staleIds: string[] = [];

        for (const raw of rows) {
          let parsed: ReturnType<typeof toColumns>;
          try {
            parsed = toColumns(spec, raw);
          } catch (error) {
            const id =
              typeof raw === 'object' && raw !== null && typeof (raw as { id?: unknown }).id === 'string'
                ? (raw as { id: string }).id
                : null;
            errors.push({
              kind,
              id,
              message: error instanceof Error ? error.message : 'invalid record',
            });
            continue;
          }

          const existing = this.db
            .prepare(`SELECT space_id, updated_at, created_by FROM ${spec.table} WHERE id = ?`)
            .get(parsed.id) as
            | { space_id: string; updated_at: number; created_by: string }
            | undefined;

          if (existing && existing.space_id !== spaceId) {
            errors.push({ kind, id: parsed.id, message: 'id belongs to another space' });
            continue;
          }

          // Last-writer-wins. Equal timestamps keep the stored row, which makes a
          // retried push a no-op instead of a pointless revision bump.
          if (existing && existing.updated_at >= parsed.updatedAt) {
            staleIds.push(parsed.id);
            continue;
          }

          const columns = ['id', 'space_id', 'rev', 'updated_at', 'deleted', 'created_by'];
          const values: unknown[] = [
            parsed.id,
            spaceId,
            rev,
            parsed.updatedAt,
            parsed.deleted,
            // The original author keeps credit for the row; only a genuinely new
            // row is attributed to whoever is pushing.
            existing?.created_by ?? userId,
          ];
          for (const [column, value] of Object.entries(parsed.values)) {
            columns.push(column);
            values.push(value as never);
          }

          const placeholders = columns.map(() => '?').join(', ');
          const updates = columns
            .filter((c) => c !== 'id')
            .map((c) => `${c} = excluded.${c}`)
            .join(', ');

          this.db
            .prepare(
              `INSERT INTO ${spec.table} (${columns.join(', ')}) VALUES (${placeholders})
               ON CONFLICT(id) DO UPDATE SET ${updates}`,
            )
            .run(...(values as never[]));

          this.reindex(spaceId, kind, parsed.id, parsed.deleted === 1);
          appliedIds.push(parsed.id);
        }

        if (appliedIds.length) applied[kind] = appliedIds;
        if (staleIds.length) stale[kind] = staleIds;
      }

      const anyApplied = Object.keys(applied).length > 0;
      if (!anyApplied) {
        // Nothing changed, so give the revision number back rather than leaving
        // a gap that forces every client to re-pull for no reason.
        this.db.exec('ROLLBACK');
        return { rev: this.currentRev(spaceId), serverTime: Date.now(), applied, stale, errors };
      }

      this.db.exec('COMMIT');
      return { rev, serverTime: Date.now(), applied, stale, errors };
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  /**
   * Write rows on the server's own behalf (a WhatsApp import, a completed
   * shopping run). Same revision semantics as a push, without the LWW check —
   * the caller has already decided these rows are authoritative.
   */
  writeRows(
    spaceId: string,
    userId: string,
    kind: EntityKind,
    rows: unknown[],
  ): { rev: number; count: number } {
    if (rows.length === 0) return { rev: this.currentRev(spaceId), count: 0 };
    const spec = ENTITY_SPECS[kind];

    this.db.exec('BEGIN IMMEDIATE');
    try {
      const rev = this.nextRev(spaceId);
      let count = 0;

      for (const raw of rows) {
        const parsed = toColumns(spec, raw);
        const columns = ['id', 'space_id', 'rev', 'updated_at', 'deleted', 'created_by'];
        const values: unknown[] = [parsed.id, spaceId, rev, parsed.updatedAt, parsed.deleted, userId];
        for (const [column, value] of Object.entries(parsed.values)) {
          columns.push(column);
          values.push(value as never);
        }
        const placeholders = columns.map(() => '?').join(', ');
        const updates = columns
          .filter((c) => c !== 'id' && c !== 'created_by')
          .map((c) => `${c} = excluded.${c}`)
          .join(', ');

        this.db
          .prepare(
            `INSERT INTO ${spec.table} (${columns.join(', ')}) VALUES (${placeholders})
             ON CONFLICT(id) DO UPDATE SET ${updates}`,
          )
          .run(...(values as never[]));

        this.reindex(spaceId, kind, parsed.id, parsed.deleted === 1);
        count++;
      }

      this.db.exec('COMMIT');
      return { rev, count };
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
}

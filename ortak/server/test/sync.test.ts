/**
 * Paging behaviour of the delta-sync pull.
 *
 * The cursor a client sends back must always sit on a complete revision, and
 * every pull must move it forward — otherwise a client can get stuck asking for
 * the same data forever.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { openDatabase, Store } from '../src/db.js';
import { SyncEngine } from '../src/sync.js';
import type { EntityKind } from '../../shared/src/types.js';

let db: DatabaseSync;
let spaceId: string;
let userId: string;

beforeEach(() => {
  db = openDatabase(':memory:');
  const store = new Store(db);
  const space = store.createSpace('Ev');
  spaceId = space.id;
  userId = store.addMember(spaceId, 'Onur').user.id;
});

function note(id: string, title: string) {
  return { id, updatedAt: 1, deleted: false, title, body: '', tags: [], pinned: false, exportedAt: null };
}

function message(id: string, body: string) {
  return {
    id,
    updatedAt: 1,
    deleted: false,
    chatName: 'Ev',
    author: 'Onur',
    sentAt: 1,
    body,
    kind: 'message',
    mediaName: null,
    source: 'whatsapp-export',
    importId: 'imp1',
    starred: false,
    tags: [],
  };
}

/**
 * Pull repeatedly until the server reports nothing new.
 *
 * Counts *distinct* ids per kind. A row can legitimately be sent more than
 * once — when a later kind truncates, the cursor drops back below revisions an
 * earlier kind already delivered — and that costs nothing, because applying a
 * row the client already has is a no-op. What must hold is that every row
 * arrives at least once and the loop terminates.
 */
function drain(
  sync: SyncEngine,
  kinds?: EntityKind[],
): { rows: Record<string, number>; pulls: number; delivered: number } {
  const seen: Record<string, Set<string>> = {};
  let cursor = 0;
  let pulls = 0;
  let delivered = 0;

  for (;;) {
    const result = sync.pull(spaceId, cursor, kinds);
    pulls++;

    for (const [kind, list] of Object.entries(result.changes)) {
      seen[kind] ??= new Set();
      for (const row of list ?? []) {
        seen[kind]!.add(String((row as { id: string }).id));
        delivered++;
      }
    }

    if (result.rev === cursor) break;
    cursor = result.rev;

    // A stuck cursor would otherwise spin here forever.
    if (pulls > 50) throw new Error('pull never converged');
  }

  const rows = Object.fromEntries(Object.entries(seen).map(([k, set]) => [k, set.size]));
  return { rows, pulls, delivered };
}

describe('pull paging', () => {
  it('delivers everything in one go when it fits', () => {
    const sync = new SyncEngine(db, { maxPullRows: 100 });
    sync.push(spaceId, userId, { notes: [note('n1', 'One'), note('n2', 'Two')] });

    const result = sync.pull(spaceId, 0);
    expect(result.changes.notes).toHaveLength(2);
  });

  it('stops on a revision boundary rather than mid-revision', () => {
    const sync = new SyncEngine(db, { maxPullRows: 3 });
    // Four revisions of two notes each.
    for (let rev = 0; rev < 4; rev++) {
      sync.push(spaceId, userId, {
        notes: [note(`n${rev}a`, `${rev}a`), note(`n${rev}b`, `${rev}b`)],
      });
    }

    const first = sync.pull(spaceId, 0, ['notes']);
    // Budget 3 cannot fit revisions 1 and 2 (four rows), so it must stop after
    // revision 1 with two rows rather than send three and claim two revisions.
    expect(first.changes.notes).toHaveLength(2);
    expect(first.rev).toBe(1);

    const { rows, pulls } = drain(sync, ['notes']);
    expect(rows.notes).toBe(8);
    expect(pulls).toBeGreaterThan(1);
  });

  it('sends an oversized revision whole instead of stalling', () => {
    // This is the WhatsApp-import shape: every message written at one revision.
    const sync = new SyncEngine(db, { maxPullRows: 5 });
    const bulk = Array.from({ length: 20 }, (_, i) => message(`m${i}`, `message ${i}`));
    sync.writeRows(spaceId, userId, 'archiveMessages', bulk);

    const result = sync.pull(spaceId, 0, ['archiveMessages']);
    // Over budget on purpose — the alternative is a cursor that never moves.
    expect(result.changes.archiveMessages).toHaveLength(20);
    expect(result.rev).toBe(1);

    // And the next pull is genuinely empty.
    const next = sync.pull(spaceId, result.rev, ['archiveMessages']);
    expect(next.changes.archiveMessages ?? []).toHaveLength(0);
    expect(next.rev).toBe(result.rev);
  });

  it('always converges, whatever the mix of revision sizes', () => {
    const sync = new SyncEngine(db, { maxPullRows: 4 });

    sync.writeRows(spaceId, userId, 'archiveMessages', [message('big1', 'x'), message('big2', 'y')]);
    sync.push(spaceId, userId, { notes: [note('n1', 'One')] });
    sync.writeRows(
      spaceId,
      userId,
      'archiveMessages',
      Array.from({ length: 9 }, (_, i) => message(`bulk${i}`, `b${i}`)),
    );
    sync.push(spaceId, userId, { notes: [note('n2', 'Two'), note('n3', 'Three')] });

    const { rows } = drain(sync);
    expect(rows.notes).toBe(3);
    expect(rows.archiveMessages).toBe(11);
  });

  it('never lets the cursor run ahead of what was delivered', () => {
    const sync = new SyncEngine(db, { maxPullRows: 2 });
    for (let rev = 0; rev < 5; rev++) {
      sync.push(spaceId, userId, { notes: [note(`n${rev}`, `note ${rev}`)] });
    }

    // Walk the cursor forward one pull at a time and check that no revision is
    // skipped: everything the server ever sends must be seen exactly once.
    const seen = new Set<string>();
    let cursor = 0;
    for (let i = 0; i < 20; i++) {
      const result = sync.pull(spaceId, cursor, ['notes']);
      for (const row of result.changes.notes ?? []) {
        seen.add(String((row as { id: string }).id));
      }
      if (result.rev === cursor) break;
      cursor = result.rev;
    }

    expect(seen.size).toBe(5);
  });

  it('restricts a pull to the kinds asked for', () => {
    const sync = new SyncEngine(db, { maxPullRows: 100 });
    sync.push(spaceId, userId, { notes: [note('n1', 'One')] });
    sync.writeRows(spaceId, userId, 'archiveMessages', [message('m1', 'hello')]);

    const result = sync.pull(spaceId, 0, ['notes']);
    expect(result.changes.notes).toHaveLength(1);
    expect(result.changes.archiveMessages).toBeUndefined();
  });
});

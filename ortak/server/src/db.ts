import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { SCHEMA_SQL, SCHEMA_VERSION } from './schema.js';
import type { Member, Space } from '../../shared/src/types.js';

/**
 * Columns added after the first release.
 *
 * `CREATE TABLE IF NOT EXISTS` leaves an existing table alone, so new columns
 * have to be added explicitly or an upgraded server would fail on a database
 * that predates them. Every entry here is nullable or defaulted, which keeps
 * the upgrade a no-op for existing rows.
 */
const ADDED_COLUMNS: { table: string; column: string; definition: string }[] = [
  { table: 'events', column: 'calendar_set', definition: 'TEXT' },
  { table: 'notes', column: 'linked_event_id', definition: 'TEXT' },
  { table: 'tasks', column: 'defer_at', definition: 'INTEGER' },
];

function applyColumnMigrations(db: DatabaseSync): void {
  for (const { table, column, definition } of ADDED_COLUMNS) {
    const existing = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (existing.length === 0) continue; // table itself is new; the schema made it
    if (existing.some((c) => c.name === column)) continue;
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function openDatabase(path: string): DatabaseSync {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(SCHEMA_SQL);
  applyColumnMigrations(db);
  db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run(
    'schema_version',
    String(SCHEMA_VERSION),
  );
  return db;
}

export function newId(): string {
  return randomUUID();
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Invite codes are read aloud and typed in by hand, so the alphabet leaves out
 * characters that get confused with each other (0/O, 1/I/l).
 */
function newInviteCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(8);
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += alphabet[bytes[i]! % alphabet.length];
    if (i === 3) code += '-';
  }
  return code;
}

/**
 * Member inks, in the app's Modernist palette.
 *
 * The first member is ink and the second is the accent — the system is mono
 * red, so two people are the system's two inks rather than two arbitrary hues.
 * Anyone after that borrows from the neutral and accent ramps.
 */
const MEMBER_COLORS = ['#201e1d', '#ec3013', '#605d5d', '#ae1800', '#9b9797', '#7c1405'];

export interface AuthenticatedUser {
  id: string;
  spaceId: string;
  name: string;
  color: string;
}

/**
 * Space, membership and token storage.
 *
 * Authentication is a bearer token per member, hashed at rest. That is
 * deliberately modest: this server is meant to hold one household's data, run
 * either on a small VPS or on a machine at home, and the threat model is "don't
 * let a stranger who finds the URL read our shopping list", not multi-tenant
 * SaaS. Everything is scoped by space_id on the server side so a token can only
 * ever reach its own household's rows.
 */
export class Store {
  constructor(readonly db: DatabaseSync) {}

  createSpace(name: string, baseCurrency = 'EUR'): Space {
    const space: Space = {
      id: newId(),
      name,
      baseCurrency,
      rev: 0,
      createdAt: Date.now(),
    };
    const inviteCode = newInviteCode();
    this.db
      .prepare(
        `INSERT INTO spaces (id, name, invite_code, base_currency, rev, created_at)
         VALUES (?, ?, ?, ?, 0, ?)`,
      )
      .run(space.id, space.name, inviteCode, baseCurrency, space.createdAt);
    return space;
  }

  getSpace(spaceId: string): (Space & { inviteCode: string }) | null {
    const row = this.db.prepare('SELECT * FROM spaces WHERE id = ?').get(spaceId) as
      | {
          id: string;
          name: string;
          invite_code: string;
          base_currency: string;
          rev: number;
          created_at: number;
        }
      | undefined;
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      inviteCode: row.invite_code,
      baseCurrency: row.base_currency,
      rev: row.rev,
      createdAt: row.created_at,
    };
  }

  findSpaceByInviteCode(code: string): string | null {
    const normalized = code.trim().toUpperCase();
    const row = this.db.prepare('SELECT id FROM spaces WHERE invite_code = ?').get(normalized) as
      | { id: string }
      | undefined;
    return row?.id ?? null;
  }

  /** Rotate the invite code, e.g. after a phone is lost. */
  rotateInviteCode(spaceId: string): string {
    const code = newInviteCode();
    this.db.prepare('UPDATE spaces SET invite_code = ? WHERE id = ?').run(code, spaceId);
    return code;
  }

  /** Adds a member and returns the one-time plaintext token for their phone. */
  addMember(spaceId: string, name: string): { user: Member; token: string } {
    const existing = this.listMembers(spaceId);
    const color = MEMBER_COLORS[existing.length % MEMBER_COLORS.length]!;
    const token = randomBytes(32).toString('base64url');
    const user: Member = {
      id: newId(),
      spaceId,
      name,
      color,
      createdAt: Date.now(),
    };

    this.db
      .prepare(
        `INSERT INTO users (id, space_id, name, color, token_hash, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(user.id, spaceId, name, color, hashToken(token), user.createdAt);

    return { user, token };
  }

  listMembers(spaceId: string): Member[] {
    const rows = this.db
      .prepare('SELECT id, space_id, name, color, created_at FROM users WHERE space_id = ? ORDER BY created_at')
      .all(spaceId) as {
      id: string;
      space_id: string;
      name: string;
      color: string;
      created_at: number;
    }[];
    return rows.map((r) => ({
      id: r.id,
      spaceId: r.space_id,
      name: r.name,
      color: r.color,
      createdAt: r.created_at,
    }));
  }

  renameMember(userId: string, name: string): void {
    this.db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, userId);
  }

  /**
   * Resolve a bearer token to its owner.
   *
   * The lookup is by hash, and the final comparison is constant-time so the
   * endpoint does not leak token bytes through response timing.
   */
  authenticate(token: string | undefined): AuthenticatedUser | null {
    if (!token) return null;
    const hash = hashToken(token);
    const row = this.db
      .prepare('SELECT id, space_id, name, color, token_hash FROM users WHERE token_hash = ?')
      .get(hash) as
      | { id: string; space_id: string; name: string; color: string; token_hash: string }
      | undefined;
    if (!row) return null;

    const a = Buffer.from(hash, 'hex');
    const b = Buffer.from(row.token_hash, 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    return { id: row.id, spaceId: row.space_id, name: row.name, color: row.color };
  }
}

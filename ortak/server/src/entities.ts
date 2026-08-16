/**
 * The entity registry.
 *
 * Each syncable table is described once — its columns, their types and whether
 * they may be null — and everything else (validation, row↔JSON conversion,
 * upserts, delta pulls) is generated from that description. Adding a new kind of
 * shared thing is a matter of adding one entry here plus a table in schema.ts.
 */

import type { EntityKind } from '../../shared/src/types.js';

export type FieldType = 'text' | 'int' | 'real' | 'bool' | 'json';

export interface FieldSpec {
  /** snake_case database column. */
  column: string;
  type: FieldType;
  /** When false, a null or missing value is rejected. */
  nullable?: boolean;
  /** Used when the client omits the field entirely. */
  fallback?: unknown;
  /** Optional whitelist for enum-ish text columns. */
  oneOf?: readonly string[];
  /** Maximum length for text, to stop a runaway paste filling the disk. */
  maxLength?: number;
}

export interface EntitySpec {
  kind: EntityKind;
  table: string;
  /** Keyed by the JSON property name the app uses. */
  fields: Record<string, FieldSpec>;
}

const TEXT_MAX = 100_000;

export const ENTITY_SPECS: Record<EntityKind, EntitySpec> = {
  events: {
    kind: 'events',
    table: 'events',
    fields: {
      title: { column: 'title', type: 'text', maxLength: 500 },
      notes: { column: 'notes', type: 'text', nullable: true, maxLength: TEXT_MAX },
      location: { column: 'location', type: 'text', nullable: true, maxLength: 500 },
      startsAt: { column: 'starts_at', type: 'int' },
      endsAt: { column: 'ends_at', type: 'int' },
      allDay: { column: 'all_day', type: 'bool', fallback: false },
      timezone: { column: 'timezone', type: 'text', nullable: true, maxLength: 100 },
      reminderMinutes: { column: 'reminder_minutes', type: 'int', nullable: true },
      color: { column: 'color', type: 'text', nullable: true, maxLength: 32 },
    },
  },

  notes: {
    kind: 'notes',
    table: 'notes',
    fields: {
      title: { column: 'title', type: 'text', fallback: '', maxLength: 500 },
      body: { column: 'body', type: 'text', fallback: '', maxLength: TEXT_MAX },
      tags: { column: 'tags', type: 'json', fallback: [] },
      pinned: { column: 'pinned', type: 'bool', fallback: false },
      exportedAt: { column: 'exported_at', type: 'int', nullable: true },
    },
  },

  tasks: {
    kind: 'tasks',
    table: 'tasks',
    fields: {
      title: { column: 'title', type: 'text', maxLength: 500 },
      notes: { column: 'notes', type: 'text', nullable: true, maxLength: TEXT_MAX },
      dueAt: { column: 'due_at', type: 'int', nullable: true },
      assigneeId: { column: 'assignee_id', type: 'text', nullable: true, maxLength: 64 },
      done: { column: 'done', type: 'bool', fallback: false },
      doneAt: { column: 'done_at', type: 'int', nullable: true },
      doneBy: { column: 'done_by', type: 'text', nullable: true, maxLength: 64 },
      category: { column: 'category', type: 'text', nullable: true, maxLength: 100 },
      priority: { column: 'priority', type: 'int', fallback: 0 },
      position: { column: 'position', type: 'real', fallback: 0 },
    },
  },

  shoppingItems: {
    kind: 'shoppingItems',
    table: 'shopping_items',
    fields: {
      name: { column: 'name', type: 'text', maxLength: 300 },
      quantity: { column: 'quantity', type: 'text', nullable: true, maxLength: 100 },
      category: { column: 'category', type: 'text', nullable: true, maxLength: 100 },
      store: { column: 'store', type: 'text', nullable: true, maxLength: 100 },
      checked: { column: 'checked', type: 'bool', fallback: false },
      checkedBy: { column: 'checked_by', type: 'text', nullable: true, maxLength: 64 },
      checkedAt: { column: 'checked_at', type: 'int', nullable: true },
      priceCents: { column: 'price_cents', type: 'int', nullable: true },
      note: { column: 'note', type: 'text', nullable: true, maxLength: 2000 },
      position: { column: 'position', type: 'real', fallback: 0 },
      runId: { column: 'run_id', type: 'text', nullable: true, maxLength: 64 },
    },
  },

  links: {
    kind: 'links',
    table: 'links',
    fields: {
      url: { column: 'url', type: 'text', maxLength: 4000 },
      title: { column: 'title', type: 'text', nullable: true, maxLength: 500 },
      description: { column: 'description', type: 'text', nullable: true, maxLength: 4000 },
      imageUrl: { column: 'image_url', type: 'text', nullable: true, maxLength: 4000 },
      siteName: { column: 'site_name', type: 'text', nullable: true, maxLength: 200 },
      tags: { column: 'tags', type: 'json', fallback: [] },
      note: { column: 'note', type: 'text', nullable: true, maxLength: 4000 },
      archived: { column: 'archived', type: 'bool', fallback: false },
    },
  },

  archiveMessages: {
    kind: 'archiveMessages',
    table: 'archive_messages',
    fields: {
      chatName: { column: 'chat_name', type: 'text', maxLength: 300 },
      author: { column: 'author', type: 'text', nullable: true, maxLength: 200 },
      sentAt: { column: 'sent_at', type: 'int' },
      body: { column: 'body', type: 'text', fallback: '', maxLength: TEXT_MAX },
      kind: {
        column: 'kind',
        type: 'text',
        fallback: 'message',
        oneOf: ['message', 'system', 'media', 'deleted'],
      },
      mediaName: { column: 'media_name', type: 'text', nullable: true, maxLength: 500 },
      source: {
        column: 'source',
        type: 'text',
        fallback: 'manual',
        oneOf: ['whatsapp-export', 'share', 'manual'],
      },
      importId: { column: 'import_id', type: 'text', nullable: true, maxLength: 64 },
      starred: { column: 'starred', type: 'bool', fallback: false },
      tags: { column: 'tags', type: 'json', fallback: [] },
    },
  },

  trips: {
    kind: 'trips',
    table: 'trips',
    fields: {
      name: { column: 'name', type: 'text', maxLength: 300 },
      currency: { column: 'currency', type: 'text', fallback: 'EUR', maxLength: 8 },
      startsAt: { column: 'starts_at', type: 'int', nullable: true },
      endsAt: { column: 'ends_at', type: 'int', nullable: true },
      notes: { column: 'notes', type: 'text', nullable: true, maxLength: TEXT_MAX },
      archived: { column: 'archived', type: 'bool', fallback: false },
    },
  },

  tripMembers: {
    kind: 'tripMembers',
    table: 'trip_members',
    fields: {
      tripId: { column: 'trip_id', type: 'text', maxLength: 64 },
      name: { column: 'name', type: 'text', maxLength: 200 },
      userId: { column: 'user_id', type: 'text', nullable: true, maxLength: 64 },
      color: { column: 'color', type: 'text', nullable: true, maxLength: 32 },
    },
  },

  expenses: {
    kind: 'expenses',
    table: 'expenses',
    fields: {
      tripId: { column: 'trip_id', type: 'text', maxLength: 64 },
      description: { column: 'description', type: 'text', maxLength: 500 },
      amountCents: { column: 'amount_cents', type: 'int' },
      currency: { column: 'currency', type: 'text', fallback: 'EUR', maxLength: 8 },
      rateToTrip: { column: 'rate_to_trip', type: 'real', fallback: 1 },
      paidBy: { column: 'paid_by', type: 'text', maxLength: 64 },
      spentAt: { column: 'spent_at', type: 'int' },
      category: { column: 'category', type: 'text', nullable: true, maxLength: 100 },
      splitMode: {
        column: 'split_mode',
        type: 'text',
        fallback: 'equal',
        oneOf: ['equal', 'shares', 'exact', 'percent'],
      },
      splits: { column: 'splits', type: 'json', fallback: [] },
      note: { column: 'note', type: 'text', nullable: true, maxLength: 4000 },
    },
  },

  settlements: {
    kind: 'settlements',
    table: 'settlements',
    fields: {
      tripId: { column: 'trip_id', type: 'text', maxLength: 64 },
      fromMemberId: { column: 'from_member_id', type: 'text', maxLength: 64 },
      toMemberId: { column: 'to_member_id', type: 'text', maxLength: 64 },
      amountCents: { column: 'amount_cents', type: 'int' },
      settledAt: { column: 'settled_at', type: 'int' },
      note: { column: 'note', type: 'text', nullable: true, maxLength: 4000 },
    },
  },
};

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

function coerceField(name: string, spec: FieldSpec, raw: unknown): unknown {
  const value = raw === undefined ? spec.fallback : raw;

  if (value === null || value === undefined) {
    if (spec.nullable) return null;
    throw new ValidationError(`"${name}" is required`);
  }

  switch (spec.type) {
    case 'text': {
      if (typeof value !== 'string') throw new ValidationError(`"${name}" must be a string`);
      if (spec.maxLength && value.length > spec.maxLength) {
        throw new ValidationError(`"${name}" is longer than ${spec.maxLength} characters`);
      }
      if (spec.oneOf && !spec.oneOf.includes(value)) {
        throw new ValidationError(`"${name}" must be one of ${spec.oneOf.join(', ')}`);
      }
      return value;
    }
    case 'int': {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new ValidationError(`"${name}" must be a number`);
      }
      return Math.trunc(value);
    }
    case 'real': {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new ValidationError(`"${name}" must be a number`);
      }
      return value;
    }
    case 'bool':
      return value ? 1 : 0;
    case 'json': {
      try {
        return JSON.stringify(value);
      } catch {
        throw new ValidationError(`"${name}" is not serialisable`);
      }
    }
  }
}

export interface IncomingRow {
  id: string;
  updatedAt: number;
  deleted: boolean;
  createdBy?: string;
  [key: string]: unknown;
}

/** Validate one client-supplied record and turn it into database column values. */
export function toColumns(
  spec: EntitySpec,
  input: unknown,
): { id: string; updatedAt: number; deleted: number; values: Record<string, unknown> } {
  if (typeof input !== 'object' || input === null) {
    throw new ValidationError('record must be an object');
  }
  const row = input as IncomingRow;

  if (typeof row.id !== 'string' || !ID_RE.test(row.id)) {
    throw new ValidationError('"id" must be 1-64 characters of [A-Za-z0-9_-]');
  }
  if (typeof row.updatedAt !== 'number' || !Number.isFinite(row.updatedAt)) {
    throw new ValidationError('"updatedAt" must be a timestamp in milliseconds');
  }

  const deleted = row.deleted ? 1 : 0;
  const values: Record<string, unknown> = {};

  // A tombstone only needs its sync fields; the payload may legitimately be gone,
  // so missing columns fall back to a stored default rather than being rejected.
  for (const [name, field] of Object.entries(spec.fields)) {
    if (deleted) {
      const raw = row[name];
      values[field.column] =
        raw === undefined || raw === null
          ? field.nullable
            ? null
            : defaultForType(field)
          : coerceField(name, field, raw);
    } else {
      values[field.column] = coerceField(name, field, row[name]);
    }
  }

  return { id: row.id, updatedAt: Math.trunc(row.updatedAt), deleted, values };
}

/**
 * A bindable placeholder for a column a tombstone didn't carry.
 *
 * Must return SQLite-compatible values — a raw `false` or `[]` from a field's
 * `fallback` cannot be bound as a parameter and would fail the whole push.
 */
function defaultForType(field: FieldSpec): unknown {
  if (field.fallback !== undefined) {
    switch (field.type) {
      case 'bool':
        return field.fallback ? 1 : 0;
      case 'json':
        return JSON.stringify(field.fallback);
      default:
        return field.fallback;
    }
  }
  switch (field.type) {
    case 'text':
      return '';
    case 'int':
    case 'real':
    case 'bool':
      return 0;
    case 'json':
      return '[]';
  }
}

/** Turn a database row back into the camelCase shape the app works with. */
export function fromRow(spec: EntitySpec, row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: row.id,
    spaceId: row.space_id,
    rev: row.rev,
    updatedAt: row.updated_at,
    deleted: Boolean(row.deleted),
    createdBy: row.created_by,
  };

  for (const [name, field] of Object.entries(spec.fields)) {
    const value = row[field.column];
    switch (field.type) {
      case 'bool':
        out[name] = Boolean(value);
        break;
      case 'json':
        try {
          out[name] = value === null || value === undefined ? [] : JSON.parse(String(value));
        } catch {
          out[name] = [];
        }
        break;
      default:
        out[name] = value ?? null;
    }
  }

  return out;
}

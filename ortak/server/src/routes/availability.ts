/**
 * Two-way calendar: what each member is already committed to, and when the two
 * of them are actually free.
 *
 * Mirroring events *out* to a device calendar (routes/calendar.ts) only solves
 * half the problem. This is the other half: each phone reads its own calendars
 * — work, university, whatever else is on there — and publishes the times as
 * busy blocks. Only then can the app answer "when can we both do this?", which
 * is the question a shared planner exists to answer.
 *
 * Publishing replaces a whole window at once rather than diffing on the client.
 * A phone says "between these two dates, here is everything I have on", and the
 * server works out what that means for rows it already holds. That keeps the
 * client simple and makes a re-publish after a cancelled meeting correct — the
 * cancellation shows up as an absence, which a diff-based protocol would miss.
 */

import type { FastifyInstance } from 'fastify';
import type { Ctx } from '../context.js';
import { ENTITY_SPECS, fromRow } from '../entities.js';
import { stableHash } from '../../../shared/src/whatsapp.js';
import { findFreeSlots, busyMinutesByOwner, type BusyInterval } from '../../../shared/src/availability.js';

interface PublishBody {
  /** The window this publish is authoritative for. */
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
}

interface SlotsBody {
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
}

const PUBLISH_SCHEMA = {
  body: {
    type: 'object',
    required: ['windowStart', 'windowEnd', 'blocks'],
    additionalProperties: false,
    properties: {
      windowStart: { type: 'number' },
      windowEnd: { type: 'number' },
      blocks: {
        type: 'array',
        maxItems: 2000,
        items: {
          type: 'object',
          required: ['startsAt', 'endsAt'],
          additionalProperties: false,
          properties: {
            startsAt: { type: 'number' },
            endsAt: { type: 'number' },
            allDay: { type: 'boolean' },
            label: { type: ['string', 'null'], maxLength: 500 },
            sourceCalendarId: { type: ['string', 'null'], maxLength: 300 },
            externalId: { type: ['string', 'null'], maxLength: 300 },
          },
        },
      },
    },
  },
} as const;

const SLOTS_SCHEMA = {
  body: {
    type: 'object',
    required: ['from', 'to', 'durationMinutes', 'utcOffsetMinutes'],
    additionalProperties: false,
    properties: {
      from: { type: 'number' },
      to: { type: 'number' },
      durationMinutes: { type: 'number', minimum: 5, maximum: 24 * 60 },
      utcOffsetMinutes: { type: 'number', minimum: -840, maximum: 840 },
      participants: { type: 'array', maxItems: 10, items: { type: 'string', maxLength: 64 } },
      dayStartMinutes: { type: 'number', minimum: 0, maximum: 24 * 60 },
      dayEndMinutes: { type: 'number', minimum: 0, maximum: 24 * 60 },
      weekdays: { type: 'array', maxItems: 7, items: { type: 'number', minimum: 0, maximum: 6 } },
      bufferMinutes: { type: 'number', minimum: 0, maximum: 240 },
      maxResults: { type: 'number', minimum: 1, maximum: 50 },
    },
  },
} as const;

/** Load the household's busy time overlapping a window. */
function loadBusy(ctx: Ctx, spaceId: string, from: number, to: number): BusyInterval[] {
  const rows = ctx.db
    .prepare(
      `SELECT owner_id, starts_at, ends_at, label FROM busy_blocks
       WHERE space_id = ? AND deleted = 0 AND ends_at > ? AND starts_at < ?`,
    )
    .all(spaceId, from, to) as {
    owner_id: string;
    starts_at: number;
    ends_at: number;
    label: string | null;
  }[];

  return rows.map((r) => ({
    ownerId: r.owner_id,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    label: r.label,
  }));
}

/**
 * Shared plans count against availability too — a dinner both of you agreed to
 * is time neither of you is free, whether or not it has reached a phone's
 * calendar yet.
 */
function loadSharedCommitments(ctx: Ctx, spaceId: string, from: number, to: number, members: string[]): BusyInterval[] {
  const rows = ctx.db
    .prepare(
      `SELECT starts_at, ends_at, all_day FROM events
       WHERE space_id = ? AND deleted = 0 AND ends_at > ? AND starts_at < ?`,
    )
    .all(spaceId, from, to) as { starts_at: number; ends_at: number; all_day: number }[];

  // An all-day event does not stop you doing something at 19:00, so it is not
  // treated as busy time.
  return rows
    .filter((r) => !r.all_day)
    .flatMap((r) => members.map((ownerId) => ({ ownerId, startsAt: r.starts_at, endsAt: r.ends_at })));
}

export function registerAvailabilityRoutes(app: FastifyInstance, ctx: Ctx): void {
  /**
   * Replace this member's busy blocks for a window.
   *
   * Ids are derived from the owner and the native event id (or the times, when
   * a calendar gives no stable id), so republishing an unchanged calendar is
   * idempotent and does not churn the revision counter.
   */
  app.post<{ Body: PublishBody }>(
    '/api/availability/publish',
    { schema: PUBLISH_SCHEMA },
    async (request, reply) => {
      const { spaceId, id: userId } = request.user;
      const { windowStart, windowEnd, blocks } = request.body;

      if (windowEnd <= windowStart) {
        return reply
          .code(400)
          .send({ error: 'invalid_window', message: 'windowEnd must be after windowStart.' });
      }

      const now = Date.now();
      const incoming = blocks
        .filter((b) => b.endsAt > b.startsAt)
        .map((b) => {
          const key = b.externalId
            ? `${b.sourceCalendarId ?? ''}|${b.externalId}`
            : `${b.startsAt}|${b.endsAt}|${b.label ?? ''}`;
          return {
            id: `busy-${stableHash(`${userId}|${key}`)}`,
            updatedAt: now,
            deleted: false,
            ownerId: userId,
            startsAt: b.startsAt,
            endsAt: b.endsAt,
            allDay: b.allDay ?? false,
            label: b.label ?? null,
            sourceCalendarId: b.sourceCalendarId ?? null,
            externalId: b.externalId ?? null,
          };
        });

      const keep = new Set(incoming.map((b) => b.id));

      const existing = new Map(
        (
          ctx.db
            .prepare(
              `SELECT * FROM busy_blocks
               WHERE space_id = ? AND owner_id = ? AND deleted = 0
                 AND ends_at > ? AND starts_at < ?`,
            )
            .all(spaceId, userId, windowStart, windowEnd) as Record<string, unknown>[]
        )
          .map((r) => fromRow(ENTITY_SPECS.busyBlocks, r))
          .map((r) => [String(r.id), r] as const),
      );

      /**
       * Only write blocks that actually differ.
       *
       * A phone republishes its calendar on a timer, and almost every publish
       * says exactly what the last one did. Writing those rows anyway would bump
       * the space revision each time and wake both phones for a pull that
       * carries no news.
       */
      const changed = incoming.filter((block) => {
        const previous = existing.get(block.id);
        if (!previous) return true;
        return (
          previous.startsAt !== block.startsAt ||
          previous.endsAt !== block.endsAt ||
          Boolean(previous.allDay) !== block.allDay ||
          (previous.label ?? null) !== block.label ||
          (previous.sourceCalendarId ?? null) !== block.sourceCalendarId ||
          (previous.externalId ?? null) !== block.externalId
        );
      });

      // Anything this member previously published inside the window that is no
      // longer there has been cancelled or deleted on their phone.
      const stale = [...existing.values()]
        .filter((r) => !keep.has(String(r.id)))
        .map((r) => ({ ...r, updatedAt: now, deleted: true }));

      const rows = [...changed, ...stale];
      if (rows.length === 0) {
        return {
          published: incoming.length,
          changed: 0,
          removed: 0,
          rev: ctx.sync.currentRev(spaceId),
        };
      }

      const { rev } = ctx.sync.writeRows(spaceId, userId, 'busyBlocks', rows);
      ctx.hub.publishRev(spaceId, rev, userId);

      return {
        published: incoming.length,
        changed: changed.length,
        removed: stale.length,
        rev,
      };
    },
  );

  /** Drop everything this member has published — the "stop sharing" switch. */
  app.delete('/api/availability/mine', async (request) => {
    const { spaceId, id: userId } = request.user;
    const now = Date.now();

    const rows = (
      ctx.db
        .prepare('SELECT * FROM busy_blocks WHERE space_id = ? AND owner_id = ? AND deleted = 0')
        .all(spaceId, userId) as Record<string, unknown>[]
    )
      .map((r) => fromRow(ENTITY_SPECS.busyBlocks, r))
      .map((r) => ({ ...r, updatedAt: now, deleted: true }));

    if (rows.length === 0) return { removed: 0, rev: ctx.sync.currentRev(spaceId) };

    const { rev } = ctx.sync.writeRows(spaceId, userId, 'busyBlocks', rows);
    ctx.hub.publishRev(spaceId, rev);
    return { removed: rows.length, rev };
  });

  /**
   * When are we all free?
   *
   * The couple-sized answer to Fantastical's "Openings": rather than publishing
   * a booking link for strangers, it proposes times that work for the people in
   * this household, from their real calendars.
   */
  app.post<{ Body: SlotsBody }>('/api/availability/slots', { schema: SLOTS_SCHEMA }, async (request, reply) => {
    const { spaceId } = request.user;
    const body = request.body;

    if (body.to <= body.from) {
      return reply.code(400).send({ error: 'invalid_window', message: 'to must be after from.' });
    }
    // A year of quarter-hours is plenty; more is a runaway client.
    if (body.to - body.from > 366 * 24 * 3600_000) {
      return reply
        .code(400)
        .send({ error: 'window_too_large', message: 'Search at most a year ahead.' });
    }

    const members = ctx.store.listMembers(spaceId).map((m) => m.id);
    const participants = (body.participants?.length ? body.participants : members).filter((id) =>
      members.includes(id),
    );

    if (participants.length === 0) {
      return reply
        .code(400)
        .send({ error: 'no_participants', message: 'Nobody in this space matched.' });
    }

    const busy = [
      ...loadBusy(ctx, spaceId, body.from, body.to),
      ...loadSharedCommitments(ctx, spaceId, body.from, body.to, participants),
    ];

    const slots = findFreeSlots(busy, participants, {
      from: body.from,
      to: body.to,
      durationMinutes: body.durationMinutes,
      utcOffsetMinutes: body.utcOffsetMinutes,
      dayStartMinutes: body.dayStartMinutes,
      dayEndMinutes: body.dayEndMinutes,
      weekdays: body.weekdays,
      bufferMinutes: body.bufferMinutes,
      maxResults: body.maxResults ?? 8,
    });

    return {
      slots,
      participants,
      /** Committed minutes per person, so "who is busier this week" is visible. */
      busyMinutes: busyMinutesByOwner(busy, body.from, body.to),
    };
  });

  /** Raw busy blocks for a window, for drawing the timeline. */
  app.get<{ Querystring: { from?: string; to?: string } }>('/api/availability', async (request) => {
    const from = Number(request.query.from ?? Date.now());
    const to = Number(request.query.to ?? from + 7 * 24 * 3600_000);

    const blocks = loadBusy(ctx, request.user.spaceId, from, to);
    return {
      from,
      to,
      blocks,
      busyMinutes: busyMinutesByOwner(blocks, from, to),
      /** Who has published anything at all, for the "not sharing yet" hint. */
      sharing: [...new Set(blocks.map((b) => b.ownerId))],
    };
  });
}

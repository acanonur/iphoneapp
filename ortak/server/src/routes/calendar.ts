/**
 * Calendar mirroring.
 *
 * A shared Ortak event has to end up in *each* person's own calendar — Onur's
 * iCloud, Tugce's Google — and those are different calendars with different
 * native ids. The phones do the actual writing (through EventKit on iOS and the
 * Calendar Provider on Android, both via expo-calendar); the server's job is to
 * remember which native entry belongs to which shared event for which member, so
 * that editing an event updates the existing entry instead of leaving a
 * duplicate behind.
 *
 * The flow on each phone is:
 *
 *   GET  /api/calendar/pending   → shared events this device hasn't mirrored yet
 *   ...write them into the device calendar with expo-calendar...
 *   POST /api/calendar/mirrors   → record the native ids that came back
 */

import type { FastifyInstance } from 'fastify';
import type { Ctx } from '../context.js';
import { ENTITY_SPECS, fromRow } from '../entities.js';
import { parseQuickAdd } from '../../../shared/src/datetime.js';
import type { EventItem } from '../../../shared/src/types.js';

interface MirrorBody {
  mirrors: {
    eventId: string;
    calendarId: string;
    externalEventId: string;
    mirroredRev: number;
  }[];
}

interface ParseBody {
  text: string;
  now?: number;
  utcOffsetMinutes?: number;
  dateOrder?: 'dmy' | 'mdy';
}

export function registerCalendarRoutes(app: FastifyInstance, ctx: Ctx): void {
  /**
   * Events this member's device still has to write into their own calendar.
   *
   * "Pending" means either never mirrored, or mirrored at an older revision
   * than the event currently has. Deleted events are reported separately so the
   * phone can remove the native entry rather than leave a ghost appointment.
   */
  app.get<{ Querystring: { from?: string; limit?: string } }>(
    '/api/calendar/pending',
    async (request) => {
      const { spaceId, id: userId } = request.user;
      const limit = Math.min(Math.max(Number(request.query.limit ?? 200), 1), 500);
      // By default only look forward; nobody needs last year's dentist visit
      // recreated on a new phone.
      const from = request.query.from ? Number(request.query.from) : Date.now() - 7 * 24 * 3600_000;

      const create = (
        ctx.db
          .prepare(
            `SELECT e.* FROM events e
             LEFT JOIN calendar_mirrors m ON m.event_id = e.id AND m.user_id = ?
             WHERE e.space_id = ? AND e.deleted = 0 AND e.starts_at >= ?
               AND (m.event_id IS NULL OR m.mirrored_rev < e.rev)
             ORDER BY e.starts_at ASC LIMIT ?`,
          )
          .all(userId, spaceId, from, limit) as Record<string, unknown>[]
      ).map((r) => {
        const event = fromRow(ENTITY_SPECS.events, r) as unknown as EventItem;
        const mirror = ctx.db
          .prepare('SELECT calendar_id, external_event_id FROM calendar_mirrors WHERE event_id = ? AND user_id = ?')
          .get(event.id, userId) as { calendar_id: string; external_event_id: string } | undefined;
        return {
          event,
          existing: mirror
            ? { calendarId: mirror.calendar_id, externalEventId: mirror.external_event_id }
            : null,
        };
      });

      const remove = (
        ctx.db
          .prepare(
            `SELECT m.event_id, m.calendar_id, m.external_event_id
             FROM calendar_mirrors m
             JOIN events e ON e.id = m.event_id
             WHERE m.user_id = ? AND e.space_id = ? AND e.deleted = 1
             LIMIT ?`,
          )
          .all(userId, spaceId, limit) as {
          event_id: string;
          calendar_id: string;
          external_event_id: string;
        }[]
      ).map((r) => ({
        eventId: r.event_id,
        calendarId: r.calendar_id,
        externalEventId: r.external_event_id,
      }));

      return { create, remove };
    },
  );

  /** Record the native calendar ids a device produced. */
  app.post<{ Body: MirrorBody }>(
    '/api/calendar/mirrors',
    {
      schema: {
        body: {
          type: 'object',
          required: ['mirrors'],
          additionalProperties: false,
          properties: {
            mirrors: {
              type: 'array',
              maxItems: 500,
              items: {
                type: 'object',
                required: ['eventId', 'calendarId', 'externalEventId', 'mirroredRev'],
                additionalProperties: false,
                properties: {
                  eventId: { type: 'string', maxLength: 64 },
                  calendarId: { type: 'string', maxLength: 300 },
                  externalEventId: { type: 'string', maxLength: 300 },
                  mirroredRev: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    async (request) => {
      const { spaceId, id: userId } = request.user;
      const now = Date.now();
      let saved = 0;

      const insert = ctx.db.prepare(
        `INSERT INTO calendar_mirrors (event_id, user_id, calendar_id, external_event_id, mirrored_rev, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(event_id, user_id) DO UPDATE SET
           calendar_id = excluded.calendar_id,
           external_event_id = excluded.external_event_id,
           mirrored_rev = excluded.mirrored_rev,
           updated_at = excluded.updated_at`,
      );

      for (const m of request.body.mirrors) {
        // Only accept mirrors for events that really belong to this space.
        const owned = ctx.db
          .prepare('SELECT id FROM events WHERE id = ? AND space_id = ?')
          .get(m.eventId, spaceId) as { id: string } | undefined;
        if (!owned) continue;

        insert.run(m.eventId, userId, m.calendarId, m.externalEventId, Math.trunc(m.mirroredRev), now);
        saved++;
      }

      return { saved };
    },
  );

  /** Forget a mirror, after the phone has deleted the native entry. */
  app.delete<{ Params: { eventId: string } }>('/api/calendar/mirrors/:eventId', async (request) => {
    ctx.db
      .prepare('DELETE FROM calendar_mirrors WHERE event_id = ? AND user_id = ?')
      .run(request.params.eventId, request.user.id);
    return { ok: true };
  });

  /**
   * Parse a typed line into a draft event.
   *
   * The app runs the same parser locally so quick-add works with no signal;
   * this endpoint exists so the two can be compared and so any other client
   * (a shortcut, a script) gets the same behaviour.
   */
  app.post<{ Body: ParseBody }>(
    '/api/calendar/parse',
    {
      schema: {
        body: {
          type: 'object',
          required: ['text'],
          additionalProperties: false,
          properties: {
            text: { type: 'string', minLength: 1, maxLength: 1000 },
            now: { type: 'number' },
            utcOffsetMinutes: { type: 'number', minimum: -840, maximum: 840 },
            dateOrder: { type: 'string', enum: ['dmy', 'mdy'] },
          },
        },
      },
    },
    async (request) => {
      const { text, now, utcOffsetMinutes, dateOrder } = request.body;
      return parseQuickAdd(text, { now, utcOffsetMinutes, dateOrder });
    },
  );

  /** Events in a window, for the month and agenda views. */
  app.get<{ Querystring: { from: string; to: string } }>('/api/calendar/events', async (request) => {
    const from = Number(request.query.from ?? 0);
    const to = Number(request.query.to ?? Date.now() + 90 * 24 * 3600_000);

    const rows = ctx.db
      .prepare(
        `SELECT * FROM events
         WHERE space_id = ? AND deleted = 0 AND ends_at >= ? AND starts_at <= ?
         ORDER BY starts_at ASC LIMIT 1000`,
      )
      .all(request.user.spaceId, from, to) as Record<string, unknown>[];

    return { events: rows.map((r) => fromRow(ENTITY_SPECS.events, r)) };
  });
}

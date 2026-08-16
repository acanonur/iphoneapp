/**
 * Trips: the holiday-with-friends money splitter.
 *
 * The maths lives in shared/src/split.ts so the phone can show balances offline
 * and agree with the server exactly. These routes are the read side — the trip
 * itself, its members and its expenses are ordinary synced entities that the app
 * creates through the normal push.
 */

import type { FastifyInstance } from 'fastify';
import type { Ctx } from '../context.js';
import { ENTITY_SPECS, fromRow } from '../entities.js';
import { summarizeTrip, personalView } from '../../../shared/src/split.js';
import type { Expense, Settlement, Trip, TripMember } from '../../../shared/src/types.js';

function loadTrip(ctx: Ctx, spaceId: string, tripId: string): Trip | null {
  const row = ctx.db
    .prepare('SELECT * FROM trips WHERE id = ? AND space_id = ? AND deleted = 0')
    .get(tripId, spaceId) as Record<string, unknown> | undefined;
  return row ? (fromRow(ENTITY_SPECS.trips, row) as unknown as Trip) : null;
}

function loadTripData(
  ctx: Ctx,
  spaceId: string,
  tripId: string,
): { members: TripMember[]; expenses: Expense[]; settlements: Settlement[] } {
  const members = (
    ctx.db
      .prepare('SELECT * FROM trip_members WHERE space_id = ? AND trip_id = ? AND deleted = 0')
      .all(spaceId, tripId) as Record<string, unknown>[]
  ).map((r) => fromRow(ENTITY_SPECS.tripMembers, r) as unknown as TripMember);

  const expenses = (
    ctx.db
      .prepare('SELECT * FROM expenses WHERE space_id = ? AND trip_id = ? AND deleted = 0 ORDER BY spent_at DESC')
      .all(spaceId, tripId) as Record<string, unknown>[]
  ).map((r) => fromRow(ENTITY_SPECS.expenses, r) as unknown as Expense);

  const settlements = (
    ctx.db
      .prepare('SELECT * FROM settlements WHERE space_id = ? AND trip_id = ? AND deleted = 0')
      .all(spaceId, tripId) as Record<string, unknown>[]
  ).map((r) => fromRow(ENTITY_SPECS.settlements, r) as unknown as Settlement);

  return { members, expenses, settlements };
}

export function registerTripRoutes(app: FastifyInstance, ctx: Ctx): void {
  /** All trips with a one-line money summary each. */
  app.get('/api/trips', async (request) => {
    const { spaceId, id: userId } = request.user;

    const trips = (
      ctx.db
        .prepare('SELECT * FROM trips WHERE space_id = ? AND deleted = 0 ORDER BY COALESCE(starts_at, updated_at) DESC')
        .all(spaceId) as Record<string, unknown>[]
    ).map((r) => fromRow(ENTITY_SPECS.trips, r) as unknown as Trip);

    return {
      trips: trips.map((trip) => {
        const { members, expenses, settlements } = loadTripData(ctx, spaceId, trip.id);
        const summary = summarizeTrip(members, expenses, settlements, trip.currency);
        const me = members.find((m) => m.userId === userId);

        return {
          ...trip,
          memberCount: members.length,
          expenseCount: expenses.length,
          totalCents: summary.totalCents,
          /** Positive means the household member is owed money on this trip. */
          myNetCents: me ? personalView(summary, me.id).netCents : null,
        };
      }),
    };
  });

  /**
   * Everything needed to render one trip: members, expenses, balances and the
   * shortest set of payments that settles it.
   */
  app.get<{ Params: { tripId: string } }>('/api/trips/:tripId/summary', async (request, reply) => {
    const { spaceId, id: userId } = request.user;
    const trip = loadTrip(ctx, spaceId, request.params.tripId);
    if (!trip) return reply.code(404).send({ error: 'not_found', message: 'Unknown trip' });

    const { members, expenses, settlements } = loadTripData(ctx, spaceId, trip.id);
    const summary = summarizeTrip(members, expenses, settlements, trip.currency);
    const me = members.find((m) => m.userId === userId);

    const byId = new Map(members.map((m) => [m.id, m]));
    const name = (id: string) => byId.get(id)?.name ?? 'Unknown';

    return {
      trip,
      members,
      expenses,
      settlements,
      summary: {
        currency: summary.currency,
        totalCents: summary.totalCents,
        balances: summary.balances.map((b) => ({ ...b, name: name(b.memberId) })),
        transfers: summary.transfers.map((t) => ({
          ...t,
          fromName: name(t.fromMemberId),
          toName: name(t.toMemberId),
        })),
        problems: summary.problems,
      },
      me: me ? { memberId: me.id, ...personalView(summary, me.id) } : null,
    };
  });

  /**
   * What a single member owes or is owed, for the "settle up" screen.
   *
   * Kept separate from the full summary so the screen a person opens most often
   * doesn't have to download every expense on the trip.
   */
  app.get<{ Params: { tripId: string; memberId: string } }>(
    '/api/trips/:tripId/members/:memberId/balance',
    async (request, reply) => {
      const { spaceId } = request.user;
      const trip = loadTrip(ctx, spaceId, request.params.tripId);
      if (!trip) return reply.code(404).send({ error: 'not_found', message: 'Unknown trip' });

      const { members, expenses, settlements } = loadTripData(ctx, spaceId, trip.id);
      if (!members.some((m) => m.id === request.params.memberId)) {
        return reply.code(404).send({ error: 'not_found', message: 'Unknown trip member' });
      }

      const summary = summarizeTrip(members, expenses, settlements, trip.currency);
      const byId = new Map(members.map((m) => [m.id, m]));
      const view = personalView(summary, request.params.memberId);

      return {
        currency: trip.currency,
        netCents: view.netCents,
        owes: view.owes.map((t) => ({ ...t, toName: byId.get(t.toMemberId)?.name ?? 'Unknown' })),
        isOwed: view.isOwed.map((t) => ({
          ...t,
          fromName: byId.get(t.fromMemberId)?.name ?? 'Unknown',
        })),
      };
    },
  );
}

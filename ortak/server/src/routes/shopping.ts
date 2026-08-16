/**
 * Shopping list extras.
 *
 * The list itself is ordinary synced data — adding an item and ticking it off
 * go through the normal push, which is what makes the live tracking work: one
 * phone pushes, the server nudges the other over the socket, and the tick
 * appears in the next aisle a moment later.
 *
 * What lives here is the part that isn't a simple row edit: closing a shop run,
 * which sweeps the ticked items off the live list into a record of what the trip
 * cost, and the spending history that record builds up.
 */

import type { FastifyInstance } from 'fastify';
import type { Ctx } from '../context.js';
import { newId } from '../db.js';
import { ENTITY_SPECS, fromRow } from '../entities.js';
import type { ShoppingItem } from '../../../shared/src/types.js';

interface CompleteRunBody {
  store?: string;
  /** Prices captured at the till, keyed by item id, in minor units. */
  prices?: Record<string, number>;
}

export function registerShoppingRoutes(app: FastifyInstance, ctx: Ctx): void {
  /**
   * Close the current shop: every ticked item moves into a run and leaves the
   * live list. Unticked items stay, because they are still needed.
   */
  app.post<{ Body: CompleteRunBody }>(
    '/api/shopping/complete-run',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          properties: {
            store: { type: 'string', maxLength: 100 },
            prices: { type: 'object', additionalProperties: { type: 'number' } },
          },
        },
      },
    },
    async (request, reply) => {
      const { spaceId, id: userId } = request.user;
      const prices = request.body?.prices ?? {};

      const checked = (
        ctx.db
          .prepare(
            'SELECT * FROM shopping_items WHERE space_id = ? AND deleted = 0 AND checked = 1 AND run_id IS NULL',
          )
          .all(spaceId) as Record<string, unknown>[]
      ).map((r) => fromRow(ENTITY_SPECS.shoppingItems, r) as unknown as ShoppingItem);

      if (checked.length === 0) {
        return reply.code(422).send({
          error: 'nothing_checked',
          message: 'No ticked items to close out.',
        });
      }

      const runId = newId();
      const now = Date.now();

      const rows = checked.map((item) => ({
        ...item,
        priceCents: prices[item.id] ?? item.priceCents,
        runId,
        updatedAt: now,
        deleted: false,
      }));

      const totalCents = rows.reduce((sum, r) => sum + (r.priceCents ?? 0), 0);
      const { rev } = ctx.sync.writeRows(spaceId, userId, 'shoppingItems', rows);

      ctx.db
        .prepare(
          `INSERT INTO shopping_runs (id, space_id, store, total_cents, item_count, completed_at, completed_by)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(runId, spaceId, request.body?.store ?? null, totalCents, rows.length, now, userId);

      ctx.hub.publishRev(spaceId, rev);
      ctx.hub.clearPresence(spaceId, userId);

      return { runId, itemCount: rows.length, totalCents, completedAt: now, rev };
    },
  );

  /** Past shops, newest first — the spending history. */
  app.get<{ Querystring: { limit?: string } }>('/api/shopping/runs', async (request) => {
    const limit = Math.min(Math.max(Number(request.query.limit ?? 50), 1), 200);
    const rows = ctx.db
      .prepare(
        `SELECT id, store, total_cents, item_count, completed_at, completed_by
         FROM shopping_runs WHERE space_id = ? ORDER BY completed_at DESC LIMIT ?`,
      )
      .all(request.user.spaceId, limit) as {
      id: string;
      store: string | null;
      total_cents: number;
      item_count: number;
      completed_at: number;
      completed_by: string;
    }[];

    return {
      runs: rows.map((r) => ({
        id: r.id,
        store: r.store,
        totalCents: r.total_cents,
        itemCount: r.item_count,
        completedAt: r.completed_at,
        completedBy: r.completed_by,
      })),
    };
  });

  /**
   * Things bought often but not on the list right now.
   *
   * Powers the "add again" row: the ten items this household buys most, so a
   * weekly shop is a few taps rather than typing "milk" for the hundredth time.
   */
  app.get('/api/shopping/suggestions', async (request) => {
    const rows = ctx.db
      .prepare(
        `SELECT name, category, COUNT(*) AS times, MAX(checked_at) AS last_bought
         FROM shopping_items
         WHERE space_id = ? AND deleted = 0 AND run_id IS NOT NULL
         GROUP BY lower(name)
         HAVING times >= 2
         ORDER BY times DESC, last_bought DESC
         LIMIT 20`,
      )
      .all(request.user.spaceId) as {
      name: string;
      category: string | null;
      times: number;
      last_bought: number | null;
    }[];

    const onList = new Set(
      (
        ctx.db
          .prepare(
            'SELECT lower(name) AS name FROM shopping_items WHERE space_id = ? AND deleted = 0 AND run_id IS NULL',
          )
          .all(request.user.spaceId) as { name: string }[]
      ).map((r) => r.name),
    );

    return {
      suggestions: rows
        .filter((r) => !onList.has(r.name.toLowerCase()))
        .map((r) => ({
          name: r.name,
          category: r.category,
          times: r.times,
          lastBought: r.last_bought,
        })),
    };
  });
}

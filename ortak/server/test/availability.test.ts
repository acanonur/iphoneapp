/**
 * The two-way calendar half: publishing what each phone's own calendars say,
 * and asking when everyone is free.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp, type App } from '../src/app.js';
import { loadConfig } from '../src/config.js';

let app: App;

const H = 3600_000;
/** Monday 18 August 2025, 00:00 UTC. */
const MONDAY = Date.UTC(2025, 7, 18);
const at = (dayOffset: number, hour: number) => MONDAY + dayOffset * 24 * H + hour * H;
const iso = (ms: number) => new Date(ms).toISOString();

async function setup() {
  const created = await app.fastify.inject({
    method: 'POST',
    url: '/api/spaces',
    payload: { spaceName: 'Ev', userName: 'Onur' },
  });
  const first = created.json();
  const joined = await app.fastify.inject({
    method: 'POST',
    url: '/api/spaces/join',
    payload: { inviteCode: first.space.inviteCode, userName: 'Tugce' },
  });
  const second = joined.json();
  return {
    onur: { token: first.token, userId: first.user.id },
    tugce: { token: second.token, userId: second.user.id },
  };
}

const auth = (token: string) => ({ authorization: `Bearer ${token}` });

async function publish(
  token: string,
  blocks: { startsAt: number; endsAt: number; label?: string | null; externalId?: string }[],
  window = { windowStart: at(0, 0), windowEnd: at(7, 0) },
) {
  const res = await app.fastify.inject({
    method: 'POST',
    url: '/api/availability/publish',
    headers: auth(token),
    payload: { ...window, blocks },
  });
  return { statusCode: res.statusCode, body: res.json() };
}

async function slots(token: string, payload: Record<string, unknown>) {
  const res = await app.fastify.inject({
    method: 'POST',
    url: '/api/availability/slots',
    headers: auth(token),
    payload: {
      from: at(0, 0),
      to: at(1, 0),
      durationMinutes: 60,
      utcOffsetMinutes: 0,
      dayStartMinutes: 8 * 60,
      dayEndMinutes: 22 * 60,
      ...payload,
    },
  });
  return { statusCode: res.statusCode, body: res.json() };
}

beforeEach(() => {
  app = buildApp({ ...loadConfig({}), dbPath: ':memory:', linkPreviews: false });
});

afterEach(async () => {
  await app.close();
});

describe('publishing availability', () => {
  it('stores blocks and shares them with the other phone', async () => {
    const { onur, tugce } = await setup();

    const result = await publish(onur.token, [
      { startsAt: at(0, 9), endsAt: at(0, 17), label: null, externalId: 'work-mon' },
    ]);
    expect(result.statusCode).toBe(200);
    expect(result.body.published).toBe(1);

    const seen = await app.fastify.inject({
      method: 'GET',
      url: `/api/availability?from=${at(0, 0)}&to=${at(1, 0)}`,
      headers: auth(tugce.token),
    });
    expect(seen.json().blocks).toHaveLength(1);
    expect(seen.json().blocks[0].ownerId).toBe(onur.userId);
    expect(seen.json().sharing).toEqual([onur.userId]);
  });

  it('shares times without titles by default', async () => {
    const { onur, tugce } = await setup();
    await publish(onur.token, [{ startsAt: at(0, 9), endsAt: at(0, 10), externalId: 'x' }]);

    const seen = await app.fastify.inject({
      method: 'GET',
      url: `/api/availability?from=${at(0, 0)}&to=${at(1, 0)}`,
      headers: auth(tugce.token),
    });
    expect(seen.json().blocks[0].label).toBeNull();
  });

  it('passes titles through when the owner shares them', async () => {
    const { onur, tugce } = await setup();
    await publish(onur.token, [
      { startsAt: at(0, 9), endsAt: at(0, 10), label: 'Standup', externalId: 'x' },
    ]);
    const seen = await app.fastify.inject({
      method: 'GET',
      url: `/api/availability?from=${at(0, 0)}&to=${at(1, 0)}`,
      headers: auth(tugce.token),
    });
    expect(seen.json().blocks[0].label).toBe('Standup');
  });

  it('is idempotent — republishing the same calendar changes nothing', async () => {
    const { onur } = await setup();
    const blocks = [{ startsAt: at(0, 9), endsAt: at(0, 17), externalId: 'work-mon' }];

    const first = await publish(onur.token, blocks);
    const second = await publish(onur.token, blocks);

    expect(second.body.published).toBe(1);
    expect(second.body.removed).toBe(0);
    // No new data, so the revision must not move.
    expect(second.body.rev).toBe(first.body.rev);
  });

  it('removes a meeting that has been cancelled on the phone', async () => {
    const { onur, tugce } = await setup();
    await publish(onur.token, [
      { startsAt: at(0, 9), endsAt: at(0, 10), externalId: 'a' },
      { startsAt: at(0, 14), endsAt: at(0, 15), externalId: 'b' },
    ]);

    // The second meeting is gone from the device calendar on the next publish.
    const result = await publish(onur.token, [{ startsAt: at(0, 9), endsAt: at(0, 10), externalId: 'a' }]);
    expect(result.body.removed).toBe(1);

    const seen = await app.fastify.inject({
      method: 'GET',
      url: `/api/availability?from=${at(0, 0)}&to=${at(1, 0)}`,
      headers: auth(tugce.token),
    });
    expect(seen.json().blocks).toHaveLength(1);
  });

  it('leaves blocks outside the published window alone', async () => {
    const { onur } = await setup();
    await publish(onur.token, [{ startsAt: at(5, 9), endsAt: at(5, 10), externalId: 'far' }]);

    // Republish only Monday; the Saturday block is outside that window.
    await publish(onur.token, [], { windowStart: at(0, 0), windowEnd: at(1, 0) });

    const seen = await app.fastify.inject({
      method: 'GET',
      url: `/api/availability?from=${at(0, 0)}&to=${at(7, 0)}`,
      headers: auth(onur.token),
    });
    expect(seen.json().blocks).toHaveLength(1);
  });

  it('keeps each member’s calendars separate', async () => {
    const { onur, tugce } = await setup();
    await publish(onur.token, [{ startsAt: at(0, 9), endsAt: at(0, 10), externalId: 'a' }]);
    await publish(tugce.token, [{ startsAt: at(0, 14), endsAt: at(0, 15), externalId: 'a' }]);

    const seen = await app.fastify.inject({
      method: 'GET',
      url: `/api/availability?from=${at(0, 0)}&to=${at(1, 0)}`,
      headers: auth(onur.token),
    });
    const owners = seen.json().blocks.map((b: { ownerId: string }) => b.ownerId).sort();
    expect(owners).toEqual([onur.userId, tugce.userId].sort());
  });

  it('lets a member stop sharing entirely', async () => {
    const { onur, tugce } = await setup();
    await publish(onur.token, [{ startsAt: at(0, 9), endsAt: at(0, 10), externalId: 'a' }]);
    await publish(tugce.token, [{ startsAt: at(0, 14), endsAt: at(0, 15), externalId: 'b' }]);

    const stopped = await app.fastify.inject({
      method: 'DELETE',
      url: '/api/availability/mine',
      headers: auth(onur.token),
    });
    expect(stopped.json().removed).toBe(1);

    const seen = await app.fastify.inject({
      method: 'GET',
      url: `/api/availability?from=${at(0, 0)}&to=${at(1, 0)}`,
      headers: auth(onur.token),
    });
    expect(seen.json().sharing).toEqual([tugce.userId]);
  });

  it('rejects a backwards window', async () => {
    const { onur } = await setup();
    const result = await publish(onur.token, [], { windowStart: at(1, 0), windowEnd: at(0, 0) });
    expect(result.statusCode).toBe(400);
  });
});

describe('finding a time for both of us', () => {
  it('proposes a slot that works around both calendars', async () => {
    const { onur, tugce } = await setup();
    await publish(onur.token, [{ startsAt: at(0, 9), endsAt: at(0, 17), externalId: 'work' }]);
    await publish(tugce.token, [{ startsAt: at(0, 9), endsAt: at(0, 13), externalId: 'uni' }]);

    // With the day starting at 08:00 there is a real hour free before work.
    const early = await slots(onur.token, { maxResults: 2 });
    expect(early.statusCode).toBe(200);
    expect(iso(early.body.slots[0].startsAt)).toBe(iso(at(0, 8)));

    // Once the working day is excluded, the first opening is after Onur finishes.
    const result = await slots(onur.token, { dayStartMinutes: 9 * 60, maxResults: 2 });
    expect(result.body.slots.length).toBeGreaterThan(0);
    expect(iso(result.body.slots[0].startsAt)).toBe(iso(at(0, 17)));
    expect(result.body.participants.sort()).toEqual([onur.userId, tugce.userId].sort());
  });

  it('counts shared plans as busy even before they reach a phone', async () => {
    const { onur } = await setup();
    await app.fastify.inject({
      method: 'POST',
      url: '/api/sync',
      headers: auth(onur.token),
      payload: {
        changes: {
          events: [
            {
              id: 'ev1',
              updatedAt: 1,
              deleted: false,
              title: 'Dinner',
              startsAt: at(0, 18),
              endsAt: at(0, 21),
              allDay: false,
            },
          ],
        },
      },
    });

    const result = await slots(onur.token, {
      dayStartMinutes: 18 * 60,
      dayEndMinutes: 21 * 60,
      maxResults: 5,
    });
    expect(result.body.slots).toHaveLength(0);
  });

  it('ignores all-day events, which do not block an evening', async () => {
    const { onur } = await setup();
    await app.fastify.inject({
      method: 'POST',
      url: '/api/sync',
      headers: auth(onur.token),
      payload: {
        changes: {
          events: [
            {
              id: 'ev1',
              updatedAt: 1,
              deleted: false,
              title: 'Tugce birthday',
              startsAt: at(0, 0),
              endsAt: at(1, 0),
              allDay: true,
            },
          ],
        },
      },
    });

    const result = await slots(onur.token, { maxResults: 1 });
    expect(result.body.slots.length).toBe(1);
  });

  it('can search for just one person', async () => {
    const { onur, tugce } = await setup();
    await publish(tugce.token, [{ startsAt: at(0, 0), endsAt: at(1, 0), externalId: 'busy-all-day' }]);

    const both = await slots(onur.token, { maxResults: 1 });
    expect(both.body.slots).toHaveLength(0);

    const justOnur = await slots(onur.token, { participants: [onur.userId], maxResults: 1 });
    expect(justOnur.body.slots).toHaveLength(1);
  });

  it('reports how committed each person is', async () => {
    const { onur, tugce } = await setup();
    await publish(onur.token, [{ startsAt: at(0, 9), endsAt: at(0, 17), externalId: 'work' }]);
    await publish(tugce.token, [{ startsAt: at(0, 9), endsAt: at(0, 11), externalId: 'uni' }]);

    const result = await slots(onur.token, {});
    expect(result.body.busyMinutes[onur.userId]).toBe(8 * 60);
    expect(result.body.busyMinutes[tugce.userId]).toBe(2 * 60);
  });

  it('ignores a participant from another household', async () => {
    const { onur } = await setup();
    const other = await setup();
    const result = await slots(onur.token, { participants: [other.onur.userId] });
    expect(result.statusCode).toBe(400);
    expect(result.body.error).toBe('no_participants');
  });

  it('refuses an absurd search window', async () => {
    const { onur } = await setup();
    const result = await slots(onur.token, { from: at(0, 0), to: at(0, 0) + 400 * 24 * H });
    expect(result.statusCode).toBe(400);
    expect(result.body.error).toBe('window_too_large');
  });

  it('needs a token like everything else', async () => {
    await setup();
    const res = await app.fastify.inject({
      method: 'GET',
      url: '/api/availability',
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('nested tags in search', () => {
  it('finds a note by a parent tag it never literally wrote', async () => {
    const { onur } = await setup();
    await app.fastify.inject({
      method: 'POST',
      url: '/api/sync',
      headers: auth(onur.token),
      payload: {
        changes: {
          notes: [
            {
              id: 'n1',
              updatedAt: 1,
              deleted: false,
              title: 'Kombi',
              body: 'servis salı geliyor #ev/tamirat',
            },
          ],
        },
      },
    });

    for (const query of ['ev', 'ev/tamirat', 'tamirat']) {
      const res = await app.fastify.inject({
        method: 'GET',
        url: `/api/search?q=${encodeURIComponent(query)}`,
        headers: auth(onur.token),
      });
      expect(res.json().total, `searching "${query}"`).toBe(1);
    }
  });
});

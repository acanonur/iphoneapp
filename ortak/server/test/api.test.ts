import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp, type App } from '../src/app.js';
import { loadConfig } from '../src/config.js';

let app: App;

/** A space plus two members, which is the shape every test starts from. */
async function setup(): Promise<{
  spaceId: string;
  onur: { token: string; userId: string };
  tugce: { token: string; userId: string };
  inviteCode: string;
}> {
  const created = await app.fastify.inject({
    method: 'POST',
    url: '/api/spaces',
    payload: { spaceName: 'Ev', userName: 'Onur' },
  });
  expect(created.statusCode).toBe(201);
  const first = created.json();

  const joined = await app.fastify.inject({
    method: 'POST',
    url: '/api/spaces/join',
    payload: { inviteCode: first.space.inviteCode, userName: 'Tugce' },
  });
  expect(joined.statusCode).toBe(201);
  const second = joined.json();

  return {
    spaceId: first.space.id,
    inviteCode: first.space.inviteCode,
    onur: { token: first.token, userId: first.user.id },
    tugce: { token: second.token, userId: second.user.id },
  };
}

function auth(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

async function push(token: string, changes: Record<string, unknown[]>) {
  const res = await app.fastify.inject({
    method: 'POST',
    url: '/api/sync',
    headers: auth(token),
    payload: { changes },
  });
  return { statusCode: res.statusCode, body: res.json() };
}

async function pull(token: string, since = 0) {
  const res = await app.fastify.inject({
    method: 'GET',
    url: `/api/sync?since=${since}`,
    headers: auth(token),
  });
  return res.json();
}

beforeEach(() => {
  app = buildApp({ ...loadConfig({}), dbPath: ':memory:', linkPreviews: false });
});

afterEach(async () => {
  await app.close();
});

describe('spaces and membership', () => {
  it('creates a space and issues a token', async () => {
    const res = await app.fastify.inject({
      method: 'POST',
      url: '/api/spaces',
      payload: { spaceName: 'Ev', userName: 'Onur' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.space.inviteCode).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(body.token).toBeTypeOf('string');
    expect(body.user.name).toBe('Onur');
  });

  it('lets a second person join with the invite code', async () => {
    const { onur, tugce } = await setup();
    const me = await app.fastify.inject({ method: 'GET', url: '/api/me', headers: auth(tugce.token) });
    expect(me.statusCode).toBe(200);
    expect(me.json().members.map((m: { name: string }) => m.name).sort()).toEqual(['Onur', 'Tugce']);
    expect(me.json().user.id).not.toBe(onur.userId);
  });

  it('rejects an unknown invite code', async () => {
    const res = await app.fastify.inject({
      method: 'POST',
      url: '/api/spaces/join',
      payload: { inviteCode: 'ZZZZ-ZZZZ', userName: 'Stranger' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('requires a token everywhere else', async () => {
    const res = await app.fastify.inject({ method: 'GET', url: '/api/me' });
    expect(res.statusCode).toBe(401);
    const bad = await app.fastify.inject({
      method: 'GET',
      url: '/api/me',
      headers: auth('not-a-real-token'),
    });
    expect(bad.statusCode).toBe(401);
  });

  it('rotates the invite code', async () => {
    const { onur, inviteCode } = await setup();
    const res = await app.fastify.inject({
      method: 'POST',
      url: '/api/spaces/rotate-invite',
      headers: auth(onur.token),
    });
    expect(res.json().inviteCode).not.toBe(inviteCode);

    const stale = await app.fastify.inject({
      method: 'POST',
      url: '/api/spaces/join',
      payload: { inviteCode, userName: 'Late' },
    });
    expect(stale.statusCode).toBe(404);
  });
});

describe('sync', () => {
  it('round-trips a change from one phone to the other', async () => {
    const { onur, tugce } = await setup();

    const pushed = await push(onur.token, {
      tasks: [
        { id: 'task-1', updatedAt: 1000, deleted: false, title: 'Call the plumber', position: 1 },
      ],
    });
    expect(pushed.statusCode).toBe(200);
    expect(pushed.body.applied.tasks).toEqual(['task-1']);

    const seen = await pull(tugce.token, 0);
    expect(seen.changes.tasks).toHaveLength(1);
    expect(seen.changes.tasks[0].title).toBe('Call the plumber');
    expect(seen.changes.tasks[0].createdBy).toBe(onur.userId);
    expect(seen.rev).toBe(pushed.body.rev);
  });

  it('only returns changes above the cursor', async () => {
    const { onur, tugce } = await setup();
    const first = await push(onur.token, {
      tasks: [{ id: 't1', updatedAt: 1000, deleted: false, title: 'One', position: 1 }],
    });
    await push(onur.token, {
      tasks: [{ id: 't2', updatedAt: 2000, deleted: false, title: 'Two', position: 2 }],
    });

    const delta = await pull(tugce.token, first.body.rev);
    expect(delta.changes.tasks).toHaveLength(1);
    expect(delta.changes.tasks[0].id).toBe('t2');
  });

  it('resolves conflicts by last-writer-wins on updatedAt', async () => {
    const { onur, tugce } = await setup();
    await push(onur.token, {
      tasks: [{ id: 't1', updatedAt: 1000, deleted: false, title: 'Original', position: 1 }],
    });

    const older = await push(tugce.token, {
      tasks: [{ id: 't1', updatedAt: 500, deleted: false, title: 'Stale edit', position: 1 }],
    });
    expect(older.body.stale.tasks).toEqual(['t1']);

    const newer = await push(tugce.token, {
      tasks: [{ id: 't1', updatedAt: 2000, deleted: false, title: 'Newer edit', position: 1 }],
    });
    expect(newer.body.applied.tasks).toEqual(['t1']);

    const state = await pull(onur.token, 0);
    expect(state.changes.tasks[0].title).toBe('Newer edit');
    // The original author keeps credit even though Tugce made the last edit.
    expect(state.changes.tasks[0].createdBy).toBe(onur.userId);
  });

  it('treats a repeated push as a no-op instead of bumping the revision', async () => {
    const { onur } = await setup();
    const row = { id: 't1', updatedAt: 1000, deleted: false, title: 'One', position: 1 };
    const first = await push(onur.token, { tasks: [row] });
    const again = await push(onur.token, { tasks: [row] });

    expect(again.body.stale.tasks).toEqual(['t1']);
    expect(again.body.rev).toBe(first.body.rev);
  });

  it('propagates deletions as tombstones', async () => {
    const { onur, tugce } = await setup();
    await push(onur.token, {
      shoppingItems: [{ id: 's1', updatedAt: 1000, deleted: false, name: 'Milk', position: 1 }],
    });
    const removed = await push(onur.token, {
      shoppingItems: [{ id: 's1', updatedAt: 2000, deleted: true, name: 'Milk', position: 1 }],
    });

    const seen = await pull(tugce.token, 0);
    expect(seen.changes.shoppingItems[0].deleted).toBe(true);
    expect(removed.body.applied.shoppingItems).toEqual(['s1']);
  });

  it('reports invalid rows without failing the whole batch', async () => {
    const { onur } = await setup();
    const res = await push(onur.token, {
      tasks: [
        { id: 'good', updatedAt: 1000, deleted: false, title: 'Fine', position: 1 },
        { id: 'bad', updatedAt: 1000, deleted: false, position: 1 }, // no title
      ],
    });
    expect(res.body.applied.tasks).toEqual(['good']);
    expect(res.body.errors).toHaveLength(1);
    expect(res.body.errors[0].id).toBe('bad');
  });

  it('keeps two households completely separate', async () => {
    const a = await setup();
    const b = await setup();

    await push(a.onur.token, {
      notes: [{ id: 'n1', updatedAt: 1000, deleted: false, title: 'Ours', body: 'secret' }],
    });

    const theirs = await pull(b.onur.token, 0);
    expect(theirs.changes.notes ?? []).toHaveLength(0);

    // And they cannot overwrite our row by guessing its id.
    const collision = await push(b.onur.token, {
      notes: [{ id: 'n1', updatedAt: 5000, deleted: false, title: 'Hijack', body: 'x' }],
    });
    expect(collision.body.errors[0].message).toMatch(/another space/);

    const ours = await pull(a.onur.token, 0);
    expect(ours.changes.notes[0].title).toBe('Ours');
  });
});

describe('search', () => {
  it('finds notes, tasks and links in one query', async () => {
    const { onur } = await setup();
    await push(onur.token, {
      notes: [{ id: 'n1', updatedAt: 1, deleted: false, title: 'Plumber', body: 'Herr Schmidt 030 555' }],
      tasks: [{ id: 't1', updatedAt: 1, deleted: false, title: 'Call plumber back', position: 1 }],
      links: [{ id: 'l1', updatedAt: 1, deleted: false, url: 'https://plumbers.example', title: 'Plumber list' }],
    });

    const res = await app.fastify.inject({
      method: 'GET',
      url: '/api/search?q=plumber',
      headers: auth(onur.token),
    });
    expect(res.json().total).toBe(3);
    expect(new Set(res.json().hits.map((h: { kind: string }) => h.kind))).toEqual(
      new Set(['notes', 'tasks', 'links']),
    );
  });

  it('folds Turkish and German characters both ways', async () => {
    const { onur } = await setup();
    await push(onur.token, {
      notes: [
        { id: 'n1', updatedAt: 1, deleted: false, title: 'Alışveriş listesi', body: 'süt ve ekmek' },
        { id: 'n2', updatedAt: 1, deleted: false, title: 'Straße', body: 'Hauptstraße 5' },
      ],
    });

    const search = async (q: string) => {
      const res = await app.fastify.inject({
        method: 'GET',
        url: `/api/search?q=${encodeURIComponent(q)}`,
        headers: auth(onur.token),
      });
      return res.json().total;
    };

    // The dotless i is the case SQLite's own folding misses.
    expect(await search('alisveris')).toBe(1);
    expect(await search('alışveriş')).toBe(1);
    expect(await search('ALISVERIS')).toBe(1);
    expect(await search('sut')).toBe(1);
    expect(await search('strasse')).toBe(1);
    expect(await search('straße')).toBe(1);
  });

  it('matches prefixes so partial words still find things', async () => {
    const { onur } = await setup();
    await push(onur.token, {
      notes: [{ id: 'n1', updatedAt: 1, deleted: false, title: 'Versicherung', body: 'Allianz police' }],
    });
    const res = await app.fastify.inject({
      method: 'GET',
      url: '/api/search?q=versich',
      headers: auth(onur.token),
    });
    expect(res.json().total).toBe(1);
  });

  it('drops deleted rows out of the index', async () => {
    const { onur } = await setup();
    await push(onur.token, {
      notes: [{ id: 'n1', updatedAt: 1, deleted: false, title: 'Ephemeral', body: 'x' }],
    });
    await push(onur.token, {
      notes: [{ id: 'n1', updatedAt: 2, deleted: true, title: 'Ephemeral', body: 'x' }],
    });

    const res = await app.fastify.inject({
      method: 'GET',
      url: '/api/search?q=ephemeral',
      headers: auth(onur.token),
    });
    expect(res.json().total).toBe(0);
  });

  it('survives punctuation and quotes in the query box', async () => {
    const { onur } = await setup();
    await push(onur.token, {
      notes: [{ id: 'n1', updatedAt: 1, deleted: false, title: 'Wifi', body: 'password is hunter2' }],
    });

    for (const q of ['hunter2*', '"hunter2"', 'wifi OR', '((', 'hunter2 -', '^wifi']) {
      const res = await app.fastify.inject({
        method: 'GET',
        url: `/api/search?q=${encodeURIComponent(q)}`,
        headers: auth(onur.token),
      });
      expect(res.statusCode).toBe(200);
    }
  });

  it('filters by kind', async () => {
    const { onur } = await setup();
    await push(onur.token, {
      notes: [{ id: 'n1', updatedAt: 1, deleted: false, title: 'Reise', body: 'x' }],
      tasks: [{ id: 't1', updatedAt: 1, deleted: false, title: 'Reise buchen', position: 1 }],
    });
    const res = await app.fastify.inject({
      method: 'GET',
      url: '/api/search?q=reise&kinds=tasks',
      headers: auth(onur.token),
    });
    expect(res.json().total).toBe(1);
    expect(res.json().hits[0].kind).toBe('tasks');
  });
});

describe('whatsapp archive', () => {
  const EXPORT = [
    '16.08.2025, 14:03 - Messages and calls are end-to-end encrypted.',
    '16.08.2025, 14:04 - Tugce: Su tesisatçısının numarası 030 555 1234',
    '16.08.2025, 14:05 - Onur: tamam kaydettim',
    '17.08.2025, 09:00 - Tugce: Kombi servisi salı geliyor',
  ].join('\n');

  it('imports an export and makes it searchable', async () => {
    const { onur } = await setup();

    const res = await app.fastify.inject({
      method: 'POST',
      url: '/api/archive/import',
      headers: auth(onur.token),
      payload: { content: EXPORT, filename: 'WhatsApp Chat with Tugce.txt' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().chatName).toBe('Tugce');
    expect(res.json().messageCount).toBe(4);
    expect(res.json().addedCount).toBe(4);

    const found = await app.fastify.inject({
      method: 'GET',
      url: `/api/search?q=${encodeURIComponent('tesisatçı')}`,
      headers: auth(onur.token),
    });
    expect(found.json().total).toBe(1);
    expect(found.json().hits[0].kind).toBe('archiveMessages');

    // ...and typed without the Turkish characters, as it would be on a
    // German keyboard.
    const plain = await app.fastify.inject({
      method: 'GET',
      url: '/api/search?q=tesisatci',
      headers: auth(onur.token),
    });
    expect(plain.json().total).toBe(1);
  });

  it('does not duplicate messages when the same chat is exported again', async () => {
    const { onur } = await setup();
    const payload = { content: EXPORT, filename: 'WhatsApp Chat with Tugce.txt' };

    await app.fastify.inject({
      method: 'POST',
      url: '/api/archive/import',
      headers: auth(onur.token),
      payload,
    });

    const second = await app.fastify.inject({
      method: 'POST',
      url: '/api/archive/import',
      headers: auth(onur.token),
      payload: { ...payload, content: `${EXPORT}\n18.08.2025, 10:00 - Onur: yeni mesaj` },
    });

    expect(second.json().messageCount).toBe(5);
    expect(second.json().addedCount).toBe(1);
    expect(second.json().duplicateCount).toBe(4);

    const chats = await app.fastify.inject({
      method: 'GET',
      url: '/api/archive/chats',
      headers: auth(onur.token),
    });
    expect(chats.json().chats).toHaveLength(1);
    expect(chats.json().chats[0].messageCount).toBe(5);
  });

  it('previews an import without writing anything', async () => {
    const { onur } = await setup();
    const res = await app.fastify.inject({
      method: 'POST',
      url: '/api/archive/import',
      headers: auth(onur.token),
      payload: { content: EXPORT, dryRun: true, filename: 'WhatsApp Chat with Tugce.txt' },
    });
    expect(res.json().dryRun).toBe(true);
    expect(res.json().participants).toEqual(['Onur', 'Tugce']);

    const chats = await app.fastify.inject({
      method: 'GET',
      url: '/api/archive/chats',
      headers: auth(onur.token),
    });
    expect(chats.json().chats).toHaveLength(0);
  });

  it('rejects a file that is not a chat export', async () => {
    const { onur } = await setup();
    const res = await app.fastify.inject({
      method: 'POST',
      url: '/api/archive/import',
      headers: auth(onur.token),
      payload: { content: 'my shopping list\nmilk\nbread' },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error).toBe('no_messages');
  });

  it('pages through a chat and can undo an import', async () => {
    const { onur } = await setup();
    const imported = await app.fastify.inject({
      method: 'POST',
      url: '/api/archive/import',
      headers: auth(onur.token),
      payload: { content: EXPORT, filename: 'WhatsApp Chat with Tugce.txt' },
    });

    const messages = await app.fastify.inject({
      method: 'GET',
      url: '/api/archive/messages?chat=Tugce&limit=2',
      headers: auth(onur.token),
    });
    expect(messages.json().messages).toHaveLength(2);
    expect(messages.json().hasMore).toBe(true);
    // Newest-last ordering, so the view reads like a conversation.
    const times = messages.json().messages.map((m: { sentAt: number }) => m.sentAt);
    expect(times[0]).toBeLessThan(times[1]);

    const undone = await app.fastify.inject({
      method: 'DELETE',
      url: `/api/archive/imports/${imported.json().importId}`,
      headers: auth(onur.token),
    });
    expect(undone.json().deleted).toBe(4);

    const after = await app.fastify.inject({
      method: 'GET',
      url: '/api/archive/chats',
      headers: auth(onur.token),
    });
    expect(after.json().chats).toHaveLength(0);
  });
});

describe('trips and expense splitting', () => {
  async function buildTrip(token: string, userId: string) {
    await push(token, {
      trips: [{ id: 'trip1', updatedAt: 1, deleted: false, name: 'Antalya', currency: 'EUR' }],
      tripMembers: [
        { id: 'm-onur', updatedAt: 1, deleted: false, tripId: 'trip1', name: 'Onur', userId },
        { id: 'm-tugce', updatedAt: 1, deleted: false, tripId: 'trip1', name: 'Tugce', userId: null },
        { id: 'm-ali', updatedAt: 1, deleted: false, tripId: 'trip1', name: 'Ali', userId: null },
      ],
    });
  }

  it('summarises who owes what and how to settle it', async () => {
    const { onur } = await setup();
    await buildTrip(onur.token, onur.userId);

    await push(onur.token, {
      expenses: [
        {
          id: 'e1',
          updatedAt: 2,
          deleted: false,
          tripId: 'trip1',
          description: 'Hotel',
          amountCents: 90000,
          currency: 'EUR',
          rateToTrip: 1,
          paidBy: 'm-onur',
          spentAt: 1000,
          splitMode: 'equal',
          splits: [{ memberId: 'm-onur' }, { memberId: 'm-tugce' }, { memberId: 'm-ali' }],
        },
      ],
    });

    const res = await app.fastify.inject({
      method: 'GET',
      url: '/api/trips/trip1/summary',
      headers: auth(onur.token),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.summary.totalCents).toBe(90000);
    expect(body.summary.transfers).toHaveLength(2);
    expect(body.summary.transfers.every((t: { toName: string }) => t.toName === 'Onur')).toBe(true);
    expect(body.me.memberId).toBe('m-onur');
    expect(body.me.netCents).toBe(60000);
  });

  it('nets out a repayment', async () => {
    const { onur } = await setup();
    await buildTrip(onur.token, onur.userId);
    await push(onur.token, {
      expenses: [
        {
          id: 'e1',
          updatedAt: 2,
          deleted: false,
          tripId: 'trip1',
          description: 'Dinner',
          amountCents: 6000,
          currency: 'EUR',
          rateToTrip: 1,
          paidBy: 'm-onur',
          spentAt: 1000,
          splitMode: 'equal',
          splits: [{ memberId: 'm-onur' }, { memberId: 'm-tugce' }],
        },
      ],
      settlements: [
        {
          id: 'st1',
          updatedAt: 2,
          deleted: false,
          tripId: 'trip1',
          fromMemberId: 'm-tugce',
          toMemberId: 'm-onur',
          amountCents: 3000,
          settledAt: 2000,
        },
      ],
    });

    const res = await app.fastify.inject({
      method: 'GET',
      url: '/api/trips/trip1/summary',
      headers: auth(onur.token),
    });
    expect(res.json().summary.transfers).toHaveLength(0);
  });

  it('handles a foreign-currency expense', async () => {
    const { onur } = await setup();
    await buildTrip(onur.token, onur.userId);
    await push(onur.token, {
      expenses: [
        {
          id: 'e1',
          updatedAt: 2,
          deleted: false,
          tripId: 'trip1',
          description: 'Taxi',
          amountCents: 100000, // 1000,00 TRY
          currency: 'TRY',
          rateToTrip: 0.028,
          paidBy: 'm-tugce',
          spentAt: 1000,
          splitMode: 'equal',
          splits: [{ memberId: 'm-onur' }, { memberId: 'm-tugce' }],
        },
      ],
    });

    const res = await app.fastify.inject({
      method: 'GET',
      url: '/api/trips/trip1/summary',
      headers: auth(onur.token),
    });
    expect(res.json().summary.totalCents).toBe(2800);
    expect(res.json().me.netCents).toBe(-1400);
  });

  it('lists trips with a personal balance line', async () => {
    const { onur } = await setup();
    await buildTrip(onur.token, onur.userId);
    const res = await app.fastify.inject({
      method: 'GET',
      url: '/api/trips',
      headers: auth(onur.token),
    });
    expect(res.json().trips).toHaveLength(1);
    expect(res.json().trips[0].memberCount).toBe(3);
    expect(res.json().trips[0].myNetCents).toBe(0);
  });

  it('404s on an unknown trip', async () => {
    const { onur } = await setup();
    const res = await app.fastify.inject({
      method: 'GET',
      url: '/api/trips/nope/summary',
      headers: auth(onur.token),
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('shopping', () => {
  it('closes a run and remembers what it cost', async () => {
    const { onur, tugce } = await setup();
    await push(onur.token, {
      shoppingItems: [
        { id: 's1', updatedAt: 1, deleted: false, name: 'Milk', position: 1, checked: true },
        { id: 's2', updatedAt: 1, deleted: false, name: 'Bread', position: 2, checked: true },
        { id: 's3', updatedAt: 1, deleted: false, name: 'Eggs', position: 3, checked: false },
      ],
    });

    const done = await app.fastify.inject({
      method: 'POST',
      url: '/api/shopping/complete-run',
      headers: auth(tugce.token),
      payload: { store: 'Rewe', prices: { s1: 129, s2: 249 } },
    });
    expect(done.statusCode).toBe(200);
    expect(done.json().itemCount).toBe(2);
    expect(done.json().totalCents).toBe(378);

    const runs = await app.fastify.inject({
      method: 'GET',
      url: '/api/shopping/runs',
      headers: auth(onur.token),
    });
    expect(runs.json().runs[0].store).toBe('Rewe');
    expect(runs.json().runs[0].totalCents).toBe(378);

    // The unticked item is still on the live list.
    const state = await pull(onur.token, 0);
    const live = state.changes.shoppingItems.filter((i: { runId: string | null }) => i.runId === null);
    expect(live.map((i: { name: string }) => i.name)).toEqual(['Eggs']);
  });

  it('refuses to close a run with nothing ticked', async () => {
    const { onur } = await setup();
    const res = await app.fastify.inject({
      method: 'POST',
      url: '/api/shopping/complete-run',
      headers: auth(onur.token),
      payload: {},
    });
    expect(res.statusCode).toBe(422);
  });

  it('suggests things bought before but not on the list', async () => {
    const { onur } = await setup();
    // Two completed runs that both included milk.
    for (const round of [1, 2]) {
      await push(onur.token, {
        shoppingItems: [
          { id: `milk-${round}`, updatedAt: round, deleted: false, name: 'Milk', position: 1, checked: true },
        ],
      });
      await app.fastify.inject({
        method: 'POST',
        url: '/api/shopping/complete-run',
        headers: auth(onur.token),
        payload: {},
      });
    }

    const res = await app.fastify.inject({
      method: 'GET',
      url: '/api/shopping/suggestions',
      headers: auth(onur.token),
    });
    expect(res.json().suggestions[0].name).toBe('Milk');
    expect(res.json().suggestions[0].times).toBe(2);

    // Once it's back on the live list it stops being suggested.
    await push(onur.token, {
      shoppingItems: [{ id: 'milk-live', updatedAt: 9, deleted: false, name: 'milk', position: 1 }],
    });
    const after = await app.fastify.inject({
      method: 'GET',
      url: '/api/shopping/suggestions',
      headers: auth(onur.token),
    });
    expect(after.json().suggestions).toHaveLength(0);
  });
});

describe('calendar mirroring', () => {
  it('offers each member their own unmirrored events, then stops', async () => {
    const { onur, tugce } = await setup();
    const startsAt = Date.now() + 86_400_000;

    await push(onur.token, {
      events: [
        {
          id: 'ev1',
          updatedAt: 1,
          deleted: false,
          title: 'Dentist',
          startsAt,
          endsAt: startsAt + 3600_000,
          allDay: false,
        },
      ],
    });

    // Both phones see it as pending, because each has its own calendar.
    for (const token of [onur.token, tugce.token]) {
      const res = await app.fastify.inject({
        method: 'GET',
        url: '/api/calendar/pending',
        headers: auth(token),
      });
      expect(res.json().create).toHaveLength(1);
      expect(res.json().create[0].existing).toBeNull();
    }

    const state = await pull(onur.token, 0);
    const rev = state.changes.events[0].rev;

    await app.fastify.inject({
      method: 'POST',
      url: '/api/calendar/mirrors',
      headers: auth(onur.token),
      payload: {
        mirrors: [
          { eventId: 'ev1', calendarId: 'icloud-home', externalEventId: 'EK-123', mirroredRev: rev },
        ],
      },
    });

    const onurPending = await app.fastify.inject({
      method: 'GET',
      url: '/api/calendar/pending',
      headers: auth(onur.token),
    });
    expect(onurPending.json().create).toHaveLength(0);

    // Tugce's phone still has work to do.
    const tugcePending = await app.fastify.inject({
      method: 'GET',
      url: '/api/calendar/pending',
      headers: auth(tugce.token),
    });
    expect(tugcePending.json().create).toHaveLength(1);
  });

  it('re-offers an event after it is edited, with the id to update', async () => {
    const { onur } = await setup();
    const startsAt = Date.now() + 86_400_000;
    await push(onur.token, {
      events: [
        { id: 'ev1', updatedAt: 1, deleted: false, title: 'Dentist', startsAt, endsAt: startsAt + 3600_000 },
      ],
    });
    const rev1 = (await pull(onur.token, 0)).changes.events[0].rev;
    await app.fastify.inject({
      method: 'POST',
      url: '/api/calendar/mirrors',
      headers: auth(onur.token),
      payload: {
        mirrors: [{ eventId: 'ev1', calendarId: 'cal', externalEventId: 'EK-1', mirroredRev: rev1 }],
      },
    });

    await push(onur.token, {
      events: [
        {
          id: 'ev1',
          updatedAt: 2,
          deleted: false,
          title: 'Dentist (moved)',
          startsAt: startsAt + 3600_000,
          endsAt: startsAt + 7200_000,
        },
      ],
    });

    const pending = await app.fastify.inject({
      method: 'GET',
      url: '/api/calendar/pending',
      headers: auth(onur.token),
    });
    expect(pending.json().create).toHaveLength(1);
    // The phone is told which native entry to update rather than creating a duplicate.
    expect(pending.json().create[0].existing.externalEventId).toBe('EK-1');
  });

  it('asks the phone to remove a native entry when the event is deleted', async () => {
    const { onur } = await setup();
    const startsAt = Date.now() + 86_400_000;
    await push(onur.token, {
      events: [{ id: 'ev1', updatedAt: 1, deleted: false, title: 'X', startsAt, endsAt: startsAt + 1000 }],
    });
    await app.fastify.inject({
      method: 'POST',
      url: '/api/calendar/mirrors',
      headers: auth(onur.token),
      payload: { mirrors: [{ eventId: 'ev1', calendarId: 'c', externalEventId: 'EK-9', mirroredRev: 99 }] },
    });
    await push(onur.token, {
      events: [{ id: 'ev1', updatedAt: 2, deleted: true, title: 'X', startsAt, endsAt: startsAt + 1000 }],
    });

    const pending = await app.fastify.inject({
      method: 'GET',
      url: '/api/calendar/pending',
      headers: auth(onur.token),
    });
    expect(pending.json().remove).toEqual([
      { eventId: 'ev1', calendarId: 'c', externalEventId: 'EK-9' },
    ]);
  });

  it('ignores a mirror for an event from another space', async () => {
    const a = await setup();
    const b = await setup();
    const startsAt = Date.now() + 86_400_000;
    await push(a.onur.token, {
      events: [{ id: 'ev1', updatedAt: 1, deleted: false, title: 'X', startsAt, endsAt: startsAt + 1000 }],
    });

    const res = await app.fastify.inject({
      method: 'POST',
      url: '/api/calendar/mirrors',
      headers: auth(b.onur.token),
      payload: { mirrors: [{ eventId: 'ev1', calendarId: 'c', externalEventId: 'X', mirroredRev: 1 }] },
    });
    expect(res.json().saved).toBe(0);
  });

  it('parses a typed line into a draft event', async () => {
    const { onur } = await setup();
    const res = await app.fastify.inject({
      method: 'POST',
      url: '/api/calendar/parse',
      headers: auth(onur.token),
      payload: {
        text: 'dinner with Tugce tomorrow 20:00 @ Mama Trattoria',
        now: Date.UTC(2025, 7, 16, 10, 0),
        utcOffsetMinutes: 0,
      },
    });
    const body = res.json();
    expect(body.title).toBe('dinner with Tugce');
    expect(body.location).toBe('Mama Trattoria');
    expect(new Date(body.startsAt).toISOString()).toBe('2025-08-17T20:00:00.000Z');
  });
});

describe('notes export', () => {
  it('serves a note as plain text for Apple Notes', async () => {
    const { onur } = await setup();
    await push(onur.token, {
      notes: [{ id: 'n1', updatedAt: 1, deleted: false, title: 'Wifi', body: 'password: hunter2' }],
    });

    const res = await app.fastify.inject({
      method: 'GET',
      url: '/api/notes/n1.txt',
      headers: auth(onur.token),
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.body).toBe('Wifi\n\npassword: hunter2');
  });

  it('404s for a note in another space', async () => {
    const a = await setup();
    const b = await setup();
    await push(a.onur.token, {
      notes: [{ id: 'n1', updatedAt: 1, deleted: false, title: 'Secret', body: 'x' }],
    });
    const res = await app.fastify.inject({
      method: 'GET',
      url: '/api/notes/n1.txt',
      headers: auth(b.onur.token),
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('presence', () => {
  it('tracks who is currently shopping', async () => {
    const { onur, tugce } = await setup();
    await app.fastify.inject({
      method: 'POST',
      url: '/api/presence',
      headers: auth(tugce.token),
      payload: { context: 'shopping' },
    });

    const me = await app.fastify.inject({ method: 'GET', url: '/api/me', headers: auth(onur.token) });
    expect(me.json().presence).toHaveLength(1);
    expect(me.json().presence[0].name).toBe('Tugce');
    expect(me.json().presence[0].context).toBe('shopping');
  });
});

describe('health', () => {
  it('reports ok without a token', async () => {
    const res = await app.fastify.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
  });
});

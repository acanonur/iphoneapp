import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp, type App } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { foldWithOffsets, snippetFor } from '../src/search.js';

/**
 * Search results must read back in the writing they were stored in.
 *
 * The FTS columns hold folded text — lowercased, with ı/İ/ß mapped — because
 * that is what makes "tesisatci" match "tesisatçı". Results used to be rendered
 * straight out of those columns, so every hit came back lowercased and
 * de-accented. Worse, the archive screen builds its navigation target from the
 * hit title, so a chat called "Ev Işleri" produced /chat/ev isleri, which
 * matched no chat at all and opened an empty screen.
 */
describe('search results keep their original text', () => {
  let app: App;
  let token: string;

  beforeEach(async () => {
    app = buildApp(loadConfig({ DB_PATH: ':memory:', NODE_ENV: 'test' } as never));
    const created = await app.fastify.inject({
      method: 'POST',
      url: '/api/spaces',
      payload: { spaceName: 'Ev', userName: 'Can' },
    });
    token = created.json().token as string;
  });

  afterEach(async () => {
    await app.fastify.close();
  });

  async function search(q: string) {
    const res = await app.fastify.inject({
      method: 'GET',
      url: `/api/search?q=${encodeURIComponent(q)}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    return res.json().hits as { title: string; snippet: string; context: string }[];
  }

  async function push(kind: string, record: Record<string, unknown>) {
    const res = await app.fastify.inject({
      method: 'POST',
      url: '/api/sync',
      headers: { authorization: `Bearer ${token}` },
      payload: { changes: { [kind]: [record] } },
    });
    expect(res.statusCode).toBe(200);
  }

  it('returns the note title as written, not as folded', async () => {
    await push('notes', {
      id: 'n1',
      title: 'Ev Işleri ve Tesisatçı',
      body: 'Salı günü gelecek. Kapıcı ile konuş.',
      updatedAt: Date.now(),
      deleted: false,
    });

    const hits = await search('isleri');
    expect(hits).toHaveLength(1);
    expect(hits[0]!.title).toBe('Ev Işleri ve Tesisatçı');
  });

  it('finds a folded term but excerpts the unfolded body', async () => {
    await push('notes', {
      id: 'n2',
      title: 'Randevu',
      body: 'Perşembe sabahı tesisatçı geliyor, ödeme nakit.',
      updatedAt: Date.now(),
      deleted: false,
    });

    const hits = await search('tesisatci');
    expect(hits).toHaveLength(1);
    expect(hits[0]!.snippet).toContain('tesisatçı');
    expect(hits[0]!.snippet).toContain('Perşembe');
  });

  it('keeps a chat name intact so the archive can navigate to it', async () => {
    await push('archiveMessages', {
      id: 'm1',
      chatName: 'Ev Işleri',
      author: 'Tugce',
      body: 'Musluk damlıyor',
      sentAt: Date.now(),
      updatedAt: Date.now(),
      deleted: false,
    });

    const hits = await search('musluk');
    expect(hits).toHaveLength(1);
    // This is the exact string the archive screen puts in /chat/<name>, and the
    // server matches chat_name on it with a plain equality test.
    expect(hits[0]!.title).toBe('Ev Işleri');

    const messages = await app.fastify.inject({
      method: 'GET',
      url: `/api/archive/messages?chat=${encodeURIComponent(hits[0]!.title)}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(messages.statusCode).toBe(200);
    expect(messages.json().messages).toHaveLength(1);
  });

  it('folds German eszett without losing the offset mapping', async () => {
    const { folded, offsets } = foldWithOffsets('Straße');
    expect(folded).toBe('strasse');
    // Both 's' characters of the folded eszett point back at the single 'ß'.
    expect(offsets[4]).toBe(4);
    expect(offsets[5]).toBe(4);
    expect(snippetFor('Straße 12', ['strasse'])).toContain('Straße');
  });
});

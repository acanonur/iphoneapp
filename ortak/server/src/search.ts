/**
 * Unified full-text search across everything in a space.
 *
 * ## Why the index is folded by hand
 *
 * FTS5's `unicode61 remove_diacritics 2` already folds ş→s, ğ→g, ö→o, ü→u and
 * ç→c, which covers most Turkish and all German. It does *not* fold the Turkish
 * dotless ı, because that is a distinct letter rather than an accented i. The
 * practical effect is that "alisveris" typed on a phone keyboard set to English
 * would never find "Alışveriş listesi" — exactly the search this household will
 * run. So both the indexed text and the query go through `foldSearchText`
 * first, and the index is maintained by the application rather than by SQL
 * triggers (external-content FTS5 requires the indexed text to match the base
 * table byte for byte, which folding breaks).
 *
 * ß→ss is folded for the same reason: "strasse" should find "Straße".
 */

import type { DatabaseSync } from 'node:sqlite';
import type { EntityKind } from '../../shared/src/types.js';
import { expandedTags } from '../../shared/src/tags.js';

/** Characters SQLite's tokenizer will not fold for us. */
const FOLD_MAP: Record<string, string> = {
  ı: 'i',
  İ: 'i',
  ß: 'ss',
  ẞ: 'ss',
};

export function foldSearchText(input: string): string {
  let out = '';
  for (const ch of input) out += FOLD_MAP[ch] ?? ch;
  // Lowercasing after the map avoids JS turning 'İ' into 'i' + U+0307.
  return out.toLowerCase();
}

/**
 * Turn whatever the user typed into a safe FTS5 MATCH expression.
 *
 * Every bare word becomes a quoted prefix term, so "plumb" finds "plumber" and
 * a stray `"` or `*` in the box can never become a syntax error. Quoted phrases
 * are preserved as phrases.
 */
export function buildFtsQuery(raw: string): string | null {
  const folded = foldSearchText(raw).trim();
  if (!folded) return null;

  const terms: string[] = [];
  const phraseRe = /"([^"]*)"|(\S+)/g;
  let m: RegExpExecArray | null;

  while ((m = phraseRe.exec(folded)) !== null) {
    if (m[1] !== undefined) {
      const phrase = m[1].replace(/"/g, '').trim();
      if (phrase) terms.push(`"${phrase}"`);
    } else {
      // Strip FTS5 operator characters; what's left is matched as a prefix.
      const word = m[2]!.replace(/["*(){}:^\-]/g, '').trim();
      if (word) terms.push(`"${word}"*`);
    }
  }

  return terms.length ? terms.join(' ') : null;
}

export interface SearchDocument {
  entityId: string;
  spaceId: string;
  kind: EntityKind;
  title: string;
  body: string;
  /** Author, chat name, category — searchable but weighted below the title. */
  context: string;
  /** Timestamp used for recency ordering and date filtering. */
  sortAt: number;
}

export interface SearchHit {
  entityId: string;
  kind: EntityKind;
  title: string;
  snippet: string;
  context: string;
  sortAt: number;
  score: number;
}

export interface SearchOptions {
  kinds?: EntityKind[];
  from?: number;
  to?: number;
  limit?: number;
  offset?: number;
  /** 'relevance' (default) or 'recent'. */
  order?: 'relevance' | 'recent';
}

export class SearchIndex {
  constructor(private readonly db: DatabaseSync) {}

  /** Insert or replace one document. Deleted entities are removed entirely. */
  upsert(doc: SearchDocument): void {
    const docId = this.docId(doc.entityId);
    this.db.prepare('DELETE FROM search_index WHERE rowid = ?').run(docId);
    this.db
      .prepare(
        `INSERT INTO search_index (rowid, title, body, context, entity_id, space_id, kind, sort_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        docId,
        foldSearchText(doc.title),
        foldSearchText(doc.body),
        foldSearchText(doc.context),
        doc.entityId,
        doc.spaceId,
        doc.kind,
        doc.sortAt,
      );
  }

  remove(entityId: string): void {
    const row = this.db
      .prepare('SELECT doc_id FROM search_docs WHERE entity_id = ?')
      .get(entityId) as { doc_id: number } | undefined;
    if (!row) return;
    this.db.prepare('DELETE FROM search_index WHERE rowid = ?').run(row.doc_id);
  }

  private docId(entityId: string): number {
    const existing = this.db
      .prepare('SELECT doc_id FROM search_docs WHERE entity_id = ?')
      .get(entityId) as { doc_id: number } | undefined;
    if (existing) return existing.doc_id;

    this.db.prepare('INSERT INTO search_docs (entity_id) VALUES (?)').run(entityId);
    const created = this.db
      .prepare('SELECT doc_id FROM search_docs WHERE entity_id = ?')
      .get(entityId) as { doc_id: number };
    return created.doc_id;
  }

  search(spaceId: string, query: string, options: SearchOptions = {}): SearchHit[] {
    const match = buildFtsQuery(query);
    if (!match) return [];

    const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
    const offset = Math.max(options.offset ?? 0, 0);

    const where: string[] = ['search_index MATCH ?', 'space_id = ?'];
    const params: unknown[] = [match, spaceId];

    if (options.kinds?.length) {
      where.push(`kind IN (${options.kinds.map(() => '?').join(', ')})`);
      params.push(...options.kinds);
    }
    if (options.from !== undefined) {
      where.push('sort_at >= ?');
      params.push(options.from);
    }
    if (options.to !== undefined) {
      where.push('sort_at <= ?');
      params.push(options.to);
    }

    // Weight the title above the body and the context below it.
    const order =
      options.order === 'recent'
        ? 'sort_at DESC'
        : 'bm25(search_index, 10.0, 3.0, 1.0) ASC, sort_at DESC';

    const sql = `
      SELECT entity_id, kind, title, context, sort_at,
             bm25(search_index, 10.0, 3.0, 1.0) AS score,
             snippet(search_index, 1, '⟦', '⟧', '…', 24) AS snip
      FROM search_index
      WHERE ${where.join(' AND ')}
      ORDER BY ${order}
      LIMIT ? OFFSET ?`;

    const rows = this.db.prepare(sql).all(...(params as never[]), limit, offset) as {
      entity_id: string;
      kind: string;
      title: string;
      context: string;
      sort_at: number;
      score: number;
      snip: string;
    }[];

    return rows.map((r) => ({
      entityId: r.entity_id,
      kind: r.kind as EntityKind,
      title: r.title,
      snippet: r.snip,
      context: r.context,
      sortAt: r.sort_at,
      score: -r.score,
    }));
  }

  /** Total matches, for "showing 50 of 1,284". */
  count(spaceId: string, query: string, options: SearchOptions = {}): number {
    const match = buildFtsQuery(query);
    if (!match) return 0;

    const where: string[] = ['search_index MATCH ?', 'space_id = ?'];
    const params: unknown[] = [match, spaceId];
    if (options.kinds?.length) {
      where.push(`kind IN (${options.kinds.map(() => '?').join(', ')})`);
      params.push(...options.kinds);
    }
    if (options.from !== undefined) {
      where.push('sort_at >= ?');
      params.push(options.from);
    }
    if (options.to !== undefined) {
      where.push('sort_at <= ?');
      params.push(options.to);
    }

    const row = this.db
      .prepare(`SELECT COUNT(*) AS n FROM search_index WHERE ${where.join(' AND ')}`)
      .get(...(params as never[])) as { n: number };
    return row.n;
  }
}

/**
 * Describe an entity row for the search index.
 *
 * Returns null for kinds that aren't worth indexing (trip members, settlements),
 * which keeps the index focused on things a person would actually search for.
 */
export function documentFor(
  kind: EntityKind,
  row: Record<string, unknown>,
): Omit<SearchDocument, 'spaceId' | 'entityId'> | null {
  const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
  const num = (v: unknown): number => (typeof v === 'number' ? v : 0);

  switch (kind) {
    case 'events':
      return {
        kind,
        title: str(row.title),
        body: [str(row.notes), str(row.location)].filter(Boolean).join('\n'),
        context: str(row.location),
        sortAt: num(row.startsAt),
      };
    case 'notes': {
      // Index every level of a nested tag, so searching "ev" finds a note
      // tagged #ev/tamirat as well as one tagged #ev.
      const written = expandedTags(`${str(row.title)}\n${str(row.body)}`);
      const explicit = (Array.isArray(row.tags) ? row.tags : []).flatMap((t) =>
        expandedTags(`#${String(t)}`),
      );
      return {
        kind,
        title: str(row.title),
        body: str(row.body),
        context: [...new Set([...written, ...explicit])].join(' '),
        sortAt: num(row.updatedAt),
      };
    }
    case 'tasks':
      return {
        kind,
        title: str(row.title),
        body: str(row.notes),
        context: str(row.category),
        sortAt: num(row.dueAt) || num(row.updatedAt),
      };
    case 'shoppingItems':
      return {
        kind,
        title: str(row.name),
        body: str(row.note),
        context: [str(row.category), str(row.store)].filter(Boolean).join(' '),
        sortAt: num(row.updatedAt),
      };
    case 'links':
      return {
        kind,
        title: str(row.title) || str(row.url),
        body: [str(row.description), str(row.note), str(row.url)].filter(Boolean).join('\n'),
        context: [str(row.siteName), ...(Array.isArray(row.tags) ? row.tags : [])]
          .filter(Boolean)
          .join(' '),
        sortAt: num(row.updatedAt),
      };
    case 'archiveMessages':
      return {
        kind,
        title: str(row.chatName),
        body: str(row.body),
        context: [str(row.author), str(row.chatName)].filter(Boolean).join(' '),
        sortAt: num(row.sentAt),
      };
    case 'trips':
      return {
        kind,
        title: str(row.name),
        body: str(row.notes),
        context: str(row.currency),
        sortAt: num(row.startsAt) || num(row.updatedAt),
      };
    case 'expenses':
      return {
        kind,
        title: str(row.description),
        body: str(row.note),
        context: str(row.category),
        sortAt: num(row.spentAt),
      };
    default:
      return null;
  }
}

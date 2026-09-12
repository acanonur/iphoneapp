/**
 * Nested tags and wiki-links for the shared notebook.
 *
 * Two ideas, taken from the two apps that do them best:
 *
 *  - **Bear's nested tags.** `#ev/tamirat` files a note under "ev" *and*
 *    "ev/tamirat" at once, so a hierarchy appears from typing rather than from
 *    dragging things into folders. Multi-word tags use Bear's closing-hash form,
 *    `#ev isleri#`.
 *  - **Craft's backlinks.** `[[Plumber]]` links one note to another, and the
 *    target note learns what points at it. That is what turns a pile of notes
 *    into something you can actually find your way around — the "database for
 *    daily life" this app is for.
 *
 * Everything is pure text analysis, so it runs on the phone with no signal and
 * on the server for indexing.
 */

/** A word character, Unicode-aware so Turkish and German tags work. */
const TAG_BODY = "[\\p{L}\\p{N}_][\\p{L}\\p{N}_\\-]*";

/**
 * `#ev/tamirat`, `#work`, and Bear's `#multi word#` form.
 *
 * The two forms are genuinely ambiguous — in `#ev #is` the second hash could be
 * read as closing a multi-word tag called "ev ". Two rules settle it:
 *
 *  - the multi-word branch is tried first, so `#ev isleri#` is not truncated to
 *    `#ev` by the simpler pattern, and
 *  - its closing hash must be followed by whitespace, punctuation or the end of
 *    the text, which is what stops `#ev #is` from collapsing into one tag.
 */
const TAG_RE = new RegExp(
  `(?:^|[\\s(\\[])#([^#\\n]{0,58}[^#\\s\\n])#(?=[\\s.,;:!?)\\]]|$)` +
    `|(?:^|[\\s(\\[])#(${TAG_BODY}(?:/${TAG_BODY})*)(?![\\w/#])`,
  'giu',
);

/** `[[Another note]]`, optionally `[[Another note|shown text]]`. */
const WIKI_RE = /\[\[([^\]|\n]{1,200})(?:\|([^\]\n]{1,200}))?\]\]/g;

export interface ParsedTag {
  /** Full path as written, lower-cased: "ev/tamirat". */
  path: string;
  /** Every level, so a note tagged "ev/tamirat" also lists under "ev". */
  ancestors: string[];
  /** Last segment, for display: "tamirat". */
  leaf: string;
}

export function normaliseTag(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^\/+|\/+$/g, '')
    .toLowerCase();
}

/** Expand "a/b/c" into ["a", "a/b", "a/b/c"]. */
export function tagAncestors(path: string): string[] {
  const parts = path.split('/').filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    out.push(parts.slice(0, i + 1).join('/'));
  }
  return out;
}

/** Every tag written in a piece of text, de-duplicated and in order. */
export function parseTags(text: string): ParsedTag[] {
  const seen = new Set<string>();
  const tags: ParsedTag[] = [];

  TAG_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TAG_RE.exec(text)) !== null) {
    const raw = match[1] ?? match[2];
    if (!raw) continue;

    const path = normaliseTag(raw);
    if (!path || seen.has(path)) continue;
    seen.add(path);

    const ancestors = tagAncestors(path);
    tags.push({ path, ancestors, leaf: ancestors[ancestors.length - 1]!.split('/').pop() ?? path });
  }

  return tags;
}

/** Every tag plus its parents — what a note should actually be indexed under. */
export function expandedTags(text: string): string[] {
  const all = new Set<string>();
  for (const tag of parseTags(text)) {
    for (const ancestor of tag.ancestors) all.add(ancestor);
  }
  return [...all].sort();
}

export interface TagNode {
  /** Full path, e.g. "ev/tamirat". */
  path: string;
  /** Last segment, for display. */
  name: string;
  /** Notes carrying this exact tag. */
  count: number;
  /** Notes carrying this tag or anything beneath it. */
  totalCount: number;
  children: TagNode[];
}

/**
 * Build the tag sidebar from a list of tagged items.
 *
 * Counts roll up, so "ev" shows the total of everything filed beneath it —
 * which is the behaviour that makes a nested tag worth having over a flat one.
 */
export function buildTagTree(taggedItems: readonly (readonly string[])[]): TagNode[] {
  const exact = new Map<string, number>();
  const rolled = new Map<string, number>();

  for (const tags of taggedItems) {
    const expanded = new Set<string>();
    for (const tag of tags) {
      const path = normaliseTag(tag);
      if (!path) continue;
      exact.set(path, (exact.get(path) ?? 0) + 1);
      for (const ancestor of tagAncestors(path)) expanded.add(ancestor);
    }
    for (const path of expanded) rolled.set(path, (rolled.get(path) ?? 0) + 1);
  }

  const nodes = new Map<string, TagNode>();
  const ensure = (path: string): TagNode => {
    let node = nodes.get(path);
    if (!node) {
      node = {
        path,
        name: path.split('/').pop() ?? path,
        count: exact.get(path) ?? 0,
        totalCount: rolled.get(path) ?? 0,
        children: [],
      };
      nodes.set(path, node);
    }
    return node;
  };

  for (const path of rolled.keys()) ensure(path);

  const roots: TagNode[] = [];
  for (const [path, node] of nodes) {
    const parentPath = path.split('/').slice(0, -1).join('/');
    if (parentPath) ensure(parentPath).children.push(node);
    else roots.push(node);
  }

  const sortTree = (list: TagNode[]): TagNode[] => {
    list.sort((a, b) => b.totalCount - a.totalCount || a.name.localeCompare(b.name));
    for (const node of list) sortTree(node.children);
    return list;
  };

  return sortTree(roots);
}

export interface WikiLink {
  /** The note title being pointed at. */
  target: string;
  /** Alternative display text after a pipe, when given. */
  alias: string | null;
  /** Character offsets of the whole `[[...]]`, for rendering. */
  start: number;
  end: number;
}

export function parseWikiLinks(text: string): WikiLink[] {
  const links: WikiLink[] = [];
  WIKI_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = WIKI_RE.exec(text)) !== null) {
    const target = match[1]!.trim();
    if (!target) continue;
    links.push({
      target,
      alias: match[2]?.trim() || null,
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return links;
}

export interface LinkableNote {
  id: string;
  title: string;
  body: string;
}

export interface BacklinkIndex {
  /** noteId → ids of notes that link to it. */
  incoming: Record<string, string[]>;
  /** noteId → ids of notes it links to. */
  outgoing: Record<string, string[]>;
  /** Link targets that don't match any note yet, per source note. */
  unresolved: Record<string, string[]>;
}

/**
 * Work out what links to what.
 *
 * Titles are matched case- and whitespace-insensitively, because nobody types
 * `[[Su Tesisatçısı]]` with the capitals in the right places twice.
 */
export function buildBacklinkIndex(notes: readonly LinkableNote[]): BacklinkIndex {
  const byTitle = new Map<string, string>();
  for (const note of notes) {
    const key = note.title.trim().toLowerCase().replace(/\s+/g, ' ');
    if (key && !byTitle.has(key)) byTitle.set(key, note.id);
  }

  const incoming: Record<string, string[]> = {};
  const outgoing: Record<string, string[]> = {};
  const unresolved: Record<string, string[]> = {};

  for (const note of notes) {
    const targets = parseWikiLinks(`${note.title}\n${note.body}`);
    for (const link of targets) {
      const key = link.target.toLowerCase().replace(/\s+/g, ' ');
      const targetId = byTitle.get(key);

      if (!targetId) {
        (unresolved[note.id] ??= []).push(link.target);
        continue;
      }
      if (targetId === note.id) continue; // a note linking to itself is noise

      if (!(outgoing[note.id] ??= []).includes(targetId)) outgoing[note.id]!.push(targetId);
      if (!(incoming[targetId] ??= []).includes(note.id)) incoming[targetId]!.push(note.id);
    }
  }

  return { incoming, outgoing, unresolved };
}

/** Strip tag and wiki-link syntax for previews and search snippets. */
export function plainText(text: string): string {
  return text
    .replace(WIKI_RE, (_all, target: string, alias?: string) => alias || target)
    .replace(TAG_RE, (all: string) => (/^\s/.test(all) ? ' ' : ''))
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

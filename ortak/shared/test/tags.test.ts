import { describe, expect, it } from 'vitest';
import {
  parseTags,
  expandedTags,
  tagAncestors,
  buildTagTree,
  parseWikiLinks,
  buildBacklinkIndex,
  normaliseTag,
  plainText,
} from '../src/tags.js';

describe('parseTags', () => {
  it('reads a simple tag', () => {
    expect(parseTags('remember the milk #shopping').map((t) => t.path)).toEqual(['shopping']);
  });

  it('reads nested tags and their ancestors', () => {
    const [tag] = parseTags('boiler broke again #ev/tamirat');
    expect(tag!.path).toBe('ev/tamirat');
    expect(tag!.ancestors).toEqual(['ev', 'ev/tamirat']);
    expect(tag!.leaf).toBe('tamirat');
  });

  it('handles deep nesting', () => {
    expect(tagAncestors('a/b/c/d')).toEqual(['a', 'a/b', 'a/b/c', 'a/b/c/d']);
  });

  it('reads Turkish and German tags', () => {
    expect(parseTags('#alışveriş #ev/tamirat #Straße').map((t) => t.path)).toEqual([
      'alışveriş',
      'ev/tamirat',
      'straße',
    ]);
  });

  it('reads Bear-style multi-word tags', () => {
    expect(parseTags('note #ev isleri# here').map((t) => t.path)).toEqual(['ev isleri']);
  });

  it('lower-cases and de-duplicates', () => {
    expect(parseTags('#Ev #ev #EV').map((t) => t.path)).toEqual(['ev']);
  });

  it('finds a tag at the very start of the text', () => {
    expect(parseTags('#ev boiler').map((t) => t.path)).toEqual(['ev']);
  });

  it('ignores things that only look like tags', () => {
    // A hash inside a word or a URL fragment is not a tag.
    expect(parseTags('call me on +49#123')).toEqual([]);
    expect(parseTags('see https://example.com/page#section')).toEqual([]);
    expect(parseTags('C# is a language').map((t) => t.path)).toEqual([]);
  });

  it('handles text with no tags', () => {
    expect(parseTags('nothing to see here')).toEqual([]);
    expect(parseTags('')).toEqual([]);
  });

  it('expands every tag with its parents for indexing', () => {
    expect(expandedTags('#ev/tamirat #ev/temizlik #is')).toEqual([
      'ev',
      'ev/tamirat',
      'ev/temizlik',
      'is',
    ]);
  });

  it('normalises stray slashes and whitespace', () => {
    expect(normaliseTag('  /Ev/Tamirat/  ')).toBe('ev/tamirat');
  });
});

describe('buildTagTree', () => {
  it('rolls counts up the hierarchy', () => {
    const tree = buildTagTree([
      ['ev/tamirat'],
      ['ev/tamirat'],
      ['ev/temizlik'],
      ['is'],
    ]);

    const ev = tree.find((n) => n.path === 'ev')!;
    expect(ev.totalCount).toBe(3); // three notes filed somewhere under "ev"
    expect(ev.count).toBe(0); // none tagged "ev" exactly
    expect(ev.children.map((c) => c.path)).toEqual(['ev/tamirat', 'ev/temizlik']);
    expect(ev.children[0]!.count).toBe(2);
  });

  it('counts a note once per branch even with several tags in it', () => {
    const tree = buildTagTree([['ev/tamirat', 'ev/temizlik']]);
    expect(tree.find((n) => n.path === 'ev')!.totalCount).toBe(1);
  });

  it('sorts busiest first', () => {
    const tree = buildTagTree([['b'], ['a'], ['a'], ['a']]);
    expect(tree.map((n) => n.path)).toEqual(['a', 'b']);
  });

  it('handles no tags at all', () => {
    expect(buildTagTree([])).toEqual([]);
    expect(buildTagTree([[]])).toEqual([]);
  });
});

describe('parseWikiLinks', () => {
  it('finds a link', () => {
    const links = parseWikiLinks('call the [[Plumber]] tomorrow');
    expect(links).toHaveLength(1);
    expect(links[0]!.target).toBe('Plumber');
    expect(links[0]!.alias).toBeNull();
  });

  it('supports an alias', () => {
    const [link] = parseWikiLinks('see [[Su Tesisatçısı|the plumber note]]');
    expect(link!.target).toBe('Su Tesisatçısı');
    expect(link!.alias).toBe('the plumber note');
  });

  it('finds several links and reports their positions', () => {
    const links = parseWikiLinks('[[A]] and [[B]]');
    expect(links.map((l) => l.target)).toEqual(['A', 'B']);
    expect(links[0]!.start).toBe(0);
    expect(links[0]!.end).toBe(5);
  });

  it('ignores empty or malformed links', () => {
    expect(parseWikiLinks('[[]] [[ ]] [not a link] [[unclosed')).toEqual([]);
  });
});

describe('buildBacklinkIndex', () => {
  const notes = [
    { id: 'n1', title: 'Plumber', body: 'Herr Klein, 030 555 1234' },
    { id: 'n2', title: 'Boiler', body: 'Serviced by [[Plumber]] in March' },
    { id: 'n3', title: 'Flat', body: 'See [[Boiler]] and [[plumber]] and [[Nothing here]]' },
  ];

  it('links notes both ways', () => {
    const index = buildBacklinkIndex(notes);
    expect(index.outgoing.n2).toEqual(['n1']);
    expect(index.incoming.n1!.sort()).toEqual(['n2', 'n3']);
    expect(index.incoming.n2).toEqual(['n3']);
  });

  it('matches titles case-insensitively', () => {
    // n3 writes [[plumber]] in lower case and still resolves.
    expect(buildBacklinkIndex(notes).outgoing.n3).toContain('n1');
  });

  it('reports links that point nowhere yet', () => {
    expect(buildBacklinkIndex(notes).unresolved.n3).toEqual(['Nothing here']);
  });

  it('ignores a note linking to itself', () => {
    const index = buildBacklinkIndex([{ id: 'n1', title: 'Self', body: 'see [[Self]]' }]);
    expect(index.outgoing.n1).toBeUndefined();
    expect(index.incoming.n1).toBeUndefined();
  });

  it('does not duplicate a repeated link', () => {
    const index = buildBacklinkIndex([
      { id: 'a', title: 'A', body: '' },
      { id: 'b', title: 'B', body: '[[A]] and again [[A]]' },
    ]);
    expect(index.outgoing.b).toEqual(['a']);
    expect(index.incoming.a).toEqual(['b']);
  });

  it('handles an empty notebook', () => {
    expect(buildBacklinkIndex([])).toEqual({ incoming: {}, outgoing: {}, unresolved: {} });
  });
});

describe('plainText', () => {
  it('strips the syntax for previews', () => {
    expect(plainText('Boiler serviced by [[Plumber]] #ev/tamirat')).toBe('Boiler serviced by Plumber');
    expect(plainText('see [[Note|this one]]')).toBe('see this one');
  });
});

describe('tag syntax ambiguity', () => {
  it('does not let two adjacent tags collapse into one multi-word tag', () => {
    // The hash before "is" closes nothing: it is followed by a letter.
    expect(parseTags('#ev #is').map((t) => t.path)).toEqual(['ev', 'is']);
    expect(parseTags('#ev/tamirat boiler broke #is').map((t) => t.path)).toEqual(['ev/tamirat', 'is']);
  });

  it('accepts a multi-word tag followed by punctuation or end of text', () => {
    expect(parseTags('#ev isleri#').map((t) => t.path)).toEqual(['ev isleri']);
    expect(parseTags('#ev isleri#, and more').map((t) => t.path)).toEqual(['ev isleri']);
  });

  it('reads several multi-word tags in one note', () => {
    expect(parseTags('#ev isleri# and #is seyahat#').map((t) => t.path)).toEqual([
      'ev isleri',
      'is seyahat',
    ]);
  });
});

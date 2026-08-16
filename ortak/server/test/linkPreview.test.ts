import { describe, expect, it } from 'vitest';
import { extractMetadata, fetchLinkPreview, UnsafeUrlError } from '../src/linkPreview.js';
import { buildFtsQuery, foldSearchText } from '../src/search.js';

describe('link preview URL safety', () => {
  const blocked = [
    'http://127.0.0.1/admin',
    'http://localhost:8080/',
    'http://10.0.0.5/',
    'http://192.168.1.1/',
    'http://172.16.5.4/',
    'http://169.254.169.254/latest/meta-data/', // cloud metadata endpoint
    'http://[::1]/',
    'http://[fd00::1]/',
    'http://100.64.0.1/',
    'http://0.0.0.0/',
    'file:///etc/passwd',
    'ftp://example.com/',
    'gopher://example.com/',
    'not a url at all',
  ];

  for (const url of blocked) {
    it(`refuses ${url}`, async () => {
      await expect(fetchLinkPreview(url)).rejects.toBeInstanceOf(UnsafeUrlError);
    });
  }

  it('refuses a hostname that resolves to a private address', async () => {
    // localhost resolves to a loopback address, so the DNS check must catch it
    // even though the URL contains no literal IP.
    await expect(fetchLinkPreview('http://localhost./')).rejects.toBeInstanceOf(UnsafeUrlError);
  });
});

describe('extractMetadata', () => {
  it('prefers Open Graph tags', () => {
    const html = `
      <html><head>
        <title>Fallback title</title>
        <meta property="og:title" content="The real title">
        <meta property="og:description" content="A description">
        <meta property="og:image" content="/cover.png">
        <meta property="og:site_name" content="Example">
      </head></html>`;
    const meta = extractMetadata(html, 'https://example.com/article');

    expect(meta.title).toBe('The real title');
    expect(meta.description).toBe('A description');
    expect(meta.imageUrl).toBe('https://example.com/cover.png');
    expect(meta.siteName).toBe('Example');
  });

  it('falls back to <title> and the hostname', () => {
    const meta = extractMetadata('<html><head><title>Just a title</title></head></html>', 'https://www.example.com/x');
    expect(meta.title).toBe('Just a title');
    expect(meta.siteName).toBe('example.com');
  });

  it('decodes HTML entities', () => {
    const meta = extractMetadata(
      '<meta property="og:title" content="Fish &amp; Chips &#8212; caf&#233;">',
      'https://example.com',
    );
    expect(meta.title).toBe('Fish & Chips — café');
  });

  it('handles twitter card tags and single quotes', () => {
    const meta = extractMetadata(
      "<meta name='twitter:title' content='Tweet title'><meta name='twitter:image' content='https://cdn.example/i.jpg'>",
      'https://example.com',
    );
    expect(meta.title).toBe('Tweet title');
    expect(meta.imageUrl).toBe('https://cdn.example/i.jpg');
  });

  it('returns nulls rather than throwing on empty input', () => {
    const meta = extractMetadata('', 'https://example.com');
    expect(meta.title).toBeNull();
    expect(meta.description).toBeNull();
  });
});

describe('search query building', () => {
  it('folds exactly the characters SQLite will not', () => {
    // ş, ğ, ü and ö are left alone on purpose — the tokenizer's
    // remove_diacritics already folds those, at index and query time alike.
    // Only the dotless ı, the dotted İ and ß need handling here.
    expect(foldSearchText('Alışveriş')).toBe('alişveriş');
    expect(foldSearchText('İstanbul')).toBe('istanbul');
    expect(foldSearchText('Straße')).toBe('strasse');
    expect(foldSearchText('KAPIYI')).toBe('kapiyi');
  });

  it('turns bare words into quoted prefix terms', () => {
    expect(buildFtsQuery('plumber')).toBe('"plumber"*');
    expect(buildFtsQuery('call the plumber')).toBe('"call"* "the"* "plumber"*');
  });

  it('preserves explicit phrases', () => {
    expect(buildFtsQuery('"exact phrase"')).toBe('"exact phrase"');
  });

  it('neutralises FTS5 operators so the box cannot produce a syntax error', () => {
    // Quoted and lowercased, so a typed "OR" is a word to search for rather
    // than a boolean operator.
    expect(buildFtsQuery('foo* OR (bar)')).toBe('"foo"* "or"* "bar"*');
    expect(buildFtsQuery('^ - * ( )')).toBeNull();
    expect(buildFtsQuery('   ')).toBeNull();
    expect(buildFtsQuery('')).toBeNull();
  });
});

/**
 * Link previews.
 *
 * Saving a link should show a title and a picture rather than a bare URL, which
 * means the server fetches the page. That makes this the one place in Ortak that
 * will follow a URL a user hands it, so it is written defensively:
 *
 *  - http/https only
 *  - every hop's hostname is resolved and checked against private, loopback,
 *    link-local and carrier-grade-NAT ranges before the request is made, so a
 *    saved link can't be used to probe the machine the server runs on or the
 *    network around it
 *  - redirects are followed by hand (max 3) so each new host is re-checked
 *  - hard timeout and a byte cap, since a preview is never worth a hung request
 */

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const TIMEOUT_MS = 6_000;
const MAX_BYTES = 512 * 1024;
const MAX_REDIRECTS = 3;

export interface LinkPreview {
  url: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
}

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeUrlError';
  }
}

function ipv4IsPrivate(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return true;
  const [a, b] = parts as [number, number, number, number];

  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  if (a === 192 && b === 0) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true; // multicast and reserved
  return false;
}

function ipv6IsPrivate(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::' || lower === '::1') return true;

  // IPv4-mapped (::ffff:10.0.0.1) is judged by its embedded v4 address.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
  if (mapped) return ipv4IsPrivate(mapped[1]!);

  const head = lower.split(':')[0] ?? '';
  if (head.startsWith('fc') || head.startsWith('fd')) return true; // unique local
  if (head.startsWith('fe8') || head.startsWith('fe9') || head.startsWith('fea') || head.startsWith('feb')) {
    return true; // link-local
  }
  return false;
}

function addressIsPrivate(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return ipv4IsPrivate(ip);
  if (family === 6) return ipv6IsPrivate(ip);
  return true;
}

/** Reject anything that isn't a public http(s) address, before connecting. */
async function assertSafeUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError('That is not a valid URL.');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UnsafeUrlError('Only http and https links can be previewed.');
  }

  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host)) {
    if (addressIsPrivate(host)) throw new UnsafeUrlError('That address is not reachable from here.');
    return url;
  }

  let addresses: { address: string }[];
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new UnsafeUrlError('That host could not be resolved.');
  }
  if (addresses.length === 0 || addresses.some((a) => addressIsPrivate(a.address))) {
    throw new UnsafeUrlError('That address is not reachable from here.');
  }

  return url;
}

function decodeEntities(text: string): string {
  const named: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    '#39': "'",
    nbsp: ' ',
  };
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    const key = entity.toLowerCase();
    if (named[key]) return named[key];
    if (key.startsWith('#x')) return String.fromCodePoint(parseInt(key.slice(2), 16) || 63);
    if (key.startsWith('#')) return String.fromCodePoint(parseInt(key.slice(1), 10) || 63);
    return match;
  });
}

/**
 * Pull the handful of tags a preview needs out of the HTML.
 *
 * A regex rather than a parser on purpose: this only ever looks at <meta> and
 * <title>, and pulling in a full DOM to read four attributes is not worth it.
 */
export function extractMetadata(html: string, url: string): LinkPreview {
  const head = html.slice(0, 200_000);
  const meta = new Map<string, string>();

  const tagRe = /<meta\s+([^>]+)>/gi;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(head)) !== null) {
    const attrs = m[1]!;
    const key =
      /(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1]?.toLowerCase() ?? null;
    const value = /content\s*=\s*["']([^"']*)["']/i.exec(attrs)?.[1] ?? null;
    if (key && value && !meta.has(key)) meta.set(key, decodeEntities(value).trim());
  }

  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1];
  const pick = (...keys: string[]): string | null => {
    for (const k of keys) {
      const v = meta.get(k);
      if (v) return v;
    }
    return null;
  };

  const image = pick('og:image', 'twitter:image', 'twitter:image:src');
  let imageUrl: string | null = null;
  if (image) {
    try {
      imageUrl = new URL(image, url).toString();
    } catch {
      imageUrl = null;
    }
  }

  return {
    url,
    title: pick('og:title', 'twitter:title') ?? (titleTag ? decodeEntities(titleTag).trim() : null),
    description: pick('og:description', 'twitter:description', 'description'),
    imageUrl,
    siteName: pick('og:site_name') ?? new URL(url).hostname.replace(/^www\./, ''),
  };
}

export async function fetchLinkPreview(rawUrl: string): Promise<LinkPreview> {
  let current = rawUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await assertSafeUrl(current);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          // Some sites serve a stub to unknown agents; a plain bot UA with a
          // contact-shaped name gets the real Open Graph tags more often.
          'user-agent': 'Mozilla/5.0 (compatible; OrtakBot/0.1; +https://github.com/ortak)',
          accept: 'text/html,application/xhtml+xml',
          'accept-language': 'en,de;q=0.8,tr;q=0.6',
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) return { url: current, title: null, description: null, imageUrl: null, siteName: null };
        current = new URL(location, url).toString();
        continue;
      }

      if (!response.ok) {
        return {
          url: current,
          title: null,
          description: null,
          imageUrl: null,
          siteName: url.hostname.replace(/^www\./, ''),
        };
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.includes('html')) {
        return {
          url: current,
          title: null,
          description: null,
          imageUrl: null,
          siteName: url.hostname.replace(/^www\./, ''),
        };
      }

      // Read with a hard cap rather than response.text(), so a huge or endless
      // page can't be used to exhaust memory.
      const reader = response.body?.getReader();
      if (!reader) return extractMetadata('', current);

      const chunks: Uint8Array[] = [];
      let total = 0;
      while (total < MAX_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          total += value.byteLength;
        }
      }
      await reader.cancel().catch(() => undefined);

      const html = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8');
      return extractMetadata(html, current);
    } finally {
      clearTimeout(timer);
    }
  }

  throw new UnsafeUrlError('Too many redirects.');
}

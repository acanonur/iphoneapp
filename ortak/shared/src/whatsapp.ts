/**
 * Parser for WhatsApp "Export chat" .txt files.
 *
 * WhatsApp has no API for reading your personal chats, and unofficial clients
 * that scrape WhatsApp Web violate the Terms of Service and get numbers banned.
 * The supported, ToS-clean route is the one built into the app itself:
 * Chat → ⋮ / contact name → Export chat → Without media, which produces a .txt
 * you can share straight into Ortak. This module turns that file into rows.
 *
 * The format is not documented and differs by platform, locale and OS version.
 * Handled here:
 *
 *   iOS       [16.08.2025, 14:03:11] Tugce: message      (often U+200E-prefixed)
 *   iOS US    [8/16/25, 2:03:11 PM] Tugce: message       (U+202F before AM/PM on iOS 17+)
 *   Android   16.08.2025, 14:03 - Tugce: message
 *   Android US 8/16/25, 2:03 PM - Tugce: message
 *   ISO-ish   2025-08-16, 14:03 - Tugce: message
 *
 * plus multi-line message bodies, system notices, attachments and deletions in
 * English, German and Turkish.
 */

export type ParsedMessageKind = 'message' | 'system' | 'media' | 'deleted';

export interface ParsedMessage {
  /** Stable across re-imports of the same conversation, so imports are idempotent. */
  fingerprint: string;
  sentAt: number;
  author: string | null;
  body: string;
  kind: ParsedMessageKind;
  mediaName: string | null;
  /** 1-based line number in the source file, for error reporting. */
  line: number;
}

export type DateOrder = 'dmy' | 'mdy' | 'ymd';

export interface ParseOptions {
  /**
   * Minutes to subtract from the wall-clock timestamps to get UTC. Exports carry
   * no timezone, so the caller supplies the exporter's offset — the mobile app
   * passes the phone's own `-new Date().getTimezoneOffset()`. Defaults to 0,
   * which keeps parsing deterministic in tests.
   */
  utcOffsetMinutes?: number;
  /** Override the inferred day/month order when the file is genuinely ambiguous. */
  dateOrder?: DateOrder;
  /** Used for the chat name when the file has no better hint. */
  filename?: string;
}

export interface ParseResult {
  chatName: string | null;
  messages: ParsedMessage[];
  dateOrder: DateOrder;
  /** True when day/month order had to be guessed rather than proven. */
  dateOrderAmbiguous: boolean;
  participants: string[];
  firstAt: number | null;
  lastAt: number | null;
  /** Lines that could not be attached to any message. */
  skippedLines: number;
  warnings: string[];
}

// Direction marks and bidi controls WhatsApp sprinkles through iOS exports.
const INVISIBLE = /[‎‏‪-‮﻿]/g;
const SPACE = '[\\s\\u00a0\\u202f]';
const MERIDIEM = '([AaPp]\\.?[Mm]\\.?|ÖÖ|ÖS|öö|ös)';

const DATE = '(\\d{1,4})[.\\/-](\\d{1,2})[.\\/-](\\d{2,4})';
const TIME = `(\\d{1,2})[:.](\\d{2})(?:[:.](\\d{2}))?${SPACE}*${MERIDIEM}?`;

/** iOS: "[16.08.2025, 14:03:11] Tugce: hi" */
const BRACKET_RE = new RegExp(`^\\[${DATE},?${SPACE}+${TIME}${SPACE}*\\]${SPACE}*(.*)$`);
/** Android: "16.08.2025, 14:03 - Tugce: hi" */
const DASH_RE = new RegExp(`^${DATE},?${SPACE}+${TIME}${SPACE}*[-–]${SPACE}+(.*)$`);

const AUTHOR_RE = /^([^:\n]{1,80}?):[\s ]+([\s\S]*)$/;

/** iOS attachment line: "<attached: 0000042-PHOTO-....jpg>" (the label is localised). */
const ATTACHED_RE = /^<[^:<>]{1,24}:\s*([^>]+)>$/;
/** Android attachment line: "IMG-20250816-WA0001.jpg (file attached)". */
const FILE_ATTACHED_RE =
  /^(.+?)\s*\((?:file attached|Datei angehängt|dosya ekli|dosya eklendi)\)$/i;

const OMITTED_MEDIA = [
  'media omitted',
  'medien ausgeschlossen',
  'medya dahil edilmedi',
  'image omitted',
  'video omitted',
  'audio omitted',
  'sticker omitted',
  'gif omitted',
  'document omitted',
  'contact card omitted',
  'bild weggelassen',
  'video weggelassen',
  'audio weggelassen',
  'sticker weggelassen',
  'görüntü dahil edilmedi',
  'video dahil edilmedi',
  'ses dahil edilmedi',
  'çıkartma dahil edilmedi',
];

const DELETED_MARKERS = [
  'this message was deleted',
  'you deleted this message',
  'diese nachricht wurde gelöscht',
  'du hast diese nachricht gelöscht',
  'bu mesaj silindi',
  'bu mesajı sildiniz',
];

/**
 * Phrases that mark a line as a WhatsApp notice rather than something a person
 * typed. Only used for lines that already lack an "Author:" prefix, so this is
 * a labelling aid, not the primary detection.
 */
const SYSTEM_MARKERS = [
  'end-to-end encrypted',
  'ende-zu-ende-verschlüsselt',
  'uçtan uca şifreli',
  'created group',
  'gruppe erstellt',
  'grubu oluşturdu',
  'security code changed',
  'sicherheitsnummer',
  'güvenlik kodu',
  'changed the subject',
  'changed this group',
  'joined using this group',
  'added',
  'left',
  'removed',
  'katıldı',
  'ayrıldı',
  'ekledi',
  'çıkardı',
];

function stripInvisible(s: string): string {
  return s.replace(INVISIBLE, '');
}

/**
 * Small stable string hash (FNV-1a, 64-bit via two 32-bit lanes).
 *
 * Used to derive message ids that survive a re-import of the same chat, so
 * exporting the group again next month adds only the new messages. Not a
 * security primitive — it just needs to be deterministic on both platforms
 * without pulling in a crypto dependency on React Native.
 */
export function stableHash(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= c + i;
    h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}

interface HeaderMatch {
  a: number;
  b: number;
  c: number;
  hour: number;
  minute: number;
  second: number;
  meridiem: string | null;
  rest: string;
}

function matchHeader(line: string): HeaderMatch | null {
  const m = BRACKET_RE.exec(line) ?? DASH_RE.exec(line);
  if (!m) return null;
  return {
    a: Number(m[1]),
    b: Number(m[2]),
    c: Number(m[3]),
    hour: Number(m[4]),
    minute: Number(m[5]),
    second: m[6] ? Number(m[6]) : 0,
    meridiem: m[7] ?? null,
    rest: m[8] ?? '',
  };
}

/**
 * Decide whether the file writes dates day-first or month-first.
 *
 * A component above 12 can only be a day, which settles it. If the whole export
 * happens to use only low numbers (a chat that lived entirely in the first
 * twelve days of a month) nothing can prove it, so we say so and default to
 * day-first, which is what European phones produce.
 */
export function inferDateOrder(headers: HeaderMatch[]): { order: DateOrder; ambiguous: boolean } {
  let sawDayFirst = false;
  let sawMonthFirst = false;

  for (const h of headers) {
    if (h.a > 31) return { order: 'ymd', ambiguous: false };
    if (h.a > 12) sawDayFirst = true;
    if (h.b > 12) sawMonthFirst = true;
  }

  if (sawDayFirst && !sawMonthFirst) return { order: 'dmy', ambiguous: false };
  if (sawMonthFirst && !sawDayFirst) return { order: 'mdy', ambiguous: false };
  // Both signals present means the file is internally inconsistent; day-first is
  // the safer read because month-first exports are US-only.
  return { order: 'dmy', ambiguous: true };
}

function toEpochMs(h: HeaderMatch, order: DateOrder, offsetMinutes: number): number | null {
  let day: number;
  let month: number;
  let year: number;

  if (order === 'ymd') {
    year = h.a;
    month = h.b;
    day = h.c;
  } else if (order === 'mdy') {
    month = h.a;
    day = h.b;
    year = h.c;
  } else {
    day = h.a;
    month = h.b;
    year = h.c;
  }

  if (year < 100) year += year < 70 ? 2000 : 1900;

  let hour = h.hour;
  const mer = h.meridiem?.toLowerCase().replace(/\./g, '');
  if (mer === 'pm' || mer === 'p' || mer === 'ös') {
    if (hour < 12) hour += 12;
  } else if (mer === 'am' || mer === 'a' || mer === 'öö') {
    if (hour === 12) hour = 0;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || h.minute > 59) return null;

  const ms = Date.UTC(year, month - 1, day, hour, h.minute, h.second);
  if (Number.isNaN(ms)) return null;
  return ms - offsetMinutes * 60_000;
}

function classify(body: string): { kind: ParsedMessageKind; mediaName: string | null; body: string } {
  const trimmed = body.trim();
  const lower = trimmed.toLowerCase();

  const attached = ATTACHED_RE.exec(trimmed);
  if (attached) return { kind: 'media', mediaName: attached[1]!.trim(), body: trimmed };

  const fileAttached = FILE_ATTACHED_RE.exec(trimmed);
  if (fileAttached) return { kind: 'media', mediaName: fileAttached[1]!.trim(), body: trimmed };

  const bare = lower.replace(/^<|>$/g, '').trim();
  if (OMITTED_MEDIA.includes(bare)) return { kind: 'media', mediaName: null, body: trimmed };

  if (DELETED_MARKERS.some((d) => lower === d || lower.startsWith(d))) {
    return { kind: 'deleted', mediaName: null, body: trimmed };
  }

  return { kind: 'message', mediaName: null, body: trimmed };
}

function looksSystem(text: string): boolean {
  const lower = text.toLowerCase();
  return SYSTEM_MARKERS.some((marker) => lower.includes(marker));
}

/** "WhatsApp Chat with Tugce.txt" / "WhatsApp Sohbeti - Ev.txt" → "Tugce" / "Ev". */
export function chatNameFromFilename(filename: string): string | null {
  const base = filename
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/^_chat$/i, '')
    .trim();
  if (!base) return null;

  const patterns = [
    /^whatsapp chat (?:with|-)\s*(.+)$/i,
    /^whatsapp[- ]?chat[- ]?mit\s*(.+)$/i,
    /^whatsapp sohbeti(?:\s*[-–]\s*|\s+)(.+)$/i,
    /^chat (?:with|-)\s*(.+)$/i,
  ];
  for (const p of patterns) {
    const m = p.exec(base);
    if (m) return m[1]!.trim();
  }
  return base === 'WhatsApp Chat' ? null : base;
}

export function parseWhatsAppExport(text: string, options: ParseOptions = {}): ParseResult {
  const offset = options.utcOffsetMinutes ?? 0;
  const warnings: string[] = [];

  const rawLines = text.replace(/\r\n?/g, '\n').split('\n');
  const lines = rawLines.map(stripInvisible);

  // First pass: find every header so the date order can be settled before any
  // timestamp is converted.
  const headers: HeaderMatch[] = [];
  const headerAt = new Map<number, HeaderMatch>();
  for (let i = 0; i < lines.length; i++) {
    const h = matchHeader(lines[i]!);
    if (h) {
      headers.push(h);
      headerAt.set(i, h);
    }
  }

  if (headers.length === 0) {
    return {
      chatName: options.filename ? chatNameFromFilename(options.filename) : null,
      messages: [],
      dateOrder: options.dateOrder ?? 'dmy',
      dateOrderAmbiguous: false,
      participants: [],
      firstAt: null,
      lastAt: null,
      skippedLines: lines.filter((l) => l.trim()).length,
      warnings: ['No WhatsApp messages found — is this an exported chat .txt?'],
    };
  }

  const inferred = inferDateOrder(headers);
  const order = options.dateOrder ?? inferred.order;
  const ambiguous = options.dateOrder ? false : inferred.ambiguous;
  if (ambiguous) {
    warnings.push(
      'Every date in this export could be read either day-first or month-first; assuming day-first.',
    );
  }

  const messages: ParsedMessage[] = [];
  const participants = new Set<string>();
  let skippedLines = 0;
  let badTimestamps = 0;

  // Second pass: headers open a message, everything else continues the last one.
  let pending: { header: HeaderMatch; author: string | null; bodyLines: string[]; line: number } | null = null;

  const flush = () => {
    if (!pending) return;
    const sentAt = toEpochMs(pending.header, order, offset);
    if (sentAt === null) {
      badTimestamps++;
      pending = null;
      return;
    }

    const rawBody = pending.bodyLines.join('\n').trim();
    const { kind, mediaName, body } = classify(rawBody);
    const author = pending.author;
    const finalKind: ParsedMessageKind =
      author === null && (kind === 'message' ? looksSystem(body) : false) ? 'system' : author === null ? 'system' : kind;

    if (author) participants.add(author);

    messages.push({
      fingerprint: stableHash(`${sentAt}|${author ?? ''}|${body}`),
      sentAt,
      author,
      body,
      kind: finalKind,
      mediaName,
      line: pending.line,
    });
    pending = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const header = headerAt.get(i);

    if (header) {
      flush();
      const authorMatch = AUTHOR_RE.exec(header.rest);
      pending = {
        header,
        author: authorMatch ? authorMatch[1]!.trim() : null,
        bodyLines: [authorMatch ? authorMatch[2]! : header.rest],
        line: i + 1,
      };
      continue;
    }

    if (pending) {
      pending.bodyLines.push(line);
    } else if (line.trim()) {
      skippedLines++;
    }
  }
  flush();

  if (badTimestamps > 0) {
    warnings.push(`${badTimestamps} line(s) had an unreadable timestamp and were dropped.`);
  }
  if (skippedLines > 0) {
    warnings.push(`${skippedLines} line(s) before the first message were ignored.`);
  }

  const times = messages.map((m) => m.sentAt);
  const list = [...participants].sort();

  let chatName = options.filename ? chatNameFromFilename(options.filename) : null;
  if (!chatName && list.length > 0) {
    chatName = list.length <= 2 ? list.join(' & ') : `${list[0]} +${list.length - 1}`;
  }

  return {
    chatName,
    messages,
    dateOrder: order,
    dateOrderAmbiguous: ambiguous,
    participants: list,
    firstAt: times.length ? Math.min(...times) : null,
    lastAt: times.length ? Math.max(...times) : null,
    skippedLines,
    warnings,
  };
}

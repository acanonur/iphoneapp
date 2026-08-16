/**
 * Natural-language quick-add for calendar entries.
 *
 * "dinner with Tugce friday 8pm @ Mama Trattoria" becomes a titled event on the
 * coming Friday from 20:00 to 21:00 at Mama Trattoria. Understands English,
 * Turkish and German because that is the mix actually spoken in this household.
 *
 * Pure and offset-explicit: the caller passes `now` plus the device's UTC offset,
 * so the same input parses identically on the phone and on the server.
 */

export type ParseConfidence = 'none' | 'low' | 'high';

export interface EventDraft {
  title: string;
  /** Epoch ms, or null when nothing date-like was found. */
  startsAt: number | null;
  endsAt: number | null;
  allDay: boolean;
  location: string | null;
  confidence: ParseConfidence;
  /** The substrings that were consumed as date/time/location, for highlighting. */
  matched: { text: string; kind: string }[];
}

export interface QuickAddOptions {
  /** "Now" as epoch ms. Defaults to Date.now(). */
  now?: number;
  /** Minutes east of UTC for the user's zone, e.g. 120 for Europe/Berlin in summer. */
  utcOffsetMinutes?: number;
  /** Day/month order for bare numeric dates when the numbers don't settle it. */
  dateOrder?: 'dmy' | 'mdy';
  /** Minutes to use when a start time is given without an end. */
  defaultDurationMinutes?: number;
}

interface LocalParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function toLocal(ms: number, offsetMinutes: number): LocalParts {
  const d = new Date(ms + offsetMinutes * MINUTE);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
  };
}

function fromLocal(p: LocalParts, offsetMinutes: number): number {
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, 0) - offsetMinutes * MINUTE;
}

function localWeekday(ms: number, offsetMinutes: number): number {
  return new Date(ms + offsetMinutes * MINUTE).getUTCDay(); // 0 = Sunday
}

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

/** Weekday names → 0-6 (Sunday first, matching Date#getUTCDay). */
const WEEKDAYS: Record<string, number> = {
  sunday: 0, sun: 0, pazar: 0, sonntag: 0, so: 0,
  monday: 1, mon: 1, pazartesi: 1, montag: 1, pzt: 1,
  tuesday: 2, tue: 2, tues: 2, salı: 2, sali: 2, dienstag: 2, sal: 2,
  wednesday: 3, wed: 3, çarşamba: 3, carsamba: 3, mittwoch: 3, çar: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4, perşembe: 4, persembe: 4, donnerstag: 4, per: 4,
  friday: 5, fri: 5, cuma: 5, freitag: 5, cum: 5,
  saturday: 6, sat: 6, cumartesi: 6, samstag: 6, sonnabend: 6, cmt: 6,
};

const MONTHS: Record<string, number> = {
  january: 1, jan: 1, ocak: 1, januar: 1, oca: 1,
  february: 2, feb: 2, şubat: 2, subat: 2, februar: 2, şub: 2,
  march: 3, mar: 3, mart: 3, märz: 3, maerz: 3,
  april: 4, apr: 4, nisan: 4, nis: 4,
  may: 5, mayıs: 5, mayis: 5, mai: 5,
  june: 6, jun: 6, haziran: 6, juni: 6, haz: 6,
  july: 7, jul: 7, temmuz: 7, juli: 7, tem: 7,
  august: 8, aug: 8, ağustos: 8, agustos: 8, ağu: 8,
  september: 9, sep: 9, sept: 9, eylül: 9, eylul: 9, eyl: 9,
  october: 10, oct: 10, ekim: 10, oktober: 10, eki: 10,
  november: 11, nov: 11, kasım: 11, kasim: 11, kas: 11,
  december: 12, dec: 12, aralık: 12, aralik: 12, dezember: 12, ara: 12,
};

/** Word → offset in days from today. */
const RELATIVE_DAYS: Record<string, number> = {
  today: 0, tonight: 0, bugün: 0, bugun: 0, heute: 0,
  tomorrow: 1, tmrw: 1, yarın: 1, yarin: 1, morgen: 1,
  'day after tomorrow': 2, 'öbür gün': 2, 'obur gun': 2, 'ertesi gün': 2, übermorgen: 2, uebermorgen: 2,
  yesterday: -1, dün: -1, dun: -1, gestern: -1,
};

/** Vague time-of-day → the hour a reasonable person means by it. */
const DAYPARTS: Record<string, number> = {
  morning: 9, sabah: 9, früh: 9, fruh: 9, vormittag: 9,
  noon: 12, midday: 12, öğle: 12, ogle: 12, mittag: 12,
  afternoon: 15, 'öğleden sonra': 15, 'ogleden sonra': 15, nachmittag: 15,
  evening: 19, akşam: 19, aksam: 19, abend: 19,
  night: 21, tonight: 21, gece: 21, nacht: 21,
  midnight: 0, 'gece yarısı': 0, mitternacht: 0,
};

const NEXT_WORDS = ['next', 'coming', 'gelecek', 'önümüzdeki', 'onumuzdeki', 'haftaya', 'nächsten', 'naechsten', 'nächste', 'kommenden'];
const THIS_WORDS = ['this', 'bu', 'diesen', 'diese', 'am'];

// ---------------------------------------------------------------------------
// Span bookkeeping
// ---------------------------------------------------------------------------

class Spans {
  private taken: boolean[];
  readonly matched: { text: string; kind: string }[] = [];

  constructor(private readonly text: string) {
    this.taken = new Array(text.length).fill(false);
  }

  free(start: number, end: number): boolean {
    for (let i = start; i < end; i++) if (this.taken[i]) return false;
    return true;
  }

  take(start: number, end: number, kind: string): void {
    for (let i = start; i < end; i++) this.taken[i] = true;
    this.matched.push({ text: this.text.slice(start, end), kind });
  }

  /** What's left after removing every consumed span — the event title. */
  remainder(): string {
    let out = '';
    for (let i = 0; i < this.text.length; i++) out += this.taken[i] ? ' ' : this.text[i];
    return out
      .replace(/\s+/g, ' ')
      .replace(/\s*[,;]\s*/g, ' ')
      .replace(/^[\s\-–—:@]+|[\s\-–—:@]+$/g, '')
      .trim();
  }
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Word-boundary search that also respects Turkish/German letters. */
function findWord(haystack: string, needle: string, from = 0): number {
  const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(needle)}($|[^\\p{L}\\p{N}])`, 'iu');
  const slice = haystack.slice(from);
  const m = re.exec(slice);
  if (!m) return -1;
  return from + m.index + (m[1] ? m[1].length : 0);
}

// ---------------------------------------------------------------------------
// Time extraction
// ---------------------------------------------------------------------------

interface TimeHit {
  hour: number;
  minute: number;
  start: number;
  end: number;
  hadMeridiem: boolean;
}

// The whitespace before the meridiem is inside the optional group on purpose:
// leaving it outside made "18:00 2 saat" consume the space after the time, which
// then overlapped the duration span that starts there.
const TIME_CORE =
  "(\\d{1,2})(?:[:.](\\d{2}))?(?:\\s*(am|pm|a\\.m\\.|p\\.m\\.|öö|ös))?(?:['’]?(?:de|da|te|ta))?";

function readTimeAt(text: string, re: RegExp): TimeHit[] {
  const hits: TimeHit[] = [];
  let m: RegExpExecArray | null;
  re.lastIndex = 0;
  while ((m = re.exec(text)) !== null) {
    const hour = Number(m[1]);
    const minute = m[2] ? Number(m[2]) : 0;
    const mer = m[3]?.toLowerCase().replace(/\./g, '');
    if (minute > 59) continue;
    if (hour > 23) continue;
    // A bare small number is only a time if something marks it as one.
    if (!mer && !m[2]) continue;

    let h = hour;
    if (mer === 'pm' || mer === 'ös') {
      if (h < 12) h += 12;
    } else if (mer === 'am' || mer === 'öö') {
      if (h === 12) h = 0;
    }
    hits.push({ hour: h, minute, start: m.index, end: m.index + m[0].length, hadMeridiem: Boolean(mer) });
  }
  return hits;
}

/**
 * Pull one or two clock times out of the text.
 *
 * Handles "19:00-21:00", "8-10pm" (the meridiem on the second time applies to
 * both), "8pm", "saat 20:00", "at 9" and the vague dayparts.
 */
function extractTimes(
  text: string,
  spans: Spans,
): { start: TimeHit | null; end: TimeHit | null; daypartHour: number | null } {
  const lower = text.toLowerCase();

  // 1. Explicit range: two clock times joined by a dash or a "to"/"bis"/"ile".
  const rangeRe = new RegExp(
    `(?:\\b(?:saat|um|from|von)\\s+)?${TIME_CORE}\\s*(?:-|–|—|\\bto\\b|\\buntil\\b|\\bbis\\b|\\bile\\b|\\bila\\b|\\barası\\b)\\s*${TIME_CORE}`,
    'giu',
  );
  let m: RegExpExecArray | null;
  rangeRe.lastIndex = 0;
  while ((m = rangeRe.exec(lower)) !== null) {
    if (!spans.free(m.index, m.index + m[0].length)) continue;

    const h1 = Number(m[1]);
    const min1 = m[2] ? Number(m[2]) : 0;
    const mer1 = m[3]?.toLowerCase().replace(/\./g, '');
    const h2 = Number(m[4]);
    const min2 = m[5] ? Number(m[5]) : 0;
    const mer2 = m[6]?.toLowerCase().replace(/\./g, '');
    if (h1 > 23 || h2 > 23 || min1 > 59 || min2 > 59) continue;

    const applyMer = (h: number, mer: string | undefined) => {
      if (mer === 'pm' || mer === 'ös') return h < 12 ? h + 12 : h;
      if (mer === 'am' || mer === 'öö') return h === 12 ? 0 : h;
      return h;
    };
    // "8-10pm": the trailing meridiem governs the whole range.
    let startHour = applyMer(h1, mer1 ?? mer2);
    const endHour = applyMer(h2, mer2);
    if (!mer1 && mer2 && startHour > endHour) startHour -= 12;

    spans.take(m.index, m.index + m[0].length, 'time-range');
    return {
      start: { hour: startHour, minute: min1, start: m.index, end: m.index, hadMeridiem: Boolean(mer1 || mer2) },
      end: { hour: endHour, minute: min2, start: m.index, end: m.index, hadMeridiem: Boolean(mer2) },
      daypartHour: null,
    };
  }

  // 2. A single clock time, optionally introduced by "at"/"saat"/"um".
  const singleRe = new RegExp(`(?:\\b(?:at|saat|um|@)\\s*)?${TIME_CORE}`, 'giu');
  const hits = readTimeAt(lower, singleRe).filter((h) => spans.free(h.start, h.end));
  if (hits.length > 0) {
    const hit = hits[0]!;
    spans.take(hit.start, hit.end, 'time');
    return { start: hit, end: null, daypartHour: null };
  }

  // 3. Fall back to a vague part of the day.
  for (const [word, hour] of Object.entries(DAYPARTS)) {
    const idx = findWord(lower, word);
    if (idx >= 0 && spans.free(idx, idx + word.length)) {
      spans.take(idx, idx + word.length, 'daypart');
      return { start: null, end: null, daypartHour: hour };
    }
  }

  return { start: null, end: null, daypartHour: null };
}

// ---------------------------------------------------------------------------
// Date extraction
// ---------------------------------------------------------------------------

interface DateHit {
  year: number | null;
  month: number;
  day: number;
}

function extractExplicitDate(text: string, spans: Spans, dateOrder: 'dmy' | 'mdy'): DateHit | null {
  // ISO first — unambiguous.
  const iso = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/.exec(text);
  if (iso && spans.free(iso.index, iso.index + iso[0].length)) {
    spans.take(iso.index, iso.index + iso[0].length, 'date');
    return { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) };
  }

  // Numeric d.m[.y] / m/d[/y]. A trailing dot ("16.08.") is normal in German.
  const num = /\b(\d{1,2})[.\/](\d{1,2})(?:[.\/](\d{2,4}))?\.?(?![\d:])/.exec(text);
  if (num && spans.free(num.index, num.index + num[0].length)) {
    const a = Number(num[1]);
    const b = Number(num[2]);
    let order = dateOrder;
    if (a > 12) order = 'dmy';
    else if (b > 12) order = 'mdy';

    const day = order === 'dmy' ? a : b;
    const month = order === 'dmy' ? b : a;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      let year: number | null = num[3] ? Number(num[3]) : null;
      if (year !== null && year < 100) year += 2000;
      spans.take(num.index, num.index + num[0].length, 'date');
      return { year, month, day };
    }
  }

  return null;
}

function extractMonthNameDate(text: string, spans: Spans): DateHit | null {
  const lower = text.toLowerCase();
  for (const [name, month] of Object.entries(MONTHS)) {
    const idx = findWord(lower, name);
    if (idx < 0) continue;
    const end = idx + name.length;
    if (!spans.free(idx, end)) continue;

    // "16 august" / "16. august" / "16th august"
    const before = /(\d{1,2})(?:\.|st|nd|rd|th)?\s*$/.exec(text.slice(0, idx));
    if (before) {
      const day = Number(before[1]);
      if (day >= 1 && day <= 31) {
        const start = idx - before[0].length;
        const yearM = /^\s*,?\s*(\d{4})\b/.exec(text.slice(end));
        const stop = yearM ? end + yearM[0].length : end;
        spans.take(start, stop, 'date');
        return { year: yearM ? Number(yearM[1]) : null, month, day };
      }
    }

    // "august 16" / "august 16, 2025"
    const after = /^\s*(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(\d{4}))?\b/.exec(text.slice(end));
    if (after) {
      const day = Number(after[1]);
      if (day >= 1 && day <= 31) {
        spans.take(idx, end + after[0].length, 'date');
        return { year: after[2] ? Number(after[2]) : null, month, day };
      }
    }
  }
  return null;
}

function extractRelativeDay(text: string, spans: Spans): number | null {
  const lower = text.toLowerCase();
  // Longest phrases first so "day after tomorrow" beats "tomorrow".
  const words = Object.keys(RELATIVE_DAYS).sort((a, b) => b.length - a.length);
  for (const word of words) {
    const idx = findWord(lower, word);
    if (idx >= 0 && spans.free(idx, idx + word.length)) {
      // "tonight" also implies an evening hour; the daypart pass handles that.
      if (word !== 'tonight') spans.take(idx, idx + word.length, 'relative-day');
      return RELATIVE_DAYS[word]!;
    }
  }
  return null;
}

function extractWeekday(text: string, spans: Spans): { weekday: number; nextWeek: boolean } | null {
  const lower = text.toLowerCase();
  const names = Object.keys(WEEKDAYS).sort((a, b) => b.length - a.length);
  for (const name of names) {
    const idx = findWord(lower, name);
    if (idx < 0) continue;
    const end = idx + name.length;
    if (!spans.free(idx, end)) continue;

    // Look just behind the weekday for "next"/"gelecek"/"nächsten".
    const prefix = lower.slice(Math.max(0, idx - 16), idx);
    let start = idx;
    let nextWeek = false;
    for (const w of NEXT_WORDS) {
      const p = new RegExp(`(^|[^\\p{L}])${escapeRe(w)}\\s*$`, 'iu').exec(prefix);
      if (p) {
        nextWeek = true;
        start = idx - (p[0].length - (p[1] ? p[1].length : 0));
        break;
      }
    }
    if (!nextWeek) {
      for (const w of THIS_WORDS) {
        const p = new RegExp(`(^|[^\\p{L}])${escapeRe(w)}\\s*$`, 'iu').exec(prefix);
        if (p) {
          start = idx - (p[0].length - (p[1] ? p[1].length : 0));
          break;
        }
      }
    }

    spans.take(start, end, 'weekday');
    return { weekday: WEEKDAYS[name]!, nextWeek };
  }
  return null;
}

function extractDuration(text: string, spans: Spans): number | null {
  const re =
    /\b(?:for|für|fuer|boyunca)?\s*(\d+(?:[.,]\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|min|saat|dakika|dk|stunden?|std|minuten?)\b/iu;
  const m = re.exec(text);
  if (!m || !spans.free(m.index, m.index + m[0].length)) return null;

  const value = Number(m[1]!.replace(',', '.'));
  const unit = m[2]!.toLowerCase();
  const isHour = /^(h|hr|hrs|hour|hours|saat|stunde|stunden|std)$/.test(unit);
  const minutes = Math.round(isHour ? value * 60 : value);
  if (minutes <= 0 || minutes > 60 * 24 * 14) return null;

  spans.take(m.index, m.index + m[0].length, 'duration');
  return minutes;
}

function extractLocation(text: string, spans: Spans): string | null {
  // "@ Mama Trattoria" — unambiguous, so it wins.
  const at = /@\s*([^\n,;]+)$/.exec(text);
  if (at && spans.free(at.index, at.index + at[0].length)) {
    spans.take(at.index, at.index + at[0].length, 'location');
    return at[1]!.trim();
  }

  // Trailing "at <place>" / "bei <ort>", only when it survives to the end of the
  // string — "at 8pm" has already been consumed by the time pass.
  const kw = /\b(?:at|bei|in)\s+([A-ZÄÖÜÇĞİŞ][^\n,;]*)$/u.exec(text);
  if (kw && spans.free(kw.index, kw.index + kw[0].length)) {
    const place = kw[1]!.trim();
    if (place.length >= 2 && !/^\d/.test(place)) {
      spans.take(kw.index, kw.index + kw[0].length, 'location');
      return place;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function parseQuickAdd(input: string, options: QuickAddOptions = {}): EventDraft {
  const text = input.trim();
  const now = options.now ?? Date.now();
  const offset = options.utcOffsetMinutes ?? 0;
  const dateOrder = options.dateOrder ?? 'dmy';
  const defaultDuration = options.defaultDurationMinutes ?? 60;

  const spans = new Spans(text);
  if (!text) {
    return { title: '', startsAt: null, endsAt: null, allDay: false, location: null, confidence: 'none', matched: [] };
  }

  // Order matters: dates are consumed before times so "16.08" is never read as
  // a clock time, and the location pass runs last on whatever is left.
  const explicit = extractExplicitDate(text, spans, dateOrder);
  const byName = explicit ? null : extractMonthNameDate(text, spans);
  const relative = explicit || byName ? null : extractRelativeDay(text, spans);
  const weekday = explicit || byName || relative !== null ? null : extractWeekday(text, spans);

  const times = extractTimes(text, spans);
  const duration = extractDuration(text, spans);
  const location = extractLocation(text, spans);

  const today = toLocal(now, offset);
  let dayParts: LocalParts | null = null;

  if (explicit || byName) {
    const hit = (explicit ?? byName)!;
    const year = hit.year ?? today.year;
    dayParts = { year, month: hit.month, day: hit.day, hour: 0, minute: 0 };
    // A bare "16.08" that already passed this year means next year.
    if (hit.year === null) {
      const candidate = fromLocal(dayParts, offset);
      if (candidate < now - 12 * HOUR) dayParts.year = year + 1;
    }
  } else if (relative !== null) {
    const base = toLocal(now + relative * DAY, offset);
    dayParts = { ...base, hour: 0, minute: 0 };
  } else if (weekday) {
    const currentDow = localWeekday(now, offset);
    let delta = (weekday.weekday - currentDow + 7) % 7;
    if (weekday.nextWeek) delta += delta === 0 ? 7 : 7;
    const base = toLocal(now + delta * DAY, offset);
    dayParts = { ...base, hour: 0, minute: 0 };
  }

  const hasDate = dayParts !== null;
  const hasTime = times.start !== null || times.daypartHour !== null;

  // A time with no date means today, or tomorrow if that moment already passed.
  if (!hasDate && hasTime) {
    dayParts = { ...today, hour: 0, minute: 0 };
  }

  if (!dayParts) {
    return {
      title: spans.remainder() || text,
      startsAt: null,
      endsAt: null,
      allDay: false,
      location,
      confidence: 'none',
      matched: spans.matched,
    };
  }

  if (!hasTime) {
    const start = fromLocal({ ...dayParts, hour: 0, minute: 0 }, offset);
    return {
      title: spans.remainder() || text,
      startsAt: start,
      endsAt: start + DAY,
      allDay: true,
      location,
      confidence: hasDate ? 'high' : 'low',
      matched: spans.matched,
    };
  }

  const startHour = times.start?.hour ?? times.daypartHour ?? 9;
  const startMinute = times.start?.minute ?? 0;
  let startsAt = fromLocal({ ...dayParts, hour: startHour, minute: startMinute }, offset);

  if (!hasDate && startsAt < now - 5 * MINUTE) startsAt += DAY;

  let endsAt: number;
  if (times.end) {
    const endParts = toLocal(startsAt, offset);
    endsAt = fromLocal({ ...endParts, hour: times.end.hour, minute: times.end.minute }, offset);
    if (endsAt <= startsAt) endsAt += DAY; // "22:00-01:00" crosses midnight
  } else {
    endsAt = startsAt + (duration ?? defaultDuration) * MINUTE;
  }

  return {
    title: spans.remainder() || text,
    startsAt,
    endsAt,
    allDay: false,
    location,
    confidence: hasDate ? 'high' : 'low',
    matched: spans.matched,
  };
}

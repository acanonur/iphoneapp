/**
 * Availability: merging busy time and finding gaps in it.
 *
 * This is what makes the calendar genuinely two-way. Each phone reads its own
 * device calendars — the work calendar, the university one, whatever is on
 * there — and publishes them as busy intervals. Ortak then knows when each of
 * you is actually free, which is the thing a shared planner needs and a
 * one-way "we write events out" integration can never answer.
 *
 * Busy intervals carry an owner but need not carry a title: by default a phone
 * shares *when* someone is busy, not what they are doing. Everything here is
 * pure and works on epoch milliseconds.
 */

export interface Interval {
  startsAt: number;
  endsAt: number;
}

export interface BusyInterval extends Interval {
  /** Whose calendar this came from. */
  ownerId: string;
  /** Null when the owner shares only their availability, not their event titles. */
  label?: string | null;
}

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/**
 * Collapse overlapping and touching intervals into the fewest that cover the
 * same time. Input order does not matter; output is sorted and disjoint.
 */
export function mergeIntervals(intervals: readonly Interval[]): Interval[] {
  const valid = intervals
    .filter((i) => Number.isFinite(i.startsAt) && Number.isFinite(i.endsAt) && i.endsAt > i.startsAt)
    .sort((a, b) => a.startsAt - b.startsAt || a.endsAt - b.endsAt);

  const merged: Interval[] = [];
  for (const current of valid) {
    const last = merged[merged.length - 1];
    // Touching counts as overlapping: back-to-back meetings leave no usable gap.
    if (last && current.startsAt <= last.endsAt) {
      if (current.endsAt > last.endsAt) last.endsAt = current.endsAt;
    } else {
      merged.push({ startsAt: current.startsAt, endsAt: current.endsAt });
    }
  }
  return merged;
}

/** The complement of `busy` inside a window — the free time. */
export function freeIntervals(
  busy: readonly Interval[],
  windowStart: number,
  windowEnd: number,
): Interval[] {
  if (windowEnd <= windowStart) return [];

  const free: Interval[] = [];
  let cursor = windowStart;

  for (const block of mergeIntervals(busy)) {
    if (block.endsAt <= windowStart) continue;
    if (block.startsAt >= windowEnd) break;
    if (block.startsAt > cursor) free.push({ startsAt: cursor, endsAt: Math.min(block.startsAt, windowEnd) });
    cursor = Math.max(cursor, block.endsAt);
    if (cursor >= windowEnd) break;
  }

  if (cursor < windowEnd) free.push({ startsAt: cursor, endsAt: windowEnd });
  return free.filter((i) => i.endsAt > i.startsAt);
}

export interface SlotSearch {
  /** Search window, epoch ms. */
  from: number;
  to: number;
  /** How long the thing you want to schedule takes. */
  durationMinutes: number;
  /** Minutes east of UTC, so "evenings" means evenings where the users are. */
  utcOffsetMinutes: number;
  /** Earliest local minute-of-day to consider, e.g. 9 * 60 for 09:00. */
  dayStartMinutes?: number;
  dayEndMinutes?: number;
  /** Local weekdays to allow (0 = Sunday). Omit for every day. */
  weekdays?: readonly number[];
  /** Keep this much clear either side of an existing commitment. */
  bufferMinutes?: number;
  /** Round proposed start times to this many minutes. */
  granularityMinutes?: number;
  maxResults?: number;
}

export interface FreeSlot extends Interval {
  /** Which people are free for the whole slot. */
  availableTo: string[];
}

function localMinuteOfDay(ms: number, offsetMinutes: number): number {
  const shifted = new Date(ms + offsetMinutes * MINUTE);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

function localDayStart(ms: number, offsetMinutes: number): number {
  const shifted = new Date(ms + offsetMinutes * MINUTE);
  shifted.setUTCHours(0, 0, 0, 0);
  return shifted.getTime() - offsetMinutes * MINUTE;
}

function localWeekday(ms: number, offsetMinutes: number): number {
  return new Date(ms + offsetMinutes * MINUTE).getUTCDay();
}

/**
 * Find times when everyone named is free.
 *
 * This is the couple-sized version of Fantastical's "Openings": rather than
 * publishing a booking link, it answers "when can the two of us actually do
 * this?" from both people's real calendars.
 *
 * Slots are clipped to the allowed hours of each local day, so a search across
 * a fortnight proposes 19:00 on a Tuesday rather than 03:00 on a Sunday.
 */
export function findFreeSlots(
  busy: readonly BusyInterval[],
  participants: readonly string[],
  search: SlotSearch,
): FreeSlot[] {
  const {
    from,
    to,
    durationMinutes,
    utcOffsetMinutes,
    dayStartMinutes = 8 * 60,
    dayEndMinutes = 22 * 60,
    weekdays,
    bufferMinutes = 0,
    granularityMinutes = 15,
    maxResults = 10,
  } = search;

  if (to <= from || durationMinutes <= 0 || participants.length === 0) return [];
  if (dayEndMinutes <= dayStartMinutes) return [];

  const durationMs = durationMinutes * MINUTE;
  const bufferMs = Math.max(0, bufferMinutes) * MINUTE;
  const granularityMs = Math.max(1, granularityMinutes) * MINUTE;

  // Only the named participants' commitments block a slot, padded by the buffer.
  const relevant = busy
    .filter((b) => participants.includes(b.ownerId))
    .map((b) => ({ startsAt: b.startsAt - bufferMs, endsAt: b.endsAt + bufferMs }));

  const results: FreeSlot[] = [];

  // Walk day by day so the allowed-hours window can be applied in local time.
  for (
    let day = localDayStart(from, utcOffsetMinutes);
    day < to && results.length < maxResults;
    day += DAY
  ) {
    if (weekdays && !weekdays.includes(localWeekday(day, utcOffsetMinutes))) continue;

    const windowStart = Math.max(day + dayStartMinutes * MINUTE, from);
    const windowEnd = Math.min(day + dayEndMinutes * MINUTE, to);
    if (windowEnd - windowStart < durationMs) continue;

    for (const gap of freeIntervals(relevant, windowStart, windowEnd)) {
      // Round the start up to the next clean time, measured from local midnight
      // so the offsets stay tidy (10:00, 10:15 — not 10:07).
      const sinceMidnight = gap.startsAt - day;
      const rounded = day + Math.ceil(sinceMidnight / granularityMs) * granularityMs;
      let cursor = Math.max(rounded, gap.startsAt);

      while (cursor + durationMs <= gap.endsAt && results.length < maxResults) {
        // Guard against a rounded start slipping outside the allowed hours.
        const startMinute = localMinuteOfDay(cursor, utcOffsetMinutes);
        if (startMinute >= dayStartMinutes && startMinute + durationMinutes <= dayEndMinutes) {
          results.push({
            startsAt: cursor,
            endsAt: cursor + durationMs,
            availableTo: [...participants],
          });
        }
        cursor += granularityMs;
      }
    }
  }

  return results.slice(0, maxResults);
}

/**
 * How much of a window each person has committed, for the "who has the busier
 * week" line on the planner.
 */
export function busyMinutesByOwner(
  busy: readonly BusyInterval[],
  windowStart: number,
  windowEnd: number,
): Record<string, number> {
  const byOwner: Record<string, Interval[]> = {};
  for (const block of busy) {
    (byOwner[block.ownerId] ??= []).push(block);
  }

  const totals: Record<string, number> = {};
  for (const [ownerId, intervals] of Object.entries(byOwner)) {
    let minutes = 0;
    for (const merged of mergeIntervals(intervals)) {
      const start = Math.max(merged.startsAt, windowStart);
      const end = Math.min(merged.endsAt, windowEnd);
      if (end > start) minutes += (end - start) / MINUTE;
    }
    totals[ownerId] = Math.round(minutes);
  }
  return totals;
}

/** True when a proposed time collides with anything the named people have on. */
export function hasConflict(
  busy: readonly BusyInterval[],
  participants: readonly string[],
  proposed: Interval,
): boolean {
  return busy.some(
    (b) =>
      participants.includes(b.ownerId) &&
      b.startsAt < proposed.endsAt &&
      b.endsAt > proposed.startsAt,
  );
}

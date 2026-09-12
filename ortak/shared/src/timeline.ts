/**
 * The visual day, in the shape Structured popularised.
 *
 * The insight worth taking is that the *gaps* matter as much as the events. A
 * plain agenda list tells you what you have on; a timeline tells you that you
 * have two and a half hours free after lunch, which is the thing you actually
 * decide with.
 *
 * So this builds an ordered strip of blocks covering the whole waking day —
 * commitments, other people's commitments, and the free space between them —
 * ready to be drawn as proportional bars.
 */

import type { BusyInterval, Interval } from './availability.js';
import { freeIntervals, mergeIntervals } from './availability.js';

const MINUTE = 60_000;

export type BlockKind = 'event' | 'busy' | 'gap' | 'now';

export interface TimelineBlock {
  kind: BlockKind;
  startsAt: number;
  endsAt: number;
  /** Minutes the block covers, for proportional heights. */
  minutes: number;
  title: string | null;
  location: string | null;
  /** Shared-event id, when this block is one. */
  eventId?: string;
  /** Whose commitment this is, for busy blocks pulled from a device calendar. */
  ownerId?: string;
  color?: string | null;
  /** True when the block overlaps something else — the double-booking warning. */
  overlapping?: boolean;
}

export interface TimelineEvent extends Interval {
  id: string;
  title: string;
  location?: string | null;
  allDay?: boolean;
  color?: string | null;
}

export interface TimelineOptions {
  /** Local midnight of the day being drawn. */
  dayStart: number;
  utcOffsetMinutes: number;
  /** Visible range within the day, as local minutes from midnight. */
  windowStartMinutes?: number;
  windowEndMinutes?: number;
  /** Gaps shorter than this are absorbed rather than drawn as free time. */
  minGapMinutes?: number;
  /** Marks where "now" falls, when the day being drawn is today. */
  now?: number;
}

export interface DayTimeline {
  dayStart: number;
  windowStart: number;
  windowEnd: number;
  blocks: TimelineBlock[];
  /** All-day events, which sit above the timeline rather than inside it. */
  allDay: TimelineEvent[];
  /** Total free minutes inside the window. */
  freeMinutes: number;
  busyMinutes: number;
  /** Where "now" sits as a 0-1 fraction of the window, or null. */
  nowFraction: number | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Build one day's timeline.
 *
 * `events` are the shared plans; `busy` is what each person's own device
 * calendar says. Both are drawn, so you can see that Tuesday evening is free
 * for you but not for Tugce before suggesting it.
 */
export function buildDayTimeline(
  events: readonly TimelineEvent[],
  busy: readonly BusyInterval[],
  options: TimelineOptions,
): DayTimeline {
  const {
    dayStart,
    windowStartMinutes = 7 * 60,
    windowEndMinutes = 23 * 60,
    minGapMinutes = 20,
    now,
  } = options;

  const windowStart = dayStart + windowStartMinutes * MINUTE;
  const windowEnd = dayStart + windowEndMinutes * MINUTE;
  const dayEnd = dayStart + 24 * 60 * MINUTE;

  const allDay = events.filter((e) => e.allDay);
  const timed = events
    .filter((e) => !e.allDay && e.endsAt > dayStart && e.startsAt < dayEnd)
    .sort((a, b) => a.startsAt - b.startsAt || a.endsAt - b.endsAt);

  const dayBusy = busy.filter((b) => b.endsAt > dayStart && b.startsAt < dayEnd);

  const blocks: TimelineBlock[] = [];

  for (const event of timed) {
    const startsAt = clamp(event.startsAt, windowStart, windowEnd);
    const endsAt = clamp(event.endsAt, windowStart, windowEnd);
    if (endsAt <= startsAt) continue;

    // Flag anything that collides with another shared plan.
    const overlapping = timed.some(
      (other) => other.id !== event.id && other.startsAt < event.endsAt && other.endsAt > event.startsAt,
    );

    blocks.push({
      kind: 'event',
      startsAt,
      endsAt,
      minutes: Math.round((endsAt - startsAt) / MINUTE),
      title: event.title,
      location: event.location ?? null,
      eventId: event.id,
      color: event.color ?? null,
      overlapping,
    });
  }

  // A personal commitment is only worth drawing where it isn't already covered
  // by a shared plan — otherwise every dinner appears twice.
  const sharedSpans = mergeIntervals(timed);
  for (const block of dayBusy) {
    const clippedStart = clamp(block.startsAt, windowStart, windowEnd);
    const clippedEnd = clamp(block.endsAt, windowStart, windowEnd);
    if (clippedEnd <= clippedStart) continue;

    for (const remaining of freeIntervals(sharedSpans, clippedStart, clippedEnd)) {
      blocks.push({
        kind: 'busy',
        startsAt: remaining.startsAt,
        endsAt: remaining.endsAt,
        minutes: Math.round((remaining.endsAt - remaining.startsAt) / MINUTE),
        title: block.label ?? null,
        location: null,
        ownerId: block.ownerId,
      });
    }
  }

  // Whatever is left over is free time, and drawing it is the whole point.
  const occupied = mergeIntervals([...timed, ...dayBusy]);
  const gaps = freeIntervals(occupied, windowStart, windowEnd);
  for (const gap of gaps) {
    const minutes = Math.round((gap.endsAt - gap.startsAt) / MINUTE);
    if (minutes < minGapMinutes) continue;
    blocks.push({
      kind: 'gap',
      startsAt: gap.startsAt,
      endsAt: gap.endsAt,
      minutes,
      title: null,
      location: null,
    });
  }

  blocks.sort((a, b) => a.startsAt - b.startsAt || a.endsAt - b.endsAt);

  const busyMinutes = mergeIntervals(occupied).reduce((sum, block) => {
    const start = Math.max(block.startsAt, windowStart);
    const end = Math.min(block.endsAt, windowEnd);
    return end > start ? sum + (end - start) / MINUTE : sum;
  }, 0);

  const windowMinutes = (windowEnd - windowStart) / MINUTE;
  const nowFraction =
    now != null && now >= windowStart && now <= windowEnd
      ? (now - windowStart) / (windowEnd - windowStart)
      : null;

  return {
    dayStart,
    windowStart,
    windowEnd,
    blocks,
    allDay,
    busyMinutes: Math.round(busyMinutes),
    freeMinutes: Math.round(windowMinutes - busyMinutes),
    nowFraction,
  };
}

/** The longest stretch of free time in a day — "you have 3h free this afternoon". */
export function largestGap(timeline: DayTimeline): TimelineBlock | null {
  let best: TimelineBlock | null = null;
  for (const block of timeline.blocks) {
    if (block.kind !== 'gap') continue;
    if (!best || block.minutes > best.minutes) best = block;
  }
  return best;
}

/** "2h 30m" / "45m" — for gap labels. */
export function formatDuration(minutes: number): string {
  const rounded = Math.max(0, Math.round(minutes));
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

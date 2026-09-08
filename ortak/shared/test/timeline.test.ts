import { describe, expect, it } from 'vitest';
import { buildDayTimeline, largestGap, formatDuration, type TimelineEvent } from '../src/timeline.js';
import type { BusyInterval } from '../src/availability.js';

const H = 3600_000;
const DAY_START = Date.UTC(2025, 7, 18); // Monday, local midnight at UTC+0

const at = (hour: number, minute = 0) => DAY_START + hour * H + minute * 60_000;
const iso = (ms: number) => new Date(ms).toISOString();

function event(id: string, fromHour: number, toHour: number, over: Partial<TimelineEvent> = {}): TimelineEvent {
  return { id, title: id, startsAt: at(fromHour), endsAt: at(toHour), ...over };
}

const base = { dayStart: DAY_START, utcOffsetMinutes: 0, windowStartMinutes: 8 * 60, windowEndMinutes: 22 * 60 };

describe('buildDayTimeline', () => {
  it('shows an empty day as one large gap', () => {
    const timeline = buildDayTimeline([], [], base);
    expect(timeline.blocks).toHaveLength(1);
    expect(timeline.blocks[0]!.kind).toBe('gap');
    expect(timeline.freeMinutes).toBe(14 * 60);
    expect(timeline.busyMinutes).toBe(0);
  });

  it('interleaves events with the gaps between them', () => {
    const timeline = buildDayTimeline([event('lunch', 12, 13), event('dentist', 16, 17)], [], base);
    expect(timeline.blocks.map((b) => b.kind)).toEqual(['gap', 'event', 'gap', 'event', 'gap']);
    expect(timeline.blocks[1]!.title).toBe('lunch');
    expect(timeline.busyMinutes).toBe(120);
    expect(timeline.freeMinutes).toBe(14 * 60 - 120);
  });

  it('reports gap sizes, which is the point of the view', () => {
    const timeline = buildDayTimeline([event('lunch', 12, 13)], [], base);
    const gaps = timeline.blocks.filter((b) => b.kind === 'gap');
    expect(gaps[0]!.minutes).toBe(4 * 60); // 08:00-12:00
    expect(gaps[1]!.minutes).toBe(9 * 60); // 13:00-22:00
    expect(largestGap(timeline)!.minutes).toBe(9 * 60);
  });

  it('absorbs gaps too short to be useful', () => {
    const timeline = buildDayTimeline([event('a', 12, 13), event('b', 13, 14)], [], {
      ...base,
      minGapMinutes: 20,
    });
    // Back-to-back events leave no gap block between them.
    const kinds = timeline.blocks.map((b) => b.kind);
    expect(kinds).toEqual(['gap', 'event', 'event', 'gap']);
  });

  it('clips events to the visible window', () => {
    const timeline = buildDayTimeline([event('early', 5, 9)], [], base);
    const block = timeline.blocks.find((b) => b.kind === 'event')!;
    expect(iso(block.startsAt)).toBe(iso(at(8)));
    expect(block.minutes).toBe(60);
  });

  it('drops events entirely outside the window', () => {
    const timeline = buildDayTimeline([event('night', 2, 5)], [], base);
    expect(timeline.blocks.filter((b) => b.kind === 'event')).toHaveLength(0);
  });

  it('separates all-day events from the timeline', () => {
    const timeline = buildDayTimeline([event('birthday', 0, 24, { allDay: true }), event('lunch', 12, 13)], [], base);
    expect(timeline.allDay.map((e) => e.id)).toEqual(['birthday']);
    expect(timeline.blocks.filter((b) => b.kind === 'event').map((b) => b.title)).toEqual(['lunch']);
  });

  it('flags double-booked events', () => {
    const timeline = buildDayTimeline([event('a', 12, 14), event('b', 13, 15)], [], base);
    const events = timeline.blocks.filter((b) => b.kind === 'event');
    expect(events.every((b) => b.overlapping)).toBe(true);
  });

  it('draws the other person’s commitments alongside shared plans', () => {
    const busy: BusyInterval[] = [{ ownerId: 'tugce', startsAt: at(9), endsAt: at(11), label: null }];
    const timeline = buildDayTimeline([event('lunch', 12, 13)], busy, base);

    const busyBlocks = timeline.blocks.filter((b) => b.kind === 'busy');
    expect(busyBlocks).toHaveLength(1);
    expect(busyBlocks[0]!.ownerId).toBe('tugce');
    expect(busyBlocks[0]!.minutes).toBe(120);
    // Free time now accounts for both the shared plan and her work.
    expect(timeline.busyMinutes).toBe(180);
  });

  it('does not draw a personal commitment twice when it mirrors a shared plan', () => {
    // The shared dinner has already been mirrored into her device calendar, so
    // it comes back as busy time covering exactly the same span.
    const busy: BusyInterval[] = [{ ownerId: 'tugce', startsAt: at(19), endsAt: at(21) }];
    const timeline = buildDayTimeline([event('dinner', 19, 21)], busy, base);

    expect(timeline.blocks.filter((b) => b.kind === 'busy')).toHaveLength(0);
    expect(timeline.blocks.filter((b) => b.kind === 'event')).toHaveLength(1);
    expect(timeline.busyMinutes).toBe(120);
  });

  it('draws only the part of a commitment not covered by a shared plan', () => {
    const busy: BusyInterval[] = [{ ownerId: 'tugce', startsAt: at(18), endsAt: at(21) }];
    const timeline = buildDayTimeline([event('dinner', 19, 21)], busy, base);

    const busyBlocks = timeline.blocks.filter((b) => b.kind === 'busy');
    expect(busyBlocks).toHaveLength(1);
    expect(busyBlocks[0]!.minutes).toBe(60); // just 18:00-19:00
  });

  it('places the now marker as a fraction of the window', () => {
    const timeline = buildDayTimeline([], [], { ...base, now: at(15) });
    // 08:00-22:00 window; 15:00 is exactly half way.
    expect(timeline.nowFraction).toBeCloseTo(0.5, 5);
  });

  it('leaves the now marker unset for another day', () => {
    expect(buildDayTimeline([], [], { ...base, now: at(30) }).nowFraction).toBeNull();
  });

  it('returns blocks in chronological order', () => {
    const timeline = buildDayTimeline([event('late', 20, 21), event('early', 9, 10)], [], base);
    const starts = timeline.blocks.map((b) => b.startsAt);
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
  });

  it('shows a fully booked day with no gaps', () => {
    const timeline = buildDayTimeline([event('all', 8, 22)], [], base);
    expect(timeline.blocks.filter((b) => b.kind === 'gap')).toHaveLength(0);
    expect(timeline.freeMinutes).toBe(0);
    expect(largestGap(timeline)).toBeNull();
  });
});

describe('formatDuration', () => {
  it('reads the way a person would say it', () => {
    expect(formatDuration(45)).toBe('45m');
    expect(formatDuration(60)).toBe('1h');
    expect(formatDuration(150)).toBe('2h 30m');
    expect(formatDuration(0)).toBe('0m');
    expect(formatDuration(-5)).toBe('0m');
  });
});

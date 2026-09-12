import { describe, expect, it } from 'vitest';
import {
  mergeIntervals,
  freeIntervals,
  findFreeSlots,
  busyMinutesByOwner,
  hasConflict,
  type BusyInterval,
} from '../src/availability.js';

const H = 3600_000;
/** Monday 18 August 2025, 00:00 UTC. */
const MONDAY = Date.UTC(2025, 7, 18);

function at(dayOffset: number, hour: number, minute = 0): number {
  return MONDAY + dayOffset * 24 * H + hour * H + minute * 60_000;
}

function busy(ownerId: string, dayOffset: number, fromHour: number, toHour: number): BusyInterval {
  return { ownerId, startsAt: at(dayOffset, fromHour), endsAt: at(dayOffset, toHour) };
}

const iso = (ms: number) => new Date(ms).toISOString();

describe('mergeIntervals', () => {
  it('merges overlapping intervals', () => {
    const merged = mergeIntervals([
      { startsAt: at(0, 9), endsAt: at(0, 11) },
      { startsAt: at(0, 10), endsAt: at(0, 12) },
    ]);
    expect(merged).toHaveLength(1);
    expect(iso(merged[0]!.endsAt)).toBe(iso(at(0, 12)));
  });

  it('merges back-to-back intervals, which leave no usable gap', () => {
    const merged = mergeIntervals([
      { startsAt: at(0, 9), endsAt: at(0, 10) },
      { startsAt: at(0, 10), endsAt: at(0, 11) },
    ]);
    expect(merged).toHaveLength(1);
  });

  it('keeps genuinely separate intervals apart', () => {
    expect(
      mergeIntervals([
        { startsAt: at(0, 9), endsAt: at(0, 10) },
        { startsAt: at(0, 14), endsAt: at(0, 15) },
      ]),
    ).toHaveLength(2);
  });

  it('is order-independent and drops zero-length or invalid input', () => {
    const merged = mergeIntervals([
      { startsAt: at(0, 14), endsAt: at(0, 15) },
      { startsAt: at(0, 9), endsAt: at(0, 9) },
      { startsAt: at(0, 12), endsAt: at(0, 11) },
      { startsAt: at(0, 9), endsAt: at(0, 10) },
    ]);
    expect(merged).toHaveLength(2);
    expect(iso(merged[0]!.startsAt)).toBe(iso(at(0, 9)));
  });

  it('handles an empty list', () => {
    expect(mergeIntervals([])).toEqual([]);
  });
});

describe('freeIntervals', () => {
  it('returns the whole window when nothing is booked', () => {
    const free = freeIntervals([], at(0, 9), at(0, 17));
    expect(free).toHaveLength(1);
    expect(iso(free[0]!.startsAt)).toBe(iso(at(0, 9)));
  });

  it('carves out booked time', () => {
    const free = freeIntervals([{ startsAt: at(0, 12), endsAt: at(0, 13) }], at(0, 9), at(0, 17));
    expect(free).toHaveLength(2);
    expect(iso(free[0]!.endsAt)).toBe(iso(at(0, 12)));
    expect(iso(free[1]!.startsAt)).toBe(iso(at(0, 13)));
  });

  it('returns nothing when the window is fully booked', () => {
    expect(freeIntervals([{ startsAt: at(0, 8), endsAt: at(0, 18) }], at(0, 9), at(0, 17))).toEqual([]);
  });

  it('ignores commitments outside the window', () => {
    const free = freeIntervals(
      [
        { startsAt: at(0, 6), endsAt: at(0, 7) },
        { startsAt: at(0, 20), endsAt: at(0, 21) },
      ],
      at(0, 9),
      at(0, 17),
    );
    expect(free).toHaveLength(1);
  });

  it('clips a commitment that straddles the window edge', () => {
    const free = freeIntervals([{ startsAt: at(0, 8), endsAt: at(0, 10) }], at(0, 9), at(0, 17));
    expect(free).toHaveLength(1);
    expect(iso(free[0]!.startsAt)).toBe(iso(at(0, 10)));
  });
});

describe('findFreeSlots', () => {
  it('finds a time when both people are free', () => {
    const commitments = [
      busy('onur', 0, 9, 17), // Onur works Monday
      busy('tugce', 0, 9, 13),
    ];

    const slots = findFreeSlots(commitments, ['onur', 'tugce'], {
      from: at(0, 0),
      to: at(1, 0),
      durationMinutes: 90,
      utcOffsetMinutes: 0,
      dayStartMinutes: 8 * 60,
      dayEndMinutes: 22 * 60,
      maxResults: 3,
    });

    expect(slots.length).toBeGreaterThan(0);
    // The only shared free stretch on Monday is after Onur finishes at 17:00.
    expect(iso(slots[0]!.startsAt)).toBe(iso(at(0, 17)));
    expect(slots[0]!.availableTo).toEqual(['onur', 'tugce']);
  });

  it('respects the allowed hours of the day', () => {
    const slots = findFreeSlots([], ['onur'], {
      from: at(0, 0),
      to: at(1, 0),
      durationMinutes: 60,
      utcOffsetMinutes: 0,
      dayStartMinutes: 18 * 60,
      dayEndMinutes: 21 * 60,
      maxResults: 20,
    });

    expect(slots.length).toBeGreaterThan(0);
    for (const slot of slots) {
      const hour = new Date(slot.startsAt).getUTCHours();
      expect(hour).toBeGreaterThanOrEqual(18);
      expect(new Date(slot.endsAt).getUTCHours()).toBeLessThanOrEqual(21);
    }
  });

  it('interprets the allowed hours in the caller timezone', () => {
    // 19:00 local in UTC+2 is 17:00 UTC.
    const slots = findFreeSlots([], ['onur'], {
      from: at(0, 0),
      to: at(1, 0),
      durationMinutes: 60,
      utcOffsetMinutes: 120,
      dayStartMinutes: 19 * 60,
      dayEndMinutes: 20 * 60,
      maxResults: 5,
    });
    expect(slots).toHaveLength(1);
    expect(iso(slots[0]!.startsAt)).toBe(iso(at(0, 17)));
  });

  it('honours a buffer around existing commitments', () => {
    const commitments = [busy('onur', 0, 12, 13)];

    const noBuffer = findFreeSlots(commitments, ['onur'], {
      from: at(0, 11),
      to: at(0, 15),
      durationMinutes: 60,
      utcOffsetMinutes: 0,
      dayStartMinutes: 0,
      dayEndMinutes: 24 * 60,
      maxResults: 10,
    });
    expect(noBuffer.some((s) => s.startsAt === at(0, 13))).toBe(true);

    const buffered = findFreeSlots(commitments, ['onur'], {
      from: at(0, 11),
      to: at(0, 15),
      durationMinutes: 60,
      utcOffsetMinutes: 0,
      dayStartMinutes: 0,
      dayEndMinutes: 24 * 60,
      bufferMinutes: 30,
      maxResults: 10,
    });
    // 13:00 is now too close to the meeting that ended then.
    expect(buffered.some((s) => s.startsAt === at(0, 13))).toBe(false);
    expect(buffered.some((s) => s.startsAt === at(0, 14))).toBe(true);
  });

  it('only counts the named participants', () => {
    const commitments = [busy('ali', 0, 9, 22)];
    const slots = findFreeSlots(commitments, ['onur'], {
      from: at(0, 0),
      to: at(1, 0),
      durationMinutes: 60,
      utcOffsetMinutes: 0,
      maxResults: 1,
    });
    expect(slots).toHaveLength(1);
  });

  it('restricts the search to chosen weekdays', () => {
    const slots = findFreeSlots([], ['onur'], {
      from: at(0, 0),
      to: at(7, 0),
      durationMinutes: 60,
      utcOffsetMinutes: 0,
      dayStartMinutes: 10 * 60,
      dayEndMinutes: 12 * 60,
      weekdays: [6, 0], // weekends only
      maxResults: 20,
    });
    expect(slots.length).toBeGreaterThan(0);
    for (const slot of slots) {
      expect([0, 6]).toContain(new Date(slot.startsAt).getUTCDay());
    }
  });

  it('rounds proposed times to the granularity', () => {
    const commitments = [{ ownerId: 'onur', startsAt: at(0, 10), endsAt: at(0, 10) + 7 * 60_000 }];
    const slots = findFreeSlots(commitments, ['onur'], {
      from: at(0, 10),
      to: at(0, 14),
      durationMinutes: 30,
      utcOffsetMinutes: 0,
      dayStartMinutes: 0,
      dayEndMinutes: 24 * 60,
      granularityMinutes: 15,
      maxResults: 2,
    });
    // The 10:07 finish is rounded up to 10:15 rather than proposed as-is.
    expect(iso(slots[0]!.startsAt)).toBe(iso(at(0, 10, 15)));
  });

  it('returns nothing when there is genuinely no room', () => {
    const commitments = [busy('onur', 0, 0, 24), busy('tugce', 0, 0, 24)];
    expect(
      findFreeSlots(commitments, ['onur', 'tugce'], {
        from: at(0, 0),
        to: at(1, 0),
        durationMinutes: 60,
        utcOffsetMinutes: 0,
      }),
    ).toEqual([]);
  });

  it('rejects nonsense input rather than looping', () => {
    const base = { from: at(0, 0), to: at(1, 0), durationMinutes: 60, utcOffsetMinutes: 0 };
    expect(findFreeSlots([], [], base)).toEqual([]);
    expect(findFreeSlots([], ['onur'], { ...base, durationMinutes: 0 })).toEqual([]);
    expect(findFreeSlots([], ['onur'], { ...base, to: base.from })).toEqual([]);
    expect(
      findFreeSlots([], ['onur'], { ...base, dayStartMinutes: 20 * 60, dayEndMinutes: 8 * 60 }),
    ).toEqual([]);
  });

  it('searches across several days to find the first opening', () => {
    // Both are solidly booked until Wednesday evening.
    const commitments = [
      busy('onur', 0, 0, 24),
      busy('tugce', 0, 0, 24),
      busy('onur', 1, 0, 24),
      busy('tugce', 1, 0, 24),
      busy('onur', 2, 0, 19),
      busy('tugce', 2, 0, 19),
    ];

    const slots = findFreeSlots(commitments, ['onur', 'tugce'], {
      from: at(0, 0),
      to: at(5, 0),
      durationMinutes: 60,
      utcOffsetMinutes: 0,
      dayStartMinutes: 8 * 60,
      dayEndMinutes: 22 * 60,
      maxResults: 1,
    });

    expect(slots).toHaveLength(1);
    expect(iso(slots[0]!.startsAt)).toBe(iso(at(2, 19)));
  });
});

describe('busyMinutesByOwner', () => {
  it('totals each person without double-counting overlaps', () => {
    const totals = busyMinutesByOwner(
      [busy('onur', 0, 9, 12), busy('onur', 0, 11, 13), busy('tugce', 0, 9, 10)],
      at(0, 0),
      at(1, 0),
    );
    expect(totals.onur).toBe(4 * 60);
    expect(totals.tugce).toBe(60);
  });

  it('clips to the window', () => {
    const totals = busyMinutesByOwner([busy('onur', 0, 8, 12)], at(0, 10), at(0, 11));
    expect(totals.onur).toBe(60);
  });
});

describe('hasConflict', () => {
  it('detects a clash and ignores touching times', () => {
    const commitments = [busy('onur', 0, 10, 11)];
    expect(hasConflict(commitments, ['onur'], { startsAt: at(0, 10, 30), endsAt: at(0, 11, 30) })).toBe(true);
    expect(hasConflict(commitments, ['onur'], { startsAt: at(0, 11), endsAt: at(0, 12) })).toBe(false);
    expect(hasConflict(commitments, ['tugce'], { startsAt: at(0, 10), endsAt: at(0, 11) })).toBe(false);
  });
});

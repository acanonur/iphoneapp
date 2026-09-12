import { describe, expect, it } from 'vitest';
import {
  bucketFor,
  bucketTasks,
  groupUpcomingByDay,
  bucketCounts,
  type PlannableTask,
} from '../src/planning.js';

const DAY = 24 * 3600_000;
/** Saturday 16 August 2025, 10:00 UTC. */
const NOW = Date.UTC(2025, 7, 16, 10, 0);

function task(id: string, over: Partial<PlannableTask> = {}): PlannableTask {
  return { id, title: id, done: false, dueAt: null, deferAt: null, ...over };
}

const opts = { now: NOW, utcOffsetMinutes: 0 };

describe('bucketFor', () => {
  it('puts an undated task in Anytime', () => {
    expect(bucketFor(task('t'), opts)).toBe('anytime');
  });

  it('puts anything due today in Today, including late tonight', () => {
    expect(bucketFor(task('t', { dueAt: NOW + 2 * 3600_000 }), opts)).toBe('today');
    expect(bucketFor(task('t', { dueAt: Date.UTC(2025, 7, 16, 23, 30) }), opts)).toBe('today');
  });

  it('puts anything overdue in Today, not out of sight', () => {
    expect(bucketFor(task('t', { dueAt: NOW - 5 * DAY }), opts)).toBe('today');
  });

  it('puts a task due tomorrow in Upcoming', () => {
    expect(bucketFor(task('t', { dueAt: Date.UTC(2025, 7, 17, 0, 30) }), opts)).toBe('upcoming');
  });

  it('hides a deferred task until its start date', () => {
    expect(bucketFor(task('t', { deferAt: NOW + 3 * DAY }), opts)).toBe('upcoming');
    expect(bucketFor(task('t', { deferAt: NOW - DAY }), opts)).toBe('today');
  });

  it('treats a far-deferred, undated task as Someday', () => {
    expect(bucketFor(task('t', { deferAt: NOW + 90 * DAY }), opts)).toBe('someday');
  });

  it('keeps a far-deferred task with a due date in Upcoming', () => {
    // It still has a deadline, so it must not vanish into Someday.
    expect(bucketFor(task('t', { deferAt: NOW + 90 * DAY, dueAt: NOW + 100 * DAY }), opts)).toBe('upcoming');
  });

  it('respects a custom someday horizon', () => {
    expect(bucketFor(task('t', { deferAt: NOW + 10 * DAY }), { ...opts, somedayHorizonDays: 7 })).toBe('someday');
  });

  it('puts done tasks in the logbook regardless of dates', () => {
    expect(bucketFor(task('t', { done: true, dueAt: NOW - 10 * DAY }), opts)).toBe('logbook');
  });

  it('judges the day boundary in local time', () => {
    // 23:30 UTC on the 16th is 01:30 on the 17th in UTC+2 — so it is not today.
    const lateUtc = Date.UTC(2025, 7, 16, 23, 30);
    expect(bucketFor(task('t', { dueAt: lateUtc }), { now: NOW, utcOffsetMinutes: 0 })).toBe('today');
    expect(bucketFor(task('t', { dueAt: lateUtc }), { now: NOW, utcOffsetMinutes: 120 })).toBe('upcoming');
  });
});

describe('bucketTasks', () => {
  const tasks = [
    task('overdue', { dueAt: NOW - 3 * DAY }),
    task('today', { dueAt: NOW + 3600_000 }),
    task('tomorrow', { dueAt: NOW + DAY }),
    task('someday', { deferAt: NOW + 120 * DAY }),
    task('anytime-a', { position: 2 }),
    task('anytime-b', { position: 1 }),
    task('done', { done: true, doneAt: NOW - 1000 }),
    task('done-older', { done: true, doneAt: NOW - 5000 }),
  ];

  it('sorts everything into buckets', () => {
    const buckets = bucketTasks(tasks, opts);
    expect(buckets.today.map((t) => t.id)).toEqual(['overdue', 'today']);
    expect(buckets.upcoming.map((t) => t.id)).toEqual(['tomorrow']);
    expect(buckets.anytime.map((t) => t.id)).toEqual(['anytime-b', 'anytime-a']);
    expect(buckets.someday.map((t) => t.id)).toEqual(['someday']);
    expect(buckets.logbook.map((t) => t.id)).toEqual(['done', 'done-older']);
  });

  it('flags overdue tasks separately without removing them from Today', () => {
    const buckets = bucketTasks(tasks, opts);
    expect(buckets.overdue.map((t) => t.id)).toEqual(['overdue']);
    expect(buckets.today.map((t) => t.id)).toContain('overdue');
  });

  it('orders dated tasks soonest first and undated ones last', () => {
    const mixed = [
      task('later', { dueAt: NOW + 5 * DAY }),
      task('undated'),
      task('sooner', { dueAt: NOW + 2 * DAY }),
    ];
    // Anytime and Upcoming are separate buckets, so compare within one.
    const buckets = bucketTasks(mixed, opts);
    expect(buckets.upcoming.map((t) => t.id)).toEqual(['sooner', 'later']);
    expect(buckets.anytime.map((t) => t.id)).toEqual(['undated']);
  });

  it('breaks ties by priority, then manual position', () => {
    const same = NOW + 2 * DAY;
    const buckets = bucketTasks(
      [
        task('low', { dueAt: same, priority: 0, position: 1 }),
        task('high', { dueAt: same, priority: 2, position: 9 }),
        task('mid', { dueAt: same, priority: 1, position: 5 }),
      ],
      opts,
    );
    expect(buckets.upcoming.map((t) => t.id)).toEqual(['high', 'mid', 'low']);
  });

  it('handles an empty list', () => {
    const buckets = bucketTasks([], opts);
    expect(bucketCounts(buckets)).toEqual({
      today: 0, upcoming: 0, anytime: 0, someday: 0, logbook: 0, overdue: 0,
    });
  });
});

describe('groupUpcomingByDay', () => {
  it('groups by local day, in order', () => {
    const buckets = bucketTasks(
      [
        task('mon-b', { dueAt: Date.UTC(2025, 7, 18, 15) }),
        task('tue', { dueAt: Date.UTC(2025, 7, 19, 9) }),
        task('mon-a', { dueAt: Date.UTC(2025, 7, 18, 9) }),
      ],
      opts,
    );

    const days = groupUpcomingByDay(buckets.upcoming, opts);
    expect(days).toHaveLength(2);
    expect(days[0]!.tasks.map((t) => t.id)).toEqual(['mon-a', 'mon-b']);
    expect(days[1]!.tasks.map((t) => t.id)).toEqual(['tue']);
    expect(new Date(days[0]!.dayStart).toISOString()).toBe('2025-08-18T00:00:00.000Z');
  });

  it('groups by the defer date when there is no due date', () => {
    const days = groupUpcomingByDay([task('deferred', { deferAt: Date.UTC(2025, 7, 20, 9) })], opts);
    expect(days).toHaveLength(1);
    expect(new Date(days[0]!.dayStart).toISOString()).toBe('2025-08-20T00:00:00.000Z');
  });

  it('skips tasks with no date at all', () => {
    expect(groupUpcomingByDay([task('nothing')], opts)).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import {
  CHORE_HISTORY_LIMIT,
  choreBalance,
  choreStatus,
  completeChore,
  daysUntilDue,
  describeDue,
  describeInterval,
  groupChores,
  localDayStart,
  nextInRotation,
  undoLastCompletion,
  type ChoreLike,
} from '../src/chores.js';

const DAY = 24 * 3600_000;
/** Saturday 16 August 2025, 10:00 UTC. */
const NOW = Date.UTC(2025, 7, 16, 10, 0);
const TODAY = Date.UTC(2025, 7, 16);
const opts = { now: NOW, utcOffsetMinutes: 0 };

function chore(over: Partial<ChoreLike> = {}): ChoreLike {
  return {
    id: 'c',
    title: 'Bins',
    everyDays: 7,
    nextDueAt: TODAY,
    mode: 'rotate',
    assigneeId: 'a',
    effort: 1,
    history: [],
    paused: false,
    ...over,
  };
}

describe('localDayStart', () => {
  it('is midnight UTC with no offset', () => {
    expect(localDayStart(NOW, 0)).toBe(TODAY);
  });

  it('follows the local day, not the UTC one', () => {
    // 23:30 UTC is already 01:30 on the 17th in UTC+2; that day began at 22:00 UTC.
    expect(localDayStart(Date.UTC(2025, 7, 16, 23, 30), 120)).toBe(Date.UTC(2025, 7, 16, 22, 0));
  });
});

describe('daysUntilDue and choreStatus', () => {
  it('is 0 and "today" for a chore due today', () => {
    expect(daysUntilDue(chore(), opts)).toBe(0);
    expect(choreStatus(chore(), opts)).toBe('today');
  });

  it('is negative and "overdue" for a chore due earlier', () => {
    const late = chore({ nextDueAt: TODAY - 3 * DAY });
    expect(daysUntilDue(late, opts)).toBe(-3);
    expect(choreStatus(late, opts)).toBe('overdue');
  });

  it('is positive and "upcoming" for a chore due later', () => {
    const later = chore({ nextDueAt: TODAY + 2 * DAY });
    expect(daysUntilDue(later, opts)).toBe(2);
    expect(choreStatus(later, opts)).toBe('upcoming');
  });

  it('judges the day in the local timezone', () => {
    // Due at local midnight on the 17th in UTC+2, which is 22:00 UTC on the 16th.
    const c = chore({ nextDueAt: Date.UTC(2025, 7, 16, 22, 0) });
    expect(daysUntilDue(c, { now: NOW, utcOffsetMinutes: 120 })).toBe(1);
    expect(daysUntilDue(c, { now: NOW, utcOffsetMinutes: 0 })).toBe(0);
  });

  it('reports paused ahead of anything else', () => {
    expect(choreStatus(chore({ paused: true, nextDueAt: TODAY - 5 * DAY }), opts)).toBe('paused');
  });
});

describe('nextInRotation', () => {
  it('moves to the next member and wraps', () => {
    expect(nextInRotation(['a', 'b', 'c'], 'a')).toBe('b');
    expect(nextInRotation(['a', 'b', 'c'], 'c')).toBe('a');
    expect(nextInRotation(['a', 'b'], 'b')).toBe('a');
  });

  it('starts from the first member when there is no current turn', () => {
    expect(nextInRotation(['a', 'b'], null)).toBe('a');
  });

  it('hands a departed member’s turn to the first member', () => {
    expect(nextInRotation(['a', 'b'], 'gone')).toBe('a');
  });

  it('is null for an empty household', () => {
    expect(nextInRotation([], 'a')).toBeNull();
  });

  it('keeps a one-person household on the same person', () => {
    expect(nextInRotation(['a'], 'a')).toBe('a');
  });
});

describe('completeChore', () => {
  it('schedules the next one an interval after today', () => {
    expect(completeChore(chore(), 'a', ['a', 'b'], opts).nextDueAt).toBe(Date.UTC(2025, 7, 23));
  });

  it('counts from the day it was done when it was done late', () => {
    const late = chore({ nextDueAt: TODAY - 10 * DAY, everyDays: 3 });
    expect(completeChore(late, 'a', ['a', 'b'], opts).nextDueAt).toBe(Date.UTC(2025, 7, 19));
  });

  it('schedules against the local day', () => {
    // 23:30 UTC on the 16th is the 17th in UTC+2; a daily chore is next due on the 18th local.
    const result = completeChore(chore({ everyDays: 1 }), 'a', ['a', 'b'], {
      now: Date.UTC(2025, 7, 16, 23, 30),
      utcOffsetMinutes: 120,
    });
    expect(result.nextDueAt).toBe(Date.UTC(2025, 7, 17, 22, 0));
  });

  it('passes the turn on in rotate mode', () => {
    expect(completeChore(chore(), 'a', ['a', 'b'], opts).assigneeId).toBe('b');
  });

  it('rotates from whoever did it, so covering for someone gives them the next one', () => {
    // It was a's turn, b did it — the next one is a's.
    expect(completeChore(chore({ assigneeId: 'a' }), 'b', ['a', 'b'], opts).assigneeId).toBe('a');
  });

  it('leaves a fixed chore with its owner', () => {
    const fixed = chore({ mode: 'fixed', assigneeId: 'a' });
    expect(completeChore(fixed, 'b', ['a', 'b'], opts).assigneeId).toBe('a');
  });

  it('has no turn in anyone mode', () => {
    const open = chore({ mode: 'anyone', assigneeId: null });
    expect(completeChore(open, 'a', ['a', 'b'], opts).assigneeId).toBeNull();
  });

  it('logs the completion without touching the original', () => {
    const original = chore({ history: [{ by: 'b', at: NOW - DAY }] });
    const result = completeChore(original, 'a', ['a', 'b'], opts);
    expect(result.history).toEqual([
      { by: 'b', at: NOW - DAY },
      { by: 'a', at: NOW },
    ]);
    expect(original.history).toHaveLength(1);
  });

  it('keeps only the newest entries once the log is full', () => {
    const history = Array.from({ length: CHORE_HISTORY_LIMIT }, (_, i) => ({ by: 'a', at: i }));
    const result = completeChore(chore({ history }), 'b', ['a', 'b'], opts);
    expect(result.history).toHaveLength(CHORE_HISTORY_LIMIT);
    expect(result.history[0]).toEqual({ by: 'a', at: 1 });
    expect(result.history[CHORE_HISTORY_LIMIT - 1]).toEqual({ by: 'b', at: NOW });
  });

  it('treats a nonsense interval as daily', () => {
    expect(completeChore(chore({ everyDays: 0 }), 'a', ['a'], opts).nextDueAt).toBe(TODAY + DAY);
  });
});

describe('undoLastCompletion', () => {
  it('is null when nothing has been done', () => {
    expect(undoLastCompletion(chore(), opts)).toBeNull();
  });

  it('puts the chore back to due today and gives the turn back', () => {
    const done = chore({
      assigneeId: 'b',
      nextDueAt: TODAY + 7 * DAY,
      history: [
        { by: 'b', at: NOW - 7 * DAY },
        { by: 'a', at: NOW - 1000 },
      ],
    });
    expect(undoLastCompletion(done, opts)).toEqual({
      nextDueAt: TODAY,
      assigneeId: 'a',
      history: [{ by: 'b', at: NOW - 7 * DAY }],
    });
  });

  it('round-trips with completeChore in rotate mode', () => {
    const before = chore({ assigneeId: 'a' });
    const after = { ...before, ...completeChore(before, 'a', ['a', 'b'], opts) };
    const undone = undoLastCompletion(after, opts);
    expect(undone?.assigneeId).toBe('a');
    expect(undone?.history).toEqual([]);
  });

  it('keeps the owner of a fixed chore and no one for an open one', () => {
    const entry = [{ by: 'b', at: NOW - 1000 }];
    expect(undoLastCompletion(chore({ mode: 'fixed', assigneeId: 'a', history: entry }), opts)?.assigneeId).toBe('a');
    expect(undoLastCompletion(chore({ mode: 'anyone', assigneeId: null, history: entry }), opts)?.assigneeId).toBeNull();
  });
});

describe('groupChores', () => {
  it('sorts into due, upcoming and paused', () => {
    const overdue = chore({ id: '1', title: 'Windows', nextDueAt: TODAY - 2 * DAY });
    const today = chore({ id: '2', title: 'Bins' });
    const alsoToday = chore({ id: '3', title: 'Ash' });
    const soon = chore({ id: '4', title: 'Laundry', nextDueAt: TODAY + DAY });
    const later = chore({ id: '5', title: 'Bathroom', nextDueAt: TODAY + 4 * DAY });
    const paused = chore({ id: '6', title: 'Garden', paused: true, nextDueAt: TODAY - 30 * DAY });

    const groups = groupChores([later, paused, today, soon, overdue, alsoToday], opts);

    expect(groups.due.map((c) => c.id)).toEqual(['1', '3', '2']);
    expect(groups.upcoming.map((c) => c.id)).toEqual(['4', '5']);
    expect(groups.paused.map((c) => c.id)).toEqual(['6']);
  });

  it('returns empty groups for no chores', () => {
    expect(groupChores([], opts)).toEqual({ due: [], upcoming: [], paused: [] });
  });
});

describe('choreBalance', () => {
  it('weights completions by effort and shares sum to one', () => {
    const bathroom = chore({
      effort: 3,
      history: [{ by: 'a', at: NOW - DAY }],
    });
    const bins = chore({
      effort: 1,
      history: [
        { by: 'b', at: NOW - 2 * DAY },
        { by: 'a', at: NOW - 3 * DAY },
        { by: 'b', at: NOW - 9 * DAY },
      ],
    });

    const [a, b] = choreBalance([bathroom, bins], ['a', 'b'], opts);

    expect(a).toEqual({ memberId: 'a', count: 2, effort: 4, share: 4 / 6 });
    expect(b).toEqual({ memberId: 'b', count: 2, effort: 2, share: 2 / 6 });
    expect((a?.share ?? 0) + (b?.share ?? 0)).toBeCloseTo(1, 10);
  });

  it('ignores completions older than the window, and ones in the future', () => {
    const c = chore({
      history: [
        { by: 'a', at: NOW - 31 * DAY },
        { by: 'a', at: NOW + DAY },
        { by: 'b', at: NOW - 29 * DAY },
      ],
    });
    const [a, b] = choreBalance([c], ['a', 'b'], opts);
    expect(a?.count).toBe(0);
    expect(b?.count).toBe(1);
    expect(b?.share).toBe(1);
  });

  it('honours a custom window', () => {
    const c = chore({ history: [{ by: 'a', at: NOW - 8 * DAY }] });
    expect(choreBalance([c], ['a'], { ...opts, windowDays: 7 })[0]?.count).toBe(0);
    expect(choreBalance([c], ['a'], { ...opts, windowDays: 14 })[0]?.count).toBe(1);
  });

  it('leaves out people who are not members', () => {
    const c = chore({ history: [{ by: 'guest', at: NOW - DAY }, { by: 'a', at: NOW - DAY }] });
    const balance = choreBalance([c], ['a', 'b'], opts);
    expect(balance.map((m) => m.memberId)).toEqual(['a', 'b']);
    expect(balance[0]?.share).toBe(1);
  });

  it('still counts work done on a chore that was later paused', () => {
    const c = chore({ paused: true, history: [{ by: 'a', at: NOW - DAY }] });
    expect(choreBalance([c], ['a', 'b'], opts)[0]?.count).toBe(1);
  });

  it('is all zeros when nothing has been done', () => {
    expect(choreBalance([chore()], ['a', 'b'], opts)).toEqual([
      { memberId: 'a', count: 0, effort: 0, share: 0 },
      { memberId: 'b', count: 0, effort: 0, share: 0 },
    ]);
  });
});

describe('describeInterval', () => {
  it.each([
    [1, 'Every day'],
    [3, 'Every 3 days'],
    [7, 'Every week'],
    [14, 'Every 2 weeks'],
    [30, 'Every month'],
    [60, 'Every 2 months'],
    [210, 'Every 7 months'],
    [365, 'Every year'],
    [31, 'Every 31 days'],
  ])('%i days reads as "%s"', (days, text) => {
    expect(describeInterval(days)).toBe(text);
  });
});

describe('describeDue', () => {
  it.each([
    [-3, 'Overdue by 3 days'],
    [-1, 'Overdue by 1 day'],
    [0, 'Due today'],
    [1, 'Tomorrow'],
    [5, 'In 5 days'],
  ])('%i days out reads as "%s"', (days, text) => {
    expect(describeDue(chore({ nextDueAt: TODAY + days * DAY }), opts)).toBe(text);
  });

  it('says paused for a paused chore', () => {
    expect(describeDue(chore({ paused: true }), opts)).toBe('Paused');
  });
});

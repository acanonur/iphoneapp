/**
 * Recurring chores, and who has been doing them.
 *
 * A chore is a household job that comes round again — the bins, the laundry,
 * the bathroom. Three things make it different from a to-do:
 *
 *  - **It repeats.** Finishing it does not close it; it schedules the next one.
 *    The next date is counted from the day it was actually done, not from the
 *    day it was due, so a chore done late does not come back early and a
 *    neglected one never piles up into three overdue copies of itself.
 *  - **It has a turn.** In `rotate` mode, finishing a chore hands it to the
 *    next person. `fixed` always stays with one person; `anyone` has no turn.
 *  - **It is counted.** Every completion is logged with who did it, which is
 *    what lets the app show the split of the work over the last month instead
 *    of leaving it to each person's impression.
 *
 * Everything here is a pure function over plain data; the app stores the
 * result. Days are judged against the *local* day, like the rest of planning.
 */

export type ChoreMode = 'rotate' | 'fixed' | 'anyone';

/** One completion: who (member id) and when (epoch ms). */
export interface ChoreLogEntry {
  by: string;
  at: number;
}

export interface ChoreLike {
  id: string;
  title: string;
  /** Repeat interval in days, at least 1. */
  everyDays: number;
  /** Epoch ms; the start of the local day it is next due. */
  nextDueAt: number;
  mode: ChoreMode;
  /** Whose turn it is now. Null in `anyone` mode. */
  assigneeId: string | null;
  /** 1 light, 2 medium, 3 heavy — so ten minutes of bins is not an hour of bathroom. */
  effort: number;
  /** Oldest first. */
  history: ChoreLogEntry[];
  paused: boolean;
}

export interface ChoreOptions {
  now?: number;
  utcOffsetMinutes?: number;
}

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** How many completions a chore remembers. A daily chore keeps two months. */
export const CHORE_HISTORY_LIMIT = 60;

/** Start of the local day containing `ms`, as epoch ms. */
export function localDayStart(ms: number, offsetMinutes: number): number {
  const shifted = new Date(ms + offsetMinutes * MINUTE);
  shifted.setUTCHours(0, 0, 0, 0);
  return shifted.getTime() - offsetMinutes * MINUTE;
}

/** Whole local days from today until the chore is due. Negative is overdue, 0 is today. */
export function daysUntilDue(chore: ChoreLike, options: ChoreOptions = {}): number {
  const now = options.now ?? Date.now();
  const offset = options.utcOffsetMinutes ?? 0;
  return Math.round((localDayStart(chore.nextDueAt, offset) - localDayStart(now, offset)) / DAY);
}

export type ChoreStatus = 'overdue' | 'today' | 'upcoming' | 'paused';

export function choreStatus(chore: ChoreLike, options: ChoreOptions = {}): ChoreStatus {
  if (chore.paused) return 'paused';
  const days = daysUntilDue(chore, options);
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  return 'upcoming';
}

/**
 * The member after `current` in `memberIds` order, wrapping round.
 *
 * Someone who is no longer in the list — they left the household — hands the
 * turn to the first member rather than leaving the chore with nobody.
 */
export function nextInRotation(memberIds: readonly string[], current: string | null): string | null {
  if (memberIds.length === 0) return null;
  const index = current === null ? -1 : memberIds.indexOf(current);
  if (index === -1) return memberIds[0] ?? null;
  return memberIds[(index + 1) % memberIds.length] ?? null;
}

/** The fields that change when a chore is completed or a completion is undone. */
export interface ChoreCompletion {
  nextDueAt: number;
  assigneeId: string | null;
  history: ChoreLogEntry[];
}

/**
 * What changes when `by` completes the chore now.
 *
 * In rotate mode the turn passes to whoever follows the person who *did* it,
 * not whoever follows the person whose turn it was: if you cover for the other
 * person, the next one is theirs.
 */
export function completeChore(
  chore: ChoreLike,
  by: string,
  memberIds: readonly string[],
  options: ChoreOptions = {},
): ChoreCompletion {
  const now = options.now ?? Date.now();
  const offset = options.utcOffsetMinutes ?? 0;
  const everyDays = Math.max(1, Math.round(chore.everyDays));

  return {
    nextDueAt: localDayStart(now, offset) + everyDays * DAY,
    assigneeId:
      chore.mode === 'rotate'
        ? nextInRotation(memberIds, by)
        : chore.mode === 'fixed'
          ? chore.assigneeId
          : null,
    history: [...chore.history, { by, at: now }].slice(-CHORE_HISTORY_LIMIT),
  };
}

/**
 * Undo the most recent completion — the tick was a slip of the thumb.
 *
 * The chore is due today again, and in rotate mode the turn goes back to the
 * person whose completion was removed. Returns null when there is nothing to
 * undo.
 */
export function undoLastCompletion(chore: ChoreLike, options: ChoreOptions = {}): ChoreCompletion | null {
  const last = chore.history[chore.history.length - 1];
  if (!last) return null;

  const now = options.now ?? Date.now();
  const offset = options.utcOffsetMinutes ?? 0;

  return {
    nextDueAt: localDayStart(now, offset),
    assigneeId:
      chore.mode === 'rotate' ? last.by : chore.mode === 'fixed' ? chore.assigneeId : null,
    history: chore.history.slice(0, -1),
  };
}

/**
 * Splits chores into what needs doing, what is coming, and what is paused.
 *
 *   due       overdue and today — most overdue first, then by title
 *   upcoming  soonest first, then by title
 *   paused    by title
 */
export function groupChores<T extends ChoreLike>(
  chores: readonly T[],
  options: ChoreOptions = {},
): { due: T[]; upcoming: T[]; paused: T[] } {
  const due: T[] = [];
  const upcoming: T[] = [];
  const paused: T[] = [];

  for (const chore of chores) {
    const status = choreStatus(chore, options);
    if (status === 'paused') paused.push(chore);
    else if (status === 'upcoming') upcoming.push(chore);
    else due.push(chore);
  }

  const byDueThenTitle = (a: T, b: T) =>
    daysUntilDue(a, options) - daysUntilDue(b, options) || a.title.localeCompare(b.title);

  due.sort(byDueThenTitle);
  upcoming.sort(byDueThenTitle);
  paused.sort((a, b) => a.title.localeCompare(b.title));

  return { due, upcoming, paused };
}

export interface MemberLoad {
  memberId: string;
  /** How many chores they completed in the window. */
  count: number;
  /** The same, weighted by each chore's effort. */
  effort: number;
  /** Their part of the total effort, 0 to 1. All zero when nothing was done. */
  share: number;
}

/**
 * Who has been doing the work.
 *
 * Counts completions in the last `windowDays` (30 by default) across every
 * chore, paused ones included — pausing a chore does not erase the work already
 * put into it. Returns one entry per member, in the order given. Completions by
 * people who are not in `memberIds` are left out rather than skewing the split.
 */
export function choreBalance(
  chores: readonly ChoreLike[],
  memberIds: readonly string[],
  options: ChoreOptions & { windowDays?: number } = {},
): MemberLoad[] {
  const now = options.now ?? Date.now();
  const windowStart = now - (options.windowDays ?? 30) * DAY;

  const loads = new Map<string, { count: number; effort: number }>();
  for (const id of memberIds) loads.set(id, { count: 0, effort: 0 });

  for (const chore of chores) {
    for (const entry of chore.history) {
      if (entry.at < windowStart || entry.at > now) continue;
      const load = loads.get(entry.by);
      if (!load) continue;
      load.count += 1;
      load.effort += chore.effort;
    }
  }

  let total = 0;
  for (const load of loads.values()) total += load.effort;

  return memberIds.map((memberId) => {
    const load = loads.get(memberId) ?? { count: 0, effort: 0 };
    return {
      memberId,
      count: load.count,
      effort: load.effort,
      share: total > 0 ? load.effort / total : 0,
    };
  });
}

/** "Every day", "Every 3 days", "Every week", "Every 2 weeks", "Every month", "Every year". */
export function describeInterval(everyDays: number): string {
  if (everyDays <= 1) return 'Every day';
  if (everyDays === 365) return 'Every year';
  if (everyDays % 30 === 0) {
    const months = everyDays / 30;
    return months === 1 ? 'Every month' : `Every ${months} months`;
  }
  if (everyDays % 7 === 0) {
    const weeks = everyDays / 7;
    return weeks === 1 ? 'Every week' : `Every ${weeks} weeks`;
  }
  return `Every ${everyDays} days`;
}

/** "Overdue by 3 days", "Due today", "Tomorrow", "In 5 days", or "Paused". */
export function describeDue(chore: ChoreLike, options: ChoreOptions = {}): string {
  if (chore.paused) return 'Paused';
  const days = daysUntilDue(chore, options);
  if (days < 0) return days === -1 ? 'Overdue by 1 day' : `Overdue by ${-days} days`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

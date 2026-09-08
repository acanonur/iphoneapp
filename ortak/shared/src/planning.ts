/**
 * Task organisation, in the shape Things 3 made the standard.
 *
 * The idea worth stealing is not a feature, it is a discipline: a task is in
 * exactly one of a handful of buckets, and the bucket is derived from dates
 * rather than chosen by hand. You never file anything; you set a date, or you
 * don't, and the list sorts itself.
 *
 *   Today      due or deferred to today, and anything overdue
 *   Upcoming   dated later
 *   Anytime    no dates, ready to be picked up
 *   Someday    deferred with no due date — deliberately out of sight
 *   Logbook    done
 *
 * The defer date ("start date" in Things, "defer" in OmniFocus) is what keeps
 * Anytime honest: a task you cannot act on until next month is hidden until
 * then instead of nagging.
 */

export type Bucket = 'today' | 'upcoming' | 'anytime' | 'someday' | 'logbook';

export interface PlannableTask {
  id: string;
  title: string;
  done: boolean;
  doneAt?: number | null;
  /** When it must be finished. */
  dueAt?: number | null;
  /** Not actionable until this moment; hidden from Today/Anytime before it. */
  deferAt?: number | null;
  assigneeId?: string | null;
  priority?: number;
  position?: number;
  category?: string | null;
}

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

function localDayStart(ms: number, offsetMinutes: number): number {
  const shifted = new Date(ms + offsetMinutes * MINUTE);
  shifted.setUTCHours(0, 0, 0, 0);
  return shifted.getTime() - offsetMinutes * MINUTE;
}

export interface BucketOptions {
  now?: number;
  utcOffsetMinutes?: number;
  /**
   * How far ahead "Someday" starts. A task deferred beyond this is parked
   * rather than merely scheduled. Things uses "someday" as an explicit state;
   * deriving it from the defer date keeps it to one input.
   */
  somedayHorizonDays?: number;
}

/**
 * Which bucket a task belongs in.
 *
 * Everything is judged against the *local* day, so a task due at 23:00 tonight
 * is in Today rather than Upcoming, and one due at 00:30 tomorrow is not.
 */
export function bucketFor(task: PlannableTask, options: BucketOptions = {}): Bucket {
  const now = options.now ?? Date.now();
  const offset = options.utcOffsetMinutes ?? 0;
  const horizonDays = options.somedayHorizonDays ?? 30;

  if (task.done) return 'logbook';

  const todayStart = localDayStart(now, offset);
  const tomorrowStart = todayStart + DAY;
  const somedayStart = todayStart + horizonDays * DAY;

  const due = task.dueAt ?? null;
  const defer = task.deferAt ?? null;

  // Overdue and due-today both belong in front of you.
  if (due !== null && due < tomorrowStart) return 'today';

  // Deferred to today or earlier: it has become actionable.
  if (defer !== null && defer < tomorrowStart) return due === null ? 'today' : 'upcoming';

  if (defer !== null && defer >= somedayStart && due === null) return 'someday';
  if (defer !== null) return 'upcoming';
  if (due !== null) return 'upcoming';

  return 'anytime';
}

export interface BucketedTasks<T extends PlannableTask> {
  today: T[];
  upcoming: T[];
  anytime: T[];
  someday: T[];
  logbook: T[];
  /** Subset of `today` that is past its due date. */
  overdue: T[];
}

/**
 * Sort inside a bucket: soonest date first, then priority, then manual order.
 * Undated tasks fall to the bottom rather than the top.
 */
function compareTasks(a: PlannableTask, b: PlannableTask): number {
  const keyA = a.dueAt ?? a.deferAt ?? Number.POSITIVE_INFINITY;
  const keyB = b.dueAt ?? b.deferAt ?? Number.POSITIVE_INFINITY;
  if (keyA !== keyB) return keyA - keyB;

  const priorityA = a.priority ?? 0;
  const priorityB = b.priority ?? 0;
  if (priorityA !== priorityB) return priorityB - priorityA;

  return (a.position ?? 0) - (b.position ?? 0);
}

export function bucketTasks<T extends PlannableTask>(
  tasks: readonly T[],
  options: BucketOptions = {},
): BucketedTasks<T> {
  const now = options.now ?? Date.now();
  const offset = options.utcOffsetMinutes ?? 0;
  const todayStart = localDayStart(now, offset);

  const result: BucketedTasks<T> = {
    today: [],
    upcoming: [],
    anytime: [],
    someday: [],
    logbook: [],
    overdue: [],
  };

  for (const task of tasks) {
    const bucket = bucketFor(task, options);
    result[bucket].push(task);
    if (bucket === 'today' && task.dueAt !== null && task.dueAt !== undefined && task.dueAt < todayStart) {
      result.overdue.push(task);
    }
  }

  result.today.sort(compareTasks);
  result.upcoming.sort(compareTasks);
  result.anytime.sort(compareTasks);
  result.someday.sort(compareTasks);
  result.overdue.sort(compareTasks);
  // The logbook reads newest-first: it is a record, not a queue.
  result.logbook.sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));

  return result;
}

export interface UpcomingDay<T> {
  /** Local midnight of the day. */
  dayStart: number;
  tasks: T[];
}

/** Group the Upcoming bucket by local day, for a Things-style forecast list. */
export function groupUpcomingByDay<T extends PlannableTask>(
  tasks: readonly T[],
  options: BucketOptions = {},
): UpcomingDay<T>[] {
  const offset = options.utcOffsetMinutes ?? 0;
  const byDay = new Map<number, T[]>();

  for (const task of tasks) {
    const when = task.dueAt ?? task.deferAt;
    if (when == null) continue;
    const day = localDayStart(when, offset);
    const list = byDay.get(day);
    if (list) list.push(task);
    else byDay.set(day, [task]);
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => a - b)
    .map(([dayStart, dayTasks]) => ({ dayStart, tasks: dayTasks.sort(compareTasks) }));
}

/** Counts for the tab badges. */
export function bucketCounts<T extends PlannableTask>(buckets: BucketedTasks<T>): Record<Bucket | 'overdue', number> {
  return {
    today: buckets.today.length,
    upcoming: buckets.upcoming.length,
    anytime: buckets.anytime.length,
    someday: buckets.someday.length,
    logbook: buckets.logbook.length,
    overdue: buckets.overdue.length,
  };
}

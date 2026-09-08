/**
 * Writing shared plans into the phone's own calendar.
 *
 * This is the piece that makes "I write it in the app, it appears in my
 * calendar" true for two people on different platforms with different accounts.
 *
 * It works because both operating systems expose one calendar database that
 * every configured account feeds into:
 *
 *  - on iOS, EventKit lists iCloud (Apple Calendar), plus any Google, Outlook
 *    or Exchange account added in Settings → Calendar → Accounts
 *  - on Android, the Calendar Provider lists the Google accounts on the device
 *
 * So there is no OAuth here and no Google API key. Onur picks his iCloud
 * calendar, Tugce picks her Google one, and the same shared event is written
 * into each — as a real native event that syncs onward through their own
 * accounts and shows up on their Macs, watches and web calendars.
 *
 * The server remembers which native event id belongs to which shared event for
 * which person (see routes/calendar.ts), which is what stops an edit from
 * leaving a duplicate behind.
 */

import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { OrtakApi } from '../api/client.js';

const SETTINGS_KEY = 'ortak:calendar:v1';

export interface CalendarChoice {
  id: string;
  title: string;
  /** "iCloud", "Google (tugce@gmail.com)", "On this phone", … */
  sourceLabel: string;
  color: string;
  isPrimary: boolean;
  allowsModifications: boolean;
}

export interface CalendarSettings {
  /** Native calendar id chosen as the destination for shared events. */
  calendarId: string | null;
  /** Whether new and changed shared events are written automatically. */
  autoMirror: boolean;
  /** Minutes before the start for the alarm, or null for none. */
  defaultReminderMinutes: number | null;
  /**
   * Native calendars whose events are published as busy time, so the other
   * person can see when you are free. Empty means sharing nothing.
   */
  availabilityCalendarIds: string[];
  /**
   * Share event titles as well as times. Off by default — the household needs
   * to know *when* you are busy far more often than with what.
   */
  shareBusyTitles: boolean;
  /** Native reminders list that shared to-dos are copied into, on iOS. */
  reminderListId: string | null;
}

const DEFAULT_SETTINGS: CalendarSettings = {
  calendarId: null,
  autoMirror: true,
  defaultReminderMinutes: 30,
  availabilityCalendarIds: [],
  shareBusyTitles: false,
  reminderListId: null,
};

export async function loadCalendarSettings(): Promise<CalendarSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<CalendarSettings>) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveCalendarSettings(settings: CalendarSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export async function ensureCalendarPermission(): Promise<boolean> {
  const current = await Calendar.getCalendarPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Calendar.requestCalendarPermissionsAsync();
  return asked.granted;
}

/**
 * Turn a native calendar into something recognisable in a picker.
 *
 * The raw values are inconsistent — iOS reports a source type of "CalDAV" for
 * both iCloud and Google, and Android puts the account address in different
 * fields depending on the provider — so this leans on whatever identifies the
 * account to a person.
 */
function describeSource(calendar: Calendar.Calendar): string {
  const sourceName = calendar.source?.name?.trim() ?? '';
  const sourceType = String(calendar.source?.type ?? '').toLowerCase();

  if (Platform.OS === 'android') {
    const account = calendar.ownerAccount ?? sourceName;
    if (account?.includes('@')) return `Google (${account})`;
    if (sourceType.includes('local') || account === 'Local') return 'On this phone';
    return account || 'Calendar';
  }

  if (sourceType.includes('local')) return 'On this phone';
  if (sourceType.includes('subscribed')) return 'Subscribed';
  if (sourceType.includes('birthday')) return 'Birthdays';

  const lower = sourceName.toLowerCase();
  if (lower.includes('icloud')) return 'iCloud (Apple Calendar)';
  if (lower.includes('gmail') || lower.includes('google')) return `Google (${sourceName})`;
  if (lower.includes('exchange') || lower.includes('outlook')) return `Outlook (${sourceName})`;
  return sourceName || 'Calendar';
}

/** Writable calendars on this device, best candidate first. */
export async function listWritableCalendars(): Promise<CalendarChoice[]> {
  if (!(await ensureCalendarPermission())) return [];

  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const writable = calendars.filter((c) => c.allowsModifications);

  return writable
    .map((c) => ({
      id: c.id,
      title: c.title,
      sourceLabel: describeSource(c),
      color: c.color ?? '#6C8AE4',
      isPrimary: Boolean((c as { isPrimary?: boolean }).isPrimary),
      allowsModifications: c.allowsModifications,
    }))
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sourceLabel.localeCompare(b.sourceLabel));
}

/** The calendar to preselect the first time the picker is opened. */
export async function suggestDefaultCalendar(): Promise<string | null> {
  const choices = await listWritableCalendars();
  if (choices.length === 0) return null;

  const primary = choices.find((c) => c.isPrimary);
  if (primary) return primary.id;

  if (Platform.OS === 'ios') {
    try {
      const fallback = await Calendar.getDefaultCalendarAsync();
      if (fallback?.id && choices.some((c) => c.id === fallback.id)) return fallback.id;
    } catch {
      // Not every iOS configuration has a default; fall through to the first.
    }
  }

  return choices[0]?.id ?? null;
}

interface SharedEvent {
  id: string;
  rev: number;
  title: string;
  notes: string | null;
  location: string | null;
  startsAt: number;
  endsAt: number;
  allDay: boolean;
  timezone: string | null;
  reminderMinutes: number | null;
}

function toNativeDetails(
  event: SharedEvent,
  settings: CalendarSettings,
): Partial<Calendar.Event> {
  const reminder = event.reminderMinutes ?? settings.defaultReminderMinutes;

  return {
    title: event.title,
    startDate: new Date(event.startsAt),
    endDate: new Date(event.endsAt),
    allDay: event.allDay,
    location: event.location ?? undefined,
    // A breadcrumb, so it's obvious in Apple Calendar where the entry came from
    // and that editing it there won't reach the other person.
    notes: [event.notes, `— shared in Ortak`].filter(Boolean).join('\n\n'),
    timeZone: event.timezone ?? undefined,
    alarms: reminder != null ? [{ relativeOffset: -Math.abs(reminder) }] : [],
  };
}

export interface MirrorReport {
  created: number;
  updated: number;
  removed: number;
  failed: number;
  /** Set when the run stopped early for a reason worth telling the user about. */
  blocked: 'permission' | 'no-calendar' | null;
}

/**
 * Bring the device calendar in line with the shared calendar.
 *
 * Asks the server what this member's phone still owes, writes it, then reports
 * the native ids back. Safe to run often: the server only returns events whose
 * revision is ahead of what was last mirrored.
 */
export async function mirrorPendingEvents(
  api: OrtakApi,
  settings: CalendarSettings,
): Promise<MirrorReport> {
  const report: MirrorReport = { created: 0, updated: 0, removed: 0, failed: 0, blocked: null };

  if (!(await ensureCalendarPermission())) {
    report.blocked = 'permission';
    return report;
  }
  if (!settings.calendarId) {
    report.blocked = 'no-calendar';
    return report;
  }

  const work = await api.pendingCalendarWork();
  const mirrors: {
    eventId: string;
    calendarId: string;
    externalEventId: string;
    mirroredRev: number;
  }[] = [];

  for (const item of work.create) {
    const event = item.event as unknown as SharedEvent;
    const details = toNativeDetails(event, settings);

    try {
      if (item.existing) {
        // Update in place. If the entry has been deleted from the calendar by
        // hand, updating throws — fall through and create a fresh one rather
        // than silently losing the event.
        try {
          await Calendar.updateEventAsync(item.existing.externalEventId, details);
          mirrors.push({
            eventId: event.id,
            calendarId: item.existing.calendarId,
            externalEventId: item.existing.externalEventId,
            mirroredRev: event.rev,
          });
          report.updated++;
          continue;
        } catch {
          // fall through to create
        }
      }

      const externalEventId = await Calendar.createEventAsync(settings.calendarId, details);
      mirrors.push({
        eventId: event.id,
        calendarId: settings.calendarId,
        externalEventId,
        mirroredRev: event.rev,
      });
      report.created++;
    } catch {
      report.failed++;
    }
  }

  for (const item of work.remove) {
    try {
      await Calendar.deleteEventAsync(item.externalEventId);
      report.removed++;
    } catch {
      // Already gone from the calendar is the outcome we wanted anyway.
      report.removed++;
    }
    try {
      await api.forgetCalendarMirror(item.eventId);
    } catch {
      report.failed++;
    }
  }

  if (mirrors.length > 0) {
    try {
      await api.saveCalendarMirrors(mirrors);
    } catch {
      // The mirrors will simply be offered again next time; the only cost is a
      // repeated update, which is idempotent.
      report.failed += mirrors.length;
    }
  }

  return report;
}

/** Open one mirrored event in the system calendar app. */
export async function openInDeviceCalendar(externalEventId: string): Promise<void> {
  try {
    await Calendar.openEventInCalendarAsync({ id: externalEventId });
  } catch {
    // Not fatal — the event is still in their calendar.
  }
}

// ---------------------------------------------------------------------------
// Reading the device calendars — the other half of two-way sync
// ---------------------------------------------------------------------------

export interface DeviceBusyBlock {
  startsAt: number;
  endsAt: number;
  allDay: boolean;
  label: string | null;
  sourceCalendarId: string;
  externalId: string;
}

/**
 * Read a window of this phone's own calendars as busy time.
 *
 * Only the calendars the member picked in settings are read, and titles are
 * left out unless they opted in — the app should be able to say "Tugce is busy
 * Tuesday afternoon" without shipping her whole work diary to the server.
 *
 * All-day entries are reported but flagged, because a birthday is not a reason
 * to call someone unavailable all evening.
 */
export async function readDeviceBusy(
  settings: CalendarSettings,
  from: number,
  to: number,
): Promise<DeviceBusyBlock[]> {
  if (settings.availabilityCalendarIds.length === 0) return [];
  if (!(await ensureCalendarPermission())) return [];

  // A calendar that has since been deleted or un-shared would throw.
  const available = new Set((await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT)).map((c) => c.id));
  const ids = settings.availabilityCalendarIds.filter((id) => available.has(id));
  if (ids.length === 0) return [];

  let events: Calendar.Event[];
  try {
    events = await Calendar.getEventsAsync(ids, new Date(from), new Date(to));
  } catch {
    return [];
  }

  const blocks: DeviceBusyBlock[] = [];
  for (const event of events) {
    const startsAt = new Date(event.startDate as string | Date).getTime();
    const endsAt = new Date(event.endDate as string | Date).getTime();
    if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || endsAt <= startsAt) continue;

    // Declining a meeting does not make you busy.
    const status = String((event as { status?: unknown }).status ?? '').toLowerCase();
    if (status === 'canceled' || status === 'cancelled') continue;

    // An event marked "free" in the calendar is exactly that.
    const availability = String((event as { availability?: unknown }).availability ?? '').toLowerCase();
    if (availability === 'free') continue;

    blocks.push({
      startsAt,
      endsAt,
      allDay: Boolean(event.allDay),
      label: settings.shareBusyTitles ? (event.title ?? null) : null,
      sourceCalendarId: String(event.calendarId ?? ''),
      externalId: String(event.id ?? `${startsAt}-${endsAt}`),
    });
  }

  return blocks;
}

export interface PublishReport {
  published: number;
  changed: number;
  removed: number;
  blocked: 'permission' | 'not-sharing' | null;
}

/** How far ahead availability is published. Two months covers any real planning. */
const AVAILABILITY_WINDOW_DAYS = 60;

/**
 * Read this phone's calendars and tell the server what they say.
 *
 * Safe and cheap to call often: the server only records what actually changed,
 * so a republish of an unchanged calendar does not wake the other phone.
 */
export async function publishAvailability(
  api: OrtakApi,
  settings: CalendarSettings,
  now = Date.now(),
): Promise<PublishReport> {
  const report: PublishReport = { published: 0, changed: 0, removed: 0, blocked: null };

  if (settings.availabilityCalendarIds.length === 0) {
    report.blocked = 'not-sharing';
    return report;
  }
  if (!(await ensureCalendarPermission())) {
    report.blocked = 'permission';
    return report;
  }

  // Start slightly in the past so an event running right now still counts.
  const windowStart = now - 24 * 3600_000;
  const windowEnd = now + AVAILABILITY_WINDOW_DAYS * 24 * 3600_000;

  const blocks = await readDeviceBusy(settings, windowStart, windowEnd);

  try {
    const result = await api.publishAvailability({ windowStart, windowEnd, blocks });
    report.published = result.published;
    report.changed = result.changed;
    report.removed = result.removed;
  } catch {
    // Offline: the next run will catch up.
  }

  return report;
}

// ---------------------------------------------------------------------------
// Apple Reminders
// ---------------------------------------------------------------------------

/**
 * Copying shared to-dos into Apple Reminders.
 *
 * The survey's recommendation, and a sound one: Apple Notes has no API, but
 * Reminders is part of EventKit and fully writable. So the "my tasks show up in
 * the app Apple gives me" experience is reachable — through Reminders, not Notes.
 *
 * iOS only. Android has no equivalent system list (Google Tasks needs OAuth and
 * a server-side integration), so this is a no-op there.
 */
export function remindersSupported(): boolean {
  return Platform.OS === 'ios';
}

export interface ReminderList {
  id: string;
  title: string;
  sourceLabel: string;
}

export async function listReminderLists(): Promise<ReminderList[]> {
  if (!remindersSupported()) return [];

  const permission = await Calendar.requestRemindersPermissionsAsync();
  if (!permission.granted) return [];

  try {
    const lists = await Calendar.getCalendarsAsync(Calendar.EntityTypes.REMINDER);
    return lists
      .filter((c) => c.allowsModifications)
      .map((c) => ({ id: c.id, title: c.title, sourceLabel: describeSource(c) }));
  } catch {
    return [];
  }
}

export interface MirrorableTask {
  id: string;
  title: string;
  notes?: string | null;
  dueAt?: number | null;
  done: boolean;
}

export interface ReminderReport {
  created: number;
  updated: number;
  completed: number;
  failed: number;
  /** Ortak task id → native reminder id, to be stored by the caller. */
  mirrors: Record<string, string>;
  blocked: 'unsupported' | 'permission' | 'no-list' | null;
}

/**
 * Push shared to-dos into a Reminders list.
 *
 * `known` maps Ortak task ids to reminder ids from previous runs, so an edit
 * updates the existing reminder rather than adding a second one. Ticking a task
 * off in Ortak completes the reminder; this does not read changes back, because
 * a two-way merge between two independent to-do stores is a much bigger promise
 * than it looks and is not one this makes.
 */
export async function mirrorTasksToReminders(
  tasks: readonly MirrorableTask[],
  settings: CalendarSettings,
  known: Record<string, string> = {},
): Promise<ReminderReport> {
  const report: ReminderReport = {
    created: 0,
    updated: 0,
    completed: 0,
    failed: 0,
    mirrors: { ...known },
    blocked: null,
  };

  if (!remindersSupported()) {
    report.blocked = 'unsupported';
    return report;
  }
  if (!settings.reminderListId) {
    report.blocked = 'no-list';
    return report;
  }

  const permission = await Calendar.requestRemindersPermissionsAsync();
  if (!permission.granted) {
    report.blocked = 'permission';
    return report;
  }

  for (const task of tasks) {
    const existingId = known[task.id];
    const details = {
      title: task.title,
      notes: task.notes ?? undefined,
      dueDate: task.dueAt ? new Date(task.dueAt) : undefined,
      completed: task.done,
    };

    try {
      if (existingId) {
        await Calendar.updateReminderAsync(existingId, details);
        if (task.done) report.completed++;
        else report.updated++;
        continue;
      }

      // Nothing is gained by creating a reminder for something already done.
      if (task.done) continue;

      const reminderId = await Calendar.createReminderAsync(settings.reminderListId, details);
      report.mirrors[task.id] = reminderId;
      report.created++;
    } catch {
      // A reminder deleted by hand in the Reminders app makes the update throw;
      // drop the stale mapping so the next run recreates it.
      if (existingId) delete report.mirrors[task.id];
      report.failed++;
    }
  }

  return report;
}

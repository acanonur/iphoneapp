/**
 * Copying shared to-dos into Apple Reminders.
 *
 * The market survey's advice, and it is right: Apple Notes has no API, but
 * Reminders is EventKit and fully writable. So "my shared to-dos show up in the
 * app Apple gave me — and in Siri, and on my watch" is reachable, just through
 * Reminders rather than Notes.
 *
 * Deliberately one-way. Reading changes back would mean merging two independent
 * to-do stores with their own edits and deletions, which is a much larger
 * promise than it looks and not one this makes: Ortak stays the shared original.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore, selectAll } from '../store/useStore.js';
import {
  loadCalendarSettings,
  mirrorTasksToReminders,
  remindersSupported,
  type ReminderReport,
} from './deviceCalendar.js';
import type { TaskItem } from '../../../shared/src/types.js';

/** Ortak task id → native reminder id, kept per device. */
const MIRROR_KEY = 'ortak:reminders:v1';

/** Don't touch EventKit more often than this, however often tasks change. */
const MIN_INTERVAL_MS = 60_000;

async function loadMirrors(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(MIRROR_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

async function saveMirrors(mirrors: Record<string, string>): Promise<void> {
  try {
    await AsyncStorage.setItem(MIRROR_KEY, JSON.stringify(mirrors));
  } catch {
    // Losing the map only means the next run recreates the reminders.
  }
}

export function useReminderMirror(): { lastReport: ReminderReport | null; mirrorNow: () => Promise<void> } {
  // Subscribe to the two values that should drive a run, not to the whole
  // store. `useStore()` re-renders on every state change, and `selectAll`
  // returns a fresh array each time, so `run` was a new function on every
  // render and the effect below re-fired on every render with it.
  const status = useStore((s) => s.status);
  const rev = useStore((s) => s.rev);
  const [lastReport, setLastReport] = useState<ReminderReport | null>(null);
  const lastRunAt = useRef(0);
  const running = useRef(false);

  const run = useCallback(
    async (force = false) => {
      if (!remindersSupported() || running.current) return;
      if (!force && Date.now() - lastRunAt.current < MIN_INTERVAL_MS) return;

      // Claim the slot *before* the first await. Setting it afterwards let two
      // callers past the guard together, and two concurrent passes over the
      // same task list write the same reminder twice.
      running.current = true;

      try {
        const settings = await loadCalendarSettings();
        if (!settings.reminderListId) return;

        // Stamped once there is real work to do, so a run that stops here does
        // not put the next one on a minute's cooldown.
        lastRunAt.current = Date.now();

        const known = await loadMirrors();
        // Read the tasks when the run actually happens rather than closing over
        // the array this render produced.
        const live = selectAll<TaskItem>(useStore.getState(), 'tasks').filter((t) => !t.deleted);

        const report = await mirrorTasksToReminders(
          live.map((t) => ({
            id: t.id,
            title: t.title,
            notes: t.notes,
            dueAt: t.dueAt,
            done: t.done,
          })),
          settings,
          known,
        );

        // Tasks deleted in Ortak leave their reminder behind on purpose —
        // silently removing something from a person's Reminders list is worse
        // than leaving one stale entry they can tick off themselves.
        await saveMirrors(report.mirrors);
        setLastReport(report);
      } finally {
        running.current = false;
      }
    },
    [],
  );

  useEffect(() => {
    if (status !== 'ready') return;
    void run();
  }, [run, status, rev]);

  return { lastReport, mirrorNow: () => run(true) };
}

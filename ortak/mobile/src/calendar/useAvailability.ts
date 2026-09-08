/**
 * Keeping the household's view of everyone's availability up to date.
 *
 * Busy blocks are ordinary synced records, so *reading* them needs nothing
 * special — both phones already hold each other's. This hook handles the other
 * direction: publishing what this phone's own calendars say, on a timer and
 * whenever the app comes back to the foreground, because a calendar changes
 * without the app ever being told.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useStore, selectAll } from '../store/useStore.js';
import { loadCalendarSettings, publishAvailability, type PublishReport } from './deviceCalendar.js';
import type { BusyInterval } from '../../../shared/src/availability.js';
import type { BusyBlock } from '../../../shared/src/types.js';

/** How often to re-read the device calendars while the app is open. */
const REFRESH_MS = 30 * 60_000;
/** Don't re-publish more often than this, however many times we're woken. */
const MIN_INTERVAL_MS = 5 * 60_000;

export function useAvailabilityPublisher(): { lastReport: PublishReport | null; publishNow: () => Promise<void> } {
  const online = useStore((s) => s.online);
  const status = useStore((s) => s.status);
  const api = useStore((s) => s.api());
  const [lastReport, setLastReport] = useState<PublishReport | null>(null);
  const lastRunAt = useRef(0);

  const run = useCallback(
    async (force = false) => {
      if (status !== 'ready') return;
      if (!force && Date.now() - lastRunAt.current < MIN_INTERVAL_MS) return;
      lastRunAt.current = Date.now();

      const settings = await loadCalendarSettings();
      if (settings.availabilityCalendarIds.length === 0) return;

      const report = await publishAvailability(api, settings);
      setLastReport(report);

      // Only pull when something actually moved; the server tells us that.
      if (report.changed > 0 || report.removed > 0) {
        void useStore.getState().sync({ force: true });
      }
    },
    [api, status],
  );

  useEffect(() => {
    if (status !== 'ready' || !online) return undefined;

    void run(true);
    const timer = setInterval(() => void run(), REFRESH_MS);

    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') void run();
    });

    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [run, status, online]);

  return { lastReport, publishNow: () => run(true) };
}

/** Everyone's busy time, in the shape the availability helpers expect. */
export function useBusyIntervals(): BusyInterval[] {
  const blocks = useStore((s) => s.entities.busyBlocks);

  return Object.values(blocks)
    .filter((b) => !b.deleted)
    .map((b) => {
      const block = b as unknown as BusyBlock;
      return {
        ownerId: block.ownerId,
        startsAt: block.startsAt,
        endsAt: block.endsAt,
        label: block.label,
      };
    });
}

/** Busy time excluding all-day entries, which do not make an evening unavailable. */
export function useTimedBusyIntervals(): BusyInterval[] {
  const store = useStore();
  return selectAll<BusyBlock>(store, 'busyBlocks')
    .filter((b) => !b.allDay)
    .map((b) => ({ ownerId: b.ownerId, startsAt: b.startsAt, endsAt: b.endsAt, label: b.label }));
}

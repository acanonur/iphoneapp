/**
 * The shared calendar, and the controls for pushing it into the phone's own
 * calendar app.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useStore, selectAll, memberColor, memberName } from '../../src/store/useStore.js';
import { newId } from '../../src/util/id.js';
import { parseQuickAdd } from '../../../shared/src/datetime.js';
import type { EventItem } from '../../../shared/src/types.js';
import {
  loadCalendarSettings,
  mirrorPendingEvents,
  type CalendarSettings,
  type MirrorReport,
} from '../../src/calendar/deviceCalendar.js';
import { Avatar, Button, Card, Field, Muted, Row } from '../../src/ui/components.js';
import { colors, clockTime, relativeDay, spacing, typography } from '../../src/ui/theme.js';

export default function CalendarScreen() {
  const store = useStore();
  // The client is a module-level singleton, so this reference is stable across
  // renders — unlike `store` itself, which is a new object after every change
  // and would re-trigger the mirroring effect on every sync tick.
  const api = useStore((s) => s.api());
  const [draft, setDraft] = useState('');
  const [settings, setSettings] = useState<CalendarSettings | null>(null);
  const [mirroring, setMirroring] = useState(false);
  const [lastReport, setLastReport] = useState<MirrorReport | null>(null);

  const now = Date.now();
  const utcOffsetMinutes = -new Date().getTimezoneOffset();

  const events = selectAll<EventItem>(store, 'events');

  useFocusEffect(
    useCallback(() => {
      void loadCalendarSettings().then(setSettings);
    }, []),
  );

  /**
   * Push new and changed events into the device calendar whenever this screen
   * is shown and the shared calendar has moved on.
   */
  useEffect(() => {
    if (!settings?.autoMirror || !settings.calendarId || !store.online) return;
    let cancelled = false;

    void (async () => {
      const report = await mirrorPendingEvents(api, settings);
      if (!cancelled && (report.created || report.updated || report.removed)) {
        setLastReport(report);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [settings, store.rev, store.online, api]);

  const upcoming = useMemo(
    () => events.filter((e) => e.endsAt >= now - 12 * 3600_000).sort((a, b) => a.startsAt - b.startsAt),
    [events, now],
  );

  const grouped = useMemo(() => {
    const buckets = new Map<string, EventItem[]>();
    for (const event of upcoming) {
      const key = relativeDay(event.startsAt);
      const list = buckets.get(key);
      if (list) list.push(event);
      else buckets.set(key, [event]);
    }
    return [...buckets.entries()];
  }, [upcoming]);

  const preview = useMemo(
    () => (draft.trim() ? parseQuickAdd(draft, { now, utcOffsetMinutes }) : null),
    [draft, now, utcOffsetMinutes],
  );

  function addEvent() {
    const text = draft.trim();
    if (!text) return;
    const parsed = parseQuickAdd(text, { now, utcOffsetMinutes });
    const startsAt = parsed.startsAt ?? now + 3600_000;

    store.upsert('events', {
      id: newId('ev'),
      title: parsed.title || text,
      notes: null,
      location: parsed.location,
      startsAt,
      endsAt: parsed.endsAt ?? startsAt + 3600_000,
      allDay: parsed.allDay,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
      reminderMinutes: parsed.allDay ? null : (settings?.defaultReminderMinutes ?? 30),
      color: null,
    });
    setDraft('');
  }

  async function mirrorNow() {
    if (!settings) return;
    setMirroring(true);
    const report = await mirrorPendingEvents(api, settings);
    setMirroring(false);
    setLastReport(report);

    if (report.blocked === 'permission') {
      Alert.alert(
        'Calendar access needed',
        'Ortak needs permission to write to your calendar. Turn it on in your phone’s settings, then try again.',
      );
    } else if (report.blocked === 'no-calendar') {
      Alert.alert(
        'Pick a calendar first',
        'Choose which calendar shared plans should go into, in Settings → Calendar.',
      );
    } else {
      const total = report.created + report.updated + report.removed;
      Alert.alert(
        'Calendar updated',
        total === 0
          ? 'Your calendar was already up to date.'
          : `${report.created} added, ${report.updated} updated, ${report.removed} removed.`,
      );
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['left', 'right']}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl * 2 }}
        keyboardShouldPersistTaps="handled"
      >
        <Field
          placeholder="dinner with Tugce friday 8pm @ Trattoria"
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={addEvent}
          returnKeyType="done"
          hint={
            preview?.startsAt
              ? `${preview.title || 'Event'} · ${relativeDay(preview.startsAt)}${
                  preview.allDay ? ' (all day)' : ` ${clockTime(preview.startsAt)}–${clockTime(preview.endsAt ?? preview.startsAt)}`
                }${preview.location ? ` · ${preview.location}` : ''}`
              : 'Type it the way you’d say it — English, Türkçe or Deutsch.'
          }
        />

        <MirrorStatus settings={settings} report={lastReport} busy={mirroring} onPress={() => void mirrorNow()} />

        {grouped.length === 0 ? (
          <Card>
            <Muted>Nothing planned yet. Add something above and it lands in both your calendars.</Muted>
          </Card>
        ) : (
          grouped.map(([day, dayEvents]) => (
            <View key={day} style={{ marginTop: spacing.lg }}>
              <Text style={[typography.subheading, { marginBottom: spacing.sm }]}>{day}</Text>
              {dayEvents.map((event) => (
                <EventRow key={event.id} event={event} />
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function MirrorStatus({
  settings,
  report,
  busy,
  onPress,
}: {
  settings: CalendarSettings | null;
  report: MirrorReport | null;
  busy: boolean;
  onPress: () => void;
}) {
  if (!settings) return null;

  if (!settings.calendarId) {
    return (
      <Card style={{ borderColor: colors.warning }}>
        <Text style={[typography.body, { marginBottom: spacing.sm }]}>
          Shared plans aren’t going into your phone’s calendar yet.
        </Text>
        <Muted>Pick a calendar in Settings → Calendar to turn that on.</Muted>
      </Card>
    );
  }

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Text style={typography.small}>
            {settings.autoMirror
              ? 'Shared plans are copied into your calendar automatically.'
              : 'Automatic copying is off.'}
          </Text>
          {report && report.created + report.updated + report.removed > 0 ? (
            <Text style={typography.tiny}>
              Last run: {report.created} added, {report.updated} updated, {report.removed} removed
            </Text>
          ) : null}
        </View>
        <Button label={busy ? 'Syncing' : 'Sync now'} variant="ghost" onPress={onPress} busy={busy} />
      </Row>
    </Card>
  );
}

function EventRow({ event }: { event: EventItem }) {
  const store = useStore();
  const [expanded, setExpanded] = useState(false);

  return (
    <Card onPress={() => setExpanded((v) => !v)}>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Text style={typography.subheading} numberOfLines={expanded ? undefined : 1}>
            {event.title}
          </Text>
          <Muted>
            {event.allDay
              ? 'All day'
              : `${clockTime(event.startsAt)} – ${clockTime(event.endsAt)}`}
            {event.location ? ` · ${event.location}` : ''}
          </Muted>
        </View>
        <Avatar
          name={memberName(store, event.createdBy) || '?'}
          color={memberColor(store, event.createdBy)}
          size={24}
        />
      </Row>

      {expanded ? (
        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          {event.notes ? <Text style={typography.body}>{event.notes}</Text> : null}
          <Row>
            <Pressable
              onPress={() =>
                Alert.alert('Remove from the shared calendar?', event.title, [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Remove',
                    style: 'destructive',
                    // The tombstone also tells both phones to delete the copy
                    // they put in their own calendars.
                    onPress: () => store.remove('events', event.id),
                  },
                ])
              }
              hitSlop={8}
            >
              <Text style={{ color: colors.danger, fontSize: 13, fontWeight: '600' }}>Remove</Text>
            </Pressable>
          </Row>
        </View>
      ) : null}
    </Card>
  );
}

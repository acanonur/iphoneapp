/**
 * The shared calendar, and the controls for pushing it into the phone's own
 * calendar app.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
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
import { Avatar, Button, Card, Chip, Field, Muted, Row } from '../../src/ui/components.js';
import { colors, clockTime, relativeDay, spacing, typography } from '../../src/ui/theme.js';

/** The contexts a Fantastical-style calendar set can filter to. */
const DEFAULT_SETS = ['Ev', 'Work', 'Family'];

export default function CalendarScreen() {
  const { suggestStart } = useLocalSearchParams<{ suggestStart?: string }>();
  const store = useStore();
  // The client is a module-level singleton, so this reference is stable across
  // renders — unlike `store` itself, which is a new object after every change
  // and would re-trigger the mirroring effect on every sync tick.
  const api = useStore((s) => s.api());
  const [draft, setDraft] = useState('');
  const [settings, setSettings] = useState<CalendarSettings | null>(null);
  const [mirroring, setMirroring] = useState(false);
  const [lastReport, setLastReport] = useState<MirrorReport | null>(null);
  const [activeSet, setActiveSet] = useState<string | null>(null);
  const [draftSet, setDraftSet] = useState<string | null>(null);

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

  /** Every context in use, so the filter row reflects reality rather than a guess. */
  const sets = useMemo(() => {
    const used = new Set(events.map((e) => e.calendarSet).filter((s): s is string => Boolean(s)));
    return [...new Set([...used, ...DEFAULT_SETS])];
  }, [events]);

  const upcoming = useMemo(
    () =>
      events
        .filter((e) => e.endsAt >= now - 12 * 3600_000)
        .filter((e) => !activeSet || e.calendarSet === activeSet)
        .sort((a, b) => a.startsAt - b.startsAt),
    [events, now, activeSet],
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
    // Coming from a tapped gap on the timeline, the slot is already chosen.
    const suggested = suggestStart ? Number(suggestStart) : null;
    const startsAt = parsed.startsAt ?? (suggested && suggested > now ? suggested : now + 3600_000);

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
      calendarSet: draftSet ?? activeSet,
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

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
          <Row gap={spacing.xs}>
            <Chip label="Everything" selected={!activeSet} onPress={() => setActiveSet(null)} />
            {sets.map((name) => (
              <Chip
                key={name}
                label={name}
                selected={activeSet === name}
                onPress={() => {
                  const next = activeSet === name ? null : name;
                  setActiveSet(next);
                  // Adding while a context is filtered should file it there.
                  setDraftSet(next);
                }}
              />
            ))}
          </Row>
        </ScrollView>

        <FindATime />

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

/**
 * "When can we both do this?"
 *
 * Fantastical sells Openings as a booking link for other people; for a
 * household the useful shape is the same question asked inward — propose times
 * that work for everyone here, from what their real calendars say. The answer
 * comes from the server, which holds both people's published availability.
 */
function FindATime() {
  const store = useStore();
  const api = useStore((s) => s.api());

  const [open, setOpen] = useState(false);
  const [duration, setDuration] = useState(60);
  const [evenings, setEvenings] = useState(true);
  const [slots, setSlots] = useState<{ startsAt: number; endsAt: number }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');

  const utcOffsetMinutes = -new Date().getTimezoneOffset();

  async function search() {
    setBusy(true);
    setSlots(null);
    try {
      const from = Date.now();
      const result = await api.findSlots({
        from,
        to: from + 21 * 24 * 3600_000,
        durationMinutes: duration,
        utcOffsetMinutes,
        dayStartMinutes: evenings ? 18 * 60 : 9 * 60,
        dayEndMinutes: evenings ? 22 * 60 : 21 * 60,
        maxResults: 6,
      });
      setSlots(result.slots);
    } catch {
      setSlots([]);
    } finally {
      setBusy(false);
    }
  }

  function book(slot: { startsAt: number; endsAt: number }) {
    store.upsert('events', {
      id: newId('ev'),
      title: title.trim() || 'Us',
      notes: null,
      location: null,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      allDay: false,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
      reminderMinutes: 30,
      color: null,
      calendarSet: null,
    });
    setSlots(null);
    setTitle('');
    setOpen(false);
  }

  if (!open) {
    return (
      <Button
        label="Find a time for us"
        variant="secondary"
        onPress={() => setOpen(true)}
        style={{ marginBottom: spacing.md }}
      />
    );
  }

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between', marginBottom: spacing.sm }}>
        <Text style={typography.subheading}>Find a time for us</Text>
        <Pressable onPress={() => setOpen(false)} hitSlop={8}>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>Close</Text>
        </Pressable>
      </Row>

      <Muted>
        Looks at both your calendars over the next three weeks and suggests when you are both
        actually free.
      </Muted>

      <Row style={{ flexWrap: 'wrap', marginTop: spacing.md }} gap={spacing.xs}>
        {[30, 60, 90, 120].map((minutes) => (
          <Chip
            key={minutes}
            label={minutes >= 60 ? `${minutes / 60}h` : `${minutes}m`}
            selected={duration === minutes}
            onPress={() => setDuration(minutes)}
          />
        ))}
        <Chip label="Evenings" selected={evenings} onPress={() => setEvenings(true)} />
        <Chip label="Daytime" selected={!evenings} onPress={() => setEvenings(false)} />
      </Row>

      <Button
        label="Search"
        onPress={() => void search()}
        busy={busy}
        style={{ marginTop: spacing.md }}
      />

      {busy ? <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.md }} /> : null}

      {slots !== null ? (
        slots.length === 0 ? (
          <Muted>
            No shared gaps found. Either nobody has shared a calendar yet (Settings → Calendar) or
            you are both genuinely booked.
          </Muted>
        ) : (
          <View style={{ marginTop: spacing.md }}>
            <Field
              placeholder="What is it? (optional)"
              value={title}
              onChangeText={setTitle}
              style={{ marginBottom: spacing.sm }}
            />
            {slots.map((slot) => (
              <Card key={slot.startsAt} onPress={() => book(slot)}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text style={typography.body}>{relativeDay(slot.startsAt)}</Text>
                  <Text style={typography.small}>
                    {clockTime(slot.startsAt)}–{clockTime(slot.endsAt)}
                  </Text>
                </Row>
              </Card>
            ))}
            <Muted>Tap one to put it in both calendars.</Muted>
          </View>
        )
      ) : null}
    </Card>
  );
}

/**
 * The shared calendar, in Modernist.
 *
 * Days are ruled sections rather than cards: an uppercase day heading with the
 * date at the right, a 2px rule, then one hairline-separated row per plan. Each
 * row is a three-column grid — time, title, the square of whoever added it —
 * so the times form a column you can read straight down.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
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
import {
  Button,
  Card,
  Field,
  Kicker,
  MemberSquare,
  Muted,
  Row,
  Rule,
  ScreenHeader,
  Seg,
  TextTabs,
} from '../../src/ui/components.js';
import {
  RefreshIcon,
  SearchIcon,
  TrashIcon,
  UsersIcon,
} from '../../src/ui/icons.js';
import {
  colors,
  clockTime,
  fonts,
  relativeDay,
  rules,
  shortDate,
  spacing,
  typography,
} from '../../src/ui/theme.js';

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
  const [activeSet, setActiveSet] = useState<string>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const now = Date.now();
  const utcOffsetMinutes = -new Date().getTimezoneOffset();

  const events = selectAll<EventItem>(store, 'events');

  useFocusEffect(
    useCallback(() => {
      void loadCalendarSettings().then(setSettings);
    }, []),
  );

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
  const setTabs = useMemo(() => {
    const used = new Set(events.map((e) => e.calendarSet).filter((s): s is string => Boolean(s)));
    const names = [...new Set([...used, ...DEFAULT_SETS])];
    return [{ value: 'all', label: 'Everything' }, ...names.map((n) => ({ value: n, label: n }))];
  }, [events]);

  const upcoming = useMemo(
    () =>
      events
        .filter((e) => e.endsAt >= now - 12 * 3600_000)
        .filter((e) => activeSet === 'all' || e.calendarSet === activeSet)
        .sort((a, b) => a.startsAt - b.startsAt),
    [events, now, activeSet],
  );

  const grouped = useMemo(() => {
    const buckets = new Map<string, { date: string; events: EventItem[] }>();
    for (const event of upcoming) {
      const key = relativeDay(event.startsAt);
      const bucket = buckets.get(key);
      if (bucket) bucket.events.push(event);
      else buckets.set(key, { date: shortDate(event.startsAt), events: [event] });
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
      calendarSet: activeSet === 'all' ? null : activeSet,
    });
    setDraft('');
  }

  async function mirrorNow() {
    if (!settings) return;
    setMirroring(true);
    const report = await mirrorPendingEvents(api, settings);
    setMirroring(false);
    setLastReport(report);
  }

  const syncNote = !settings?.calendarId
    ? 'No calendar chosen yet — Settings → Calendar.'
    : lastReport && lastReport.created + lastReport.updated + lastReport.removed > 0
      ? `Last run: ${lastReport.created} added, ${lastReport.updated} updated, ${lastReport.removed} removed`
      : settings.autoMirror
        ? 'Up to date.'
        : 'Automatic copying is off.';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'left', 'right']}>
      <ScreenHeader
        title="Calendar"
        members={store.members.map((m) => ({ id: m.id, name: m.name, color: m.color }))}
      />

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
        keyboardShouldPersistTaps="handled"
      >
        <Field
          label="Add to the shared calendar"
          placeholder="dinner with Tugce friday 8pm @ Trattoria"
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={addEvent}
          returnKeyType="done"
          hint={
            preview?.startsAt
              ? `${preview.title || 'Event'} · ${relativeDay(preview.startsAt)}${
                  preview.allDay
                    ? ' (all day)'
                    : ` ${clockTime(preview.startsAt)}–${clockTime(preview.endsAt ?? preview.startsAt)}`
                }${preview.location ? ` · ${preview.location}` : ''}`
              : 'Type it the way you’d say it — English, Türkçe or Deutsch.'
          }
          style={{ marginBottom: 0 }}
        />

        <TextTabs tabs={setTabs} value={activeSet} onChange={setActiveSet} />

        <FindATime />

        <Card style={{ marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={typography.body}>Shared plans are copied into your calendar automatically.</Text>
            <Text style={typography.tiny}>{syncNote}</Text>
          </View>
          <Button
            label={mirroring ? 'Syncing' : 'Sync now'}
            variant="ghost"
            busy={mirroring}
            onPress={() => void mirrorNow()}
            icon={<RefreshIcon size={14} color={colors.accent} />}
            style={{ minHeight: 36 }}
          />
        </Card>

        {grouped.length === 0 ? (
          <Text style={[typography.small, { marginTop: spacing.xl }]}>
            Nothing planned yet. Add something above and it lands in both your calendars.
          </Text>
        ) : (
          grouped.map(([day, group]) => (
            <View key={day} style={{ marginTop: spacing.xl }}>
              <View style={styles.dayHead}>
                <Kicker>{day}</Kicker>
                <Text style={typography.tiny}>{group.date}</Text>
              </View>
              <Rule />
              {group.events.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  expanded={expanded === event.id}
                  onToggle={() => setExpanded(expanded === event.id ? null : event.id)}
                />
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function EventRow({
  event,
  expanded,
  onToggle,
}: {
  event: EventItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  const store = useStore();

  return (
    <Pressable onPress={onToggle} style={styles.eventRow}>
      <View style={{ width: 56 }}>
        {event.allDay ? (
          <Text style={styles.timeStart}>All day</Text>
        ) : (
          <>
            <Text style={styles.timeStart}>{clockTime(event.startsAt)}</Text>
            <Text style={typography.tiny}>{clockTime(event.endsAt)}</Text>
          </>
        )}
      </View>

      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={styles.eventTitle} numberOfLines={expanded ? undefined : 1}>
          {event.title}
        </Text>
        {event.location ? <Text style={typography.tiny}>{event.location}</Text> : null}

        {expanded ? (
          <View style={{ marginTop: spacing.sm, gap: spacing.sm, alignItems: 'flex-start' }}>
            {event.notes ? <Text style={typography.body}>{event.notes}</Text> : null}
            <Button
              label="Remove from the shared calendar"
              variant="ghost"
              onPress={() => store.remove('events', event.id)}
              icon={<TrashIcon size={13} color={colors.accent700} />}
              style={{ minHeight: 32 }}
            />
          </View>
        ) : null}
      </View>

      <MemberSquare
        name={memberName(store, event.createdBy) || '?'}
        color={memberColor(store, event.createdBy)}
        size={20}
      />
    </Pressable>
  );
}

/**
 * "When can we both do this?" — Fantastical's Openings, read inward.
 *
 * Closed it is a single flush-left secondary button; open it is a surface panel
 * with two segmented controls and a ruled list of proposed slots.
 */
function FindATime() {
  const store = useStore();
  const api = useStore((s) => s.api());

  const [open, setOpen] = useState(false);
  const [duration, setDuration] = useState<'30' | '60' | '90' | '120'>('60');
  const [when, setWhen] = useState<'evenings' | 'daytime'>('evenings');
  const [slots, setSlots] = useState<{ startsAt: number; endsAt: number }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');

  const utcOffsetMinutes = -new Date().getTimezoneOffset();

  async function search() {
    setBusy(true);
    setSlots(null);
    try {
      const from = Date.now();
      const evenings = when === 'evenings';
      const result = await api.findSlots({
        from,
        to: from + 21 * 24 * 3600_000,
        durationMinutes: Number(duration),
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
        block
        onPress={() => setOpen(true)}
        icon={<UsersIcon size={16} color={colors.text} />}
        style={{ marginTop: spacing.lg }}
      />
    );
  }

  return (
    <Card style={{ marginTop: spacing.lg, gap: 10 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={typography.subheading}>Find a time for us</Text>
        <Button label="Close" variant="ghost" onPress={() => setOpen(false)} style={{ minHeight: 32 }} />
      </Row>

      <Text style={typography.small}>
        Looks at both your calendars over the next three weeks and suggests when you are both
        actually free.
      </Text>

      <Row gap={spacing.md} style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <View style={{ gap: 4 }}>
          <Text style={typography.tiny}>How long</Text>
          <Seg
            options={[
              { value: '30', label: '30m' },
              { value: '60', label: '1h' },
              { value: '90', label: '1.5h' },
              { value: '120', label: '2h' },
            ]}
            value={duration}
            onChange={setDuration}
          />
        </View>
        <View style={{ gap: 4 }}>
          <Text style={typography.tiny}>When</Text>
          <Seg
            options={[
              { value: 'evenings', label: 'Evenings' },
              { value: 'daytime', label: 'Daytime' },
            ]}
            value={when}
            onChange={setWhen}
          />
        </View>
      </Row>

      <Button
        label={busy ? 'Searching…' : 'Search'}
        block
        busy={busy}
        onPress={() => void search()}
        icon={<SearchIcon size={14} color={colors.bg} />}
      />

      {busy ? <ActivityIndicator color={colors.accent} /> : null}

      {slots !== null ? (
        slots.length === 0 ? (
          <Text style={typography.small}>
            No shared gaps found. Either nobody has shared a calendar yet (Settings → Calendar) or
            you are both genuinely booked.
          </Text>
        ) : (
          <View>
            <Field
              placeholder="What is it? (optional)"
              value={title}
              onChangeText={setTitle}
              style={{ minHeight: 40 }}
            />
            {slots.map((slot) => (
              <Pressable key={slot.startsAt} onPress={() => book(slot)} style={styles.slotRow}>
                <Text style={{ fontFamily: fonts.headingSemi, fontSize: 14, color: colors.text }}>
                  {relativeDay(slot.startsAt)}
                </Text>
                <Text style={typography.small}>
                  {clockTime(slot.startsAt)}–{clockTime(slot.endsAt)}
                </Text>
              </Pressable>
            ))}
            <Muted>Tap one to put it in both calendars.</Muted>
          </View>
        )
      ) : null}
    </Card>
  );
}

const styles = {
  dayHead: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'baseline' as const,
    paddingBottom: 6,
  },
  eventRow: {
    flexDirection: 'row' as const,
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: rules.row,
    borderBottomColor: colors.dividerSoft,
  },
  timeStart: {
    fontFamily: fonts.headingSemi,
    fontSize: 13,
    lineHeight: 17,
    color: colors.text,
  },
  eventTitle: {
    fontFamily: fonts.headingSemi,
    fontSize: 15,
    lineHeight: 20,
    color: colors.text,
  },
  slotRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
    paddingVertical: 10,
    borderTopWidth: rules.row,
    borderTopColor: colors.dividerSoft,
  },
};

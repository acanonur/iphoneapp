/**
 * The screen the app opens on: what is happening today, what is outstanding,
 * and one box that can create almost anything.
 */

import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore, selectAll, memberColor, pendingCount } from '../../src/store/useStore.js';
import { newId } from '../../src/util/id.js';
import { parseQuickAdd } from '../../../shared/src/datetime.js';
import { buildDayTimeline, largestGap, formatDuration } from '../../../shared/src/timeline.js';
import { bucketTasks } from '../../../shared/src/planning.js';
import type { EventItem, ShoppingItem, TaskItem } from '../../../shared/src/types.js';
import { Timeline } from '../../src/ui/Timeline.js';
import { useAvailabilityPublisher, useTimedBusyIntervals } from '../../src/calendar/useAvailability.js';
import { Avatar, Button, Card, Field, Muted, Row } from '../../src/ui/components.js';
import { colors, clockTime, relativeDay, spacing, typography } from '../../src/ui/theme.js';

export default function TodayScreen() {
  const router = useRouter();
  const store = useStore();
  const [draft, setDraft] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const now = Date.now();
  const utcOffsetMinutes = -new Date().getTimezoneOffset();

  const events = selectAll<EventItem>(store, 'events');
  const tasks = selectAll<TaskItem>(store, 'tasks');
  const shopping = selectAll<ShoppingItem>(store, 'shoppingItems');

  // This phone keeps the household's picture of everyone's availability fresh.
  useAvailabilityPublisher();
  const busy = useTimedBusyIntervals();

  /** Local midnight, so the timeline covers the day the user is actually in. */
  const dayStart = useMemo(() => {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, [now]);

  const timeline = useMemo(
    () =>
      buildDayTimeline(
        events.map((e) => ({
          id: e.id,
          title: e.title,
          startsAt: e.startsAt,
          endsAt: e.endsAt,
          allDay: e.allDay,
          location: e.location,
          color: e.color,
        })),
        busy,
        { dayStart, utcOffsetMinutes, now },
      ),
    [events, busy, dayStart, utcOffsetMinutes, now],
  );

  const gap = largestGap(timeline);

  // Things-style buckets: what is actually in front of you today, with anything
  // overdue kept in view rather than filed away.
  const buckets = useMemo(
    () => bucketTasks(tasks, { now, utcOffsetMinutes }),
    [tasks, now, utcOffsetMinutes],
  );
  const openTasks = buckets.today.slice(0, 5);

  const liveShopping = shopping.filter((i) => !i.runId);
  const unchecked = liveShopping.filter((i) => !i.checked).length;

  /** Preview of what the quick-add box would create, updated as you type. */
  const preview = useMemo(
    () => (draft.trim() ? parseQuickAdd(draft, { now, utcOffsetMinutes }) : null),
    [draft, now, utcOffsetMinutes],
  );

  function submitQuickAdd() {
    const text = draft.trim();
    if (!text) return;
    const parsed = parseQuickAdd(text, { now, utcOffsetMinutes });

    if (parsed.startsAt !== null) {
      store.upsert('events', {
        id: newId('ev'),
        title: parsed.title || text,
        notes: null,
        location: parsed.location,
        startsAt: parsed.startsAt,
        endsAt: parsed.endsAt ?? parsed.startsAt + 3600_000,
        allDay: parsed.allDay,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
        reminderMinutes: parsed.allDay ? null : 30,
        color: null,
      });
    } else {
      // Nothing date-like in it, so it's a to-do rather than an appointment.
      store.upsert('tasks', {
        id: newId('task'),
        title: text,
        notes: null,
        dueAt: null,
        assigneeId: null,
        done: false,
        doneAt: null,
        doneBy: null,
        category: null,
        priority: 0,
        position: Date.now(),
      });
    }
    setDraft('');
  }

  const others = store.presence.filter((p) => p.userId !== store.user?.id);
  const queued = pendingCount(store);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['left', 'right']}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl * 2 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.textMuted}
            onRefresh={async () => {
              setRefreshing(true);
              await store.sync({ force: true });
              await store.refreshMembers();
              setRefreshing(false);
            }}
          />
        }
      >
        <Row style={{ justifyContent: 'space-between', marginBottom: spacing.md }}>
          <View>
            <Text style={typography.title}>
              {store.user ? `Hi ${store.user.name.split(' ')[0]}` : 'Ortak'}
            </Text>
            <Muted>{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</Muted>
          </View>
          <Row gap={spacing.sm}>
            <Pressable onPress={() => router.push('/search')} hitSlop={8}>
              <Text style={{ fontSize: 22 }}>🔍</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/settings')} hitSlop={8}>
              <Text style={{ fontSize: 22 }}>⚙️</Text>
            </Pressable>
          </Row>
        </Row>

        {!store.online || queued > 0 ? (
          <Card style={{ borderColor: store.online ? colors.border : colors.warning }}>
            <Muted>
              {store.online
                ? `${queued} change${queued === 1 ? '' : 's'} waiting to sync.`
                : `Offline — ${queued > 0 ? `${queued} change${queued === 1 ? '' : 's'} saved here and will` : 'changes will'} sync when you're back.`}
            </Muted>
          </Card>
        ) : null}

        {others.length > 0 ? (
          <Card style={{ borderColor: colors.success }}>
            <Row>
              <Avatar name={others[0]!.name} color={memberColor(store, others[0]!.userId)} size={22} />
              <Text style={typography.small}>
                {others.map((p) => p.name).join(' and ')}{' '}
                {others.length === 1 ? 'is' : 'are'}{' '}
                {others[0]!.context === 'shopping' ? 'shopping right now' : `in ${others[0]!.context}`}
              </Text>
            </Row>
          </Card>
        ) : null}

        <Field
          placeholder="Add anything — “dentist friday 9am” or “buy stamps”"
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={submitQuickAdd}
          returnKeyType="done"
          hint={
            preview?.startsAt
              ? `📅 ${preview.title || 'Event'} · ${relativeDay(preview.startsAt)}${
                  preview.allDay ? ' (all day)' : ` at ${clockTime(preview.startsAt)}`
                }${preview.location ? ` · ${preview.location}` : ''}`
              : draft.trim()
                ? '✅ Will be added as a to-do'
                : undefined
          }
        />

        <Section title="Your day" actionLabel="Calendar" onAction={() => router.push('/(tabs)/calendar')}>
          {gap && gap.minutes >= 60 ? (
            <Card>
              <Text style={typography.body}>
                {formatDuration(gap.minutes)} free from {clockTime(gap.startsAt)}
              </Text>
            </Card>
          ) : null}
          <Timeline
            timeline={timeline}
            memberColors={Object.fromEntries(store.members.map((m) => [m.id, m.color]))}
            memberNames={Object.fromEntries(store.members.map((m) => [m.id, m.name]))}
            onPressEvent={() => router.push('/(tabs)/calendar')}
            onPressGap={(block) =>
              router.push({
                pathname: '/(tabs)/calendar',
                params: { suggestStart: String(block.startsAt) },
              })
            }
          />
        </Section>

        <Section
          title={buckets.overdue.length > 0 ? `To do · ${buckets.overdue.length} overdue` : 'To do'}
          actionLabel="All lists"
          onAction={() => router.push('/(tabs)/lists')}
        >
          {openTasks.length === 0 ? (
            <Muted>Nothing due today.</Muted>
          ) : (
            openTasks.map((task) => (
              <Card key={task.id}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text style={[typography.body, { flex: 1 }]} numberOfLines={1}>
                    {task.title}
                  </Text>
                  {task.dueAt ? (
                    <Text
                      style={[
                        typography.tiny,
                        { color: task.dueAt < now ? colors.danger : colors.textMuted },
                      ]}
                    >
                      {relativeDay(task.dueAt)}
                    </Text>
                  ) : null}
                </Row>
              </Card>
            ))
          )}
        </Section>

        <Section title="Shopping" actionLabel="Open list" onAction={() => router.push('/(tabs)/lists')}>
          <Card onPress={() => router.push('/(tabs)/lists')}>
            <Text style={typography.body}>
              {unchecked === 0
                ? liveShopping.length === 0
                  ? 'The list is empty.'
                  : 'Everything on the list is ticked off.'
                : `${unchecked} item${unchecked === 1 ? '' : 's'} still to get`}
            </Text>
          </Card>
        </Section>

        <View style={{ marginTop: spacing.lg }}>
          <Button
            label="Save something from another app"
            variant="secondary"
            onPress={() => router.push('/capture')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  title,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginTop: spacing.lg }}>
      <Row style={{ justifyContent: 'space-between', marginBottom: spacing.sm }}>
        <Text style={typography.heading}>{title}</Text>
        {actionLabel && onAction ? (
          <Pressable onPress={onAction} hitSlop={8}>
            <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600' }}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </Row>
      {children}
    </View>
  );
}

/**
 * To-dos and the shopping list, in Modernist.
 *
 * The two halves sit behind a segmented control. Inside To do, the Things-style
 * buckets are flush-left text tabs with a 2px accent underline and a small
 * count. Every item is a ruled row with a square tick box at the left; ticking
 * one draws a 2px accent rule through the title rather than fading it out.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useStore, selectAll, memberName, memberColor } from '../../src/store/useStore.js';
import { announcePresence } from '../../src/store/socket.js';
import { useReminderMirror } from '../../src/calendar/useReminderMirror.js';
import { newId } from '../../src/util/id.js';
import { parseQuickAdd } from '../../../shared/src/datetime.js';
import { parseAmountToCents, formatCents } from '../../../shared/src/money.js';
import {
  bucketTasks,
  bucketCounts,
  groupUpcomingByDay,
  type Bucket,
} from '../../../shared/src/planning.js';
import type { ShoppingItem, TaskItem } from '../../../shared/src/types.js';
import {
  Button,
  Card,
  Field,
  Kicker,
  MemberSquare,
  Muted,
  NoticeCard,
  Row,
  Rule,
  ScreenHeader,
  Seg,
  Tag,
  TextTabs,
  TickBox,
} from '../../src/ui/components.js';
import { ArrowRightIcon } from '../../src/ui/icons.js';
import {
  colors,
  fonts,
  relativeDay,
  rules,
  spacing,
  typography,
} from '../../src/ui/theme.js';

type Half = 'todo' | 'shopping';

export default function ListsScreen() {
  const [half, setHalf] = useState<Half>('todo');
  const store = useStore();

  // Tell the other phone we're shopping, and keep saying so while we are.
  useFocusEffect(
    useCallback(() => {
      if (half !== 'shopping') return undefined;
      announcePresence('shopping');
      const timer = setInterval(() => announcePresence('shopping'), 30_000);
      return () => {
        clearInterval(timer);
        announcePresence('');
      };
    }, [half]),
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'left', 'right']}>
      <ScreenHeader
        title="Lists"
        members={store.members.map((m) => ({ id: m.id, name: m.name, color: m.color }))}
      />
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
        keyboardShouldPersistTaps="handled"
      >
        <Seg
          options={[
            { value: 'todo', label: 'To do' },
            { value: 'shopping', label: 'Shopping' },
          ]}
          value={half}
          onChange={setHalf}
        />
        {half === 'todo' ? <TodoList /> : <ShoppingList />}
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// To do
// ---------------------------------------------------------------------------

const EMPTY_COPY: Record<Bucket, string> = {
  today: 'Nothing due today. Enjoy it.',
  upcoming: 'Nothing scheduled ahead.',
  anytime: 'Nothing waiting to be picked up.',
  someday: 'Nothing parked for later.',
  logbook: 'Nothing finished yet.',
};

/** Local midnight `days` from now. */
function startOfDayIn(days: number, now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

function TodoList() {
  const store = useStore();
  // Keeps the chosen Apple Reminders list in step, where one is configured.
  useReminderMirror();
  const [draft, setDraft] = useState('');
  const [view, setView] = useState<Bucket>('today');

  const tasks = selectAll<TaskItem>(store, 'tasks');
  const now = Date.now();
  const utcOffsetMinutes = -new Date().getTimezoneOffset();

  const buckets = useMemo(
    () => bucketTasks(tasks, { now, utcOffsetMinutes }),
    [tasks, now, utcOffsetMinutes],
  );
  const counts = bucketCounts(buckets);
  const upcomingDays = useMemo(
    () => groupUpcomingByDay(buckets.upcoming, { now, utcOffsetMinutes }),
    [buckets.upcoming, now, utcOffsetMinutes],
  );

  const preview = useMemo(
    () => (draft.trim() ? parseQuickAdd(draft, { now, utcOffsetMinutes }) : null),
    [draft, now, utcOffsetMinutes],
  );

  function add() {
    const text = draft.trim();
    if (!text) return;
    const parsed = parseQuickAdd(text, { now, utcOffsetMinutes });

    store.upsert('tasks', {
      id: newId('task'),
      title: parsed.startsAt ? parsed.title || text : text,
      notes: null,
      dueAt: parsed.startsAt,
      deferAt: null,
      assigneeId: null,
      done: false,
      doneAt: null,
      doneBy: null,
      category: null,
      priority: 0,
      position: Date.now(),
    });
    setDraft('');
  }

  function toggle(task: TaskItem) {
    void Haptics.selectionAsync();
    store.upsert('tasks', {
      ...task,
      done: !task.done,
      doneAt: task.done ? null : Date.now(),
      doneBy: task.done ? null : (store.user?.id ?? null),
    });
  }

  function defer(task: TaskItem, days: number | null) {
    store.upsert('tasks', { ...task, deferAt: days === null ? null : startOfDayIn(days, now) });
  }

  function schedule(task: TaskItem, days: number | null) {
    store.upsert('tasks', {
      ...task,
      dueAt: days === null ? null : startOfDayIn(days, now) + 9 * 3600_000,
    });
  }

  const bucketTabs = [
    { value: 'today' as const, label: 'Today', count: counts.today },
    { value: 'upcoming' as const, label: 'Upcoming', count: counts.upcoming },
    { value: 'anytime' as const, label: 'Anytime', count: counts.anytime },
    { value: 'someday' as const, label: 'Someday', count: counts.someday },
    { value: 'logbook' as const, label: 'Logbook', count: 0 },
  ];

  const visible = buckets[view];

  return (
    <View>
      <Field
        label="Add a to-do"
        placeholder="call the landlord tomorrow"
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={add}
        returnKeyType="done"
        hint={preview?.startsAt ? `Due ${relativeDay(preview.startsAt)}` : undefined}
        style={{ marginBottom: 0 }}
      />

      <TextTabs tabs={bucketTabs} value={view} onChange={setView} />

      {view === 'today' && counts.overdue > 0 ? (
        <NoticeCard kicker="Overdue" style={{ marginTop: spacing.lg }}>
          {`${counts.overdue} thing${counts.overdue === 1 ? '' : 's'} past its date — still here rather than hidden.`}
        </NoticeCard>
      ) : null}

      {visible.length === 0 ? (
        <Text style={[typography.small, { marginTop: spacing.xl }]}>{EMPTY_COPY[view]}</Text>
      ) : view === 'upcoming' ? (
        upcomingDays.map((day) => (
          <View key={day.dayStart} style={{ marginTop: spacing.xl }}>
            <Kicker>{relativeDay(day.dayStart)}</Kicker>
            <Rule style={{ marginTop: 6 }} />
            {day.tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                now={now}
                onToggle={toggle}
                onDefer={defer}
                onSchedule={schedule}
              />
            ))}
          </View>
        ))
      ) : (
        <View style={{ marginTop: spacing.lg, borderTopWidth: rules.section, borderTopColor: colors.divider }}>
          {visible.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              now={now}
              onToggle={toggle}
              onDefer={defer}
              onSchedule={schedule}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function TaskRow({
  task,
  now,
  onToggle,
  onDefer,
  onSchedule,
}: {
  task: TaskItem;
  now: number;
  onToggle: (task: TaskItem) => void;
  onDefer: (task: TaskItem, days: number | null) => void;
  onSchedule: (task: TaskItem, days: number | null) => void;
}) {
  const store = useStore();
  const [open, setOpen] = useState(false);
  const overdue = !task.done && task.dueAt !== null && task.dueAt < now;

  return (
    <View style={styles.itemRow}>
      <TickBox checked={task.done} onPress={() => onToggle(task)} />

      <Pressable
        style={{ flex: 1, minWidth: 0, gap: 3 }}
        onPress={() => setOpen((v) => !v)}
        onLongPress={() =>
          Alert.alert('Delete this to-do?', task.title, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => store.remove('tasks', task.id) },
          ])
        }
      >
        {/* The strike is a 2px accent rule — the system's rule weight, not a
            text decoration, so it reads as the same mark used everywhere else. */}
        <View style={{ alignSelf: 'flex-start' }}>
          <Text style={[typography.body, task.done && { color: colors.textMuted }]}>{task.title}</Text>
          {task.done ? <View style={styles.strike} /> : null}
        </View>

        <Row gap={10} style={{ flexWrap: 'wrap' }}>
          {task.dueAt ? (
            <Text
              style={[
                typography.tiny,
                overdue && { color: colors.accent700, fontFamily: fonts.headingSemi },
              ]}
            >
              due {relativeDay(task.dueAt)}
            </Text>
          ) : null}
          {task.deferAt && task.deferAt > now ? (
            <Text style={typography.tiny}>starts {relativeDay(task.deferAt)}</Text>
          ) : null}
          <Text style={typography.tiny}>
            {task.done && task.doneBy
              ? `done by ${memberName(store, task.doneBy)}`
              : `added by ${memberName(store, task.createdBy)}`}
          </Text>
        </Row>

        {open && !task.done ? (
          <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
            <Text style={typography.tiny}>Due</Text>
            <Row gap={6} style={{ flexWrap: 'wrap' }}>
              <Tag label="Today" onPress={() => onSchedule(task, 0)} />
              <Tag label="Tomorrow" onPress={() => onSchedule(task, 1)} />
              <Tag label="Next week" onPress={() => onSchedule(task, 7)} />
              <Tag label="No date" onPress={() => onSchedule(task, null)} />
            </Row>

            <Text style={typography.tiny}>Start (hides it until then)</Text>
            <Row gap={6} style={{ flexWrap: 'wrap' }}>
              <Tag label="Tomorrow" onPress={() => onDefer(task, 1)} />
              <Tag label="Next week" onPress={() => onDefer(task, 7)} />
              <Tag label="Next month" onPress={() => onDefer(task, 30)} />
              <Tag label="Someday" onPress={() => onDefer(task, 120)} />
              <Tag label="Now" onPress={() => onDefer(task, null)} />
            </Row>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Shopping
// ---------------------------------------------------------------------------

function ShoppingList() {
  const store = useStore();
  const api = useStore((s) => s.api());
  const [draft, setDraft] = useState('');
  const [suggestions, setSuggestions] = useState<{ name: string; category: string | null }[]>([]);
  const [closing, setClosing] = useState(false);

  const items = selectAll<ShoppingItem>(store, 'shoppingItems').filter((i) => !i.runId);
  const todo = items.filter((i) => !i.checked).sort((a, b) => a.position - b.position);
  const got = items.filter((i) => i.checked).sort((a, b) => (b.checkedAt ?? 0) - (a.checkedAt ?? 0));

  const spent = got.reduce((sum, i) => sum + (i.priceCents ?? 0), 0);
  const currency = store.space?.baseCurrency ?? 'EUR';
  const shoppers = store.presence.filter(
    (p) => p.userId !== store.user?.id && p.context === 'shopping',
  );

  useEffect(() => {
    if (!store.online) return;
    void api
      .shoppingSuggestions()
      .then((r) => setSuggestions(r.suggestions.slice(0, 8)))
      .catch(() => undefined);
  }, [store.online, store.rev, api]);

  function add(name: string, category: string | null = null) {
    const trimmed = name.trim();
    if (!trimmed) return;

    const match = /^([\d.,]+\s*(?:kg|g|l|ml|x|adet|stück|stk|pcs)?)\s+(.*)$/i.exec(trimmed);
    store.upsert('shoppingItems', {
      id: newId('shop'),
      name: match ? match[2]!.trim() : trimmed,
      quantity: match ? match[1]!.trim() : null,
      category,
      store: null,
      checked: false,
      checkedBy: null,
      checkedAt: null,
      priceCents: null,
      note: null,
      position: Date.now(),
      runId: null,
    });
    setDraft('');
  }

  function toggle(item: ShoppingItem) {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    store.upsert('shoppingItems', {
      ...item,
      checked: !item.checked,
      checkedBy: item.checked ? null : (store.user?.id ?? null),
      checkedAt: item.checked ? null : Date.now(),
    });
  }

  async function finishRun() {
    setClosing(true);
    try {
      const result = await api.completeShoppingRun({});
      await store.sync({ force: true });
      Alert.alert(
        'Shop finished',
        `${result.itemCount} item${result.itemCount === 1 ? '' : 's'} put away${
          result.totalCents > 0 ? ` · ${formatCents(result.totalCents, currency)}` : ''
        }.`,
      );
    } catch {
      Alert.alert('Could not finish', 'You need a connection to close out a shop.');
    } finally {
      setClosing(false);
    }
  }

  return (
    <View>
      {shoppers.length > 0 ? (
        <Card style={{ marginTop: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <MemberSquare
            name={shoppers[0]!.name}
            color={memberColor(store, shoppers[0]!.userId)}
            size={20}
          />
          <Text style={[typography.body, { flex: 1 }]}>
            {shoppers.map((s) => s.name).join(' and ')} {shoppers.length === 1 ? 'is' : 'are'} in the
            shop too
          </Text>
          <View style={{ width: 8, height: 8, backgroundColor: colors.accent }} />
        </Card>
      ) : null}

      <Field
        label="Add to the list"
        placeholder="2 kg tomatoes"
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={() => add(draft)}
        returnKeyType="done"
        style={{ marginBottom: 0 }}
      />

      {suggestions.length > 0 ? (
        <View style={{ marginTop: spacing.md, gap: 6 }}>
          <Text style={typography.tiny}>Usual suspects</Text>
          <Row gap={6} style={{ flexWrap: 'wrap' }}>
            {suggestions.map((s) => (
              <Tag key={s.name} label={s.name} onPress={() => add(s.name, s.category)} />
            ))}
          </Row>
        </View>
      ) : null}

      {todo.length === 0 && got.length === 0 ? (
        <Text style={[typography.small, { marginTop: spacing.xl }]}>
          The list is empty. Add something, and it appears on the other phone straight away.
        </Text>
      ) : null}

      {todo.length > 0 ? (
        <View style={{ marginTop: spacing.lg, borderTopWidth: rules.section, borderTopColor: colors.divider }}>
          {todo.map((item) => (
            <View key={item.id} style={[styles.itemRow, { alignItems: 'center' }]}>
              <TickBox checked={false} onPress={() => toggle(item)} />
              <Pressable
                style={{ flex: 1, minWidth: 0, gap: 2 }}
                onLongPress={() => store.remove('shoppingItems', item.id)}
              >
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text style={typography.body}>{item.name}</Text>
                  {item.quantity ? <Text style={typography.small}>{item.quantity}</Text> : null}
                </Row>
                <Text style={typography.tiny}>added by {memberName(store, item.createdBy)}</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {got.length > 0 ? (
        <View style={{ marginTop: spacing.xl }}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 6 }}>
            <Kicker>{`In the trolley (${got.length})`}</Kicker>
            {spent > 0 ? (
              <Text style={{ fontFamily: fonts.heading, fontSize: 13, color: colors.text }}>
                {formatCents(spent, currency)}
              </Text>
            ) : null}
          </Row>
          <Rule />

          {got.map((item) => (
            <View key={item.id} style={[styles.itemRow, { alignItems: 'center' }]}>
              <TickBox checked onPress={() => toggle(item)} />
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text style={[typography.body, { color: colors.textMuted }]}>{item.name}</Text>
                <Text style={typography.tiny}>
                  {item.checkedBy ? `${memberName(store, item.checkedBy)} got this` : 'ticked off'}
                </Text>
              </View>
              <Field
                placeholder="0,00"
                keyboardType="decimal-pad"
                defaultValue={item.priceCents != null ? String(item.priceCents / 100) : ''}
                onEndEditing={(e) =>
                  store.upsert('shoppingItems', {
                    ...item,
                    priceCents: parseAmountToCents(e.nativeEvent.text, currency),
                  })
                }
                style={{ width: 84, minHeight: 36, textAlign: 'right', paddingVertical: 6 }}
              />
            </View>
          ))}

          <Button
            label="Finish this shop"
            block
            busy={closing}
            onPress={() => void finishRun()}
            icon={<ArrowRightIcon size={14} color={colors.bg} />}
            style={{ marginTop: spacing.md }}
          />
          <Muted>
            Moves everything ticked into your shopping history and clears the list for next time.
          </Muted>
        </View>
      ) : null}
    </View>
  );
}

const styles = {
  itemRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: rules.row,
    borderBottomColor: colors.dividerSoft,
  },
  strike: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    top: '55%' as const,
    height: 2,
    backgroundColor: colors.accent,
  },
};

/**
 * To-dos and the shopping list.
 *
 * The shopping half is the one that has to work while walking around a shop, so
 * it leans on presence: while this tab is open the app announces "shopping",
 * the other phone shows it, and every tick appears on both within a second.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useStore, selectAll, memberColor, memberName } from '../../src/store/useStore.js';
import { announcePresence } from '../../src/store/socket.js';
import { newId } from '../../src/util/id.js';
import { parseQuickAdd } from '../../../shared/src/datetime.js';
import { parseAmountToCents, formatCents } from '../../../shared/src/money.js';
import type { ShoppingItem, TaskItem } from '../../../shared/src/types.js';
import { Avatar, Button, Card, CheckCircle, Chip, Field, Muted, Row } from '../../src/ui/components.js';
import { colors, relativeDay, spacing, typography } from '../../src/ui/theme.js';

type Tab = 'todo' | 'shopping';

export default function ListsScreen() {
  const [tab, setTab] = useState<Tab>('todo');
  const store = useStore();

  // Tell the other phone we're shopping, and keep saying so while we are.
  useFocusEffect(
    useCallback(() => {
      if (tab !== 'shopping') return undefined;
      announcePresence('shopping');
      const timer = setInterval(() => announcePresence('shopping'), 30_000);
      return () => {
        clearInterval(timer);
        announcePresence('');
      };
    }, [tab]),
  );

  const shoppers = store.presence.filter(
    (p) => p.userId !== store.user?.id && p.context === 'shopping',
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['left', 'right']}>
      <View style={{ padding: spacing.lg, paddingBottom: 0 }}>
        <Row style={{ marginBottom: spacing.md }}>
          <Chip label="To do" selected={tab === 'todo'} onPress={() => setTab('todo')} />
          <Chip label="Shopping" selected={tab === 'shopping'} onPress={() => setTab('shopping')} />
        </Row>

        {tab === 'shopping' && shoppers.length > 0 ? (
          <Card style={{ borderColor: colors.success }}>
            <Row>
              <Avatar name={shoppers[0]!.name} color={memberColor(store, shoppers[0]!.userId)} size={22} />
              <Text style={typography.small}>
                {shoppers.map((s) => s.name).join(' and ')} {shoppers.length === 1 ? 'is' : 'are'} in
                the shop too
              </Text>
            </Row>
          </Card>
        ) : null}
      </View>

      {tab === 'todo' ? <TodoList /> : <ShoppingList />}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// To-do
// ---------------------------------------------------------------------------

function TodoList() {
  const store = useStore();
  const [draft, setDraft] = useState('');
  const [showDone, setShowDone] = useState(false);

  const tasks = selectAll<TaskItem>(store, 'tasks');
  const now = Date.now();

  const open = useMemo(
    () =>
      tasks
        .filter((t) => !t.done)
        .sort((a, b) => (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity) || b.position - a.position),
    [tasks],
  );
  const done = useMemo(
    () => tasks.filter((t) => t.done).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0)).slice(0, 30),
    [tasks],
  );

  function add() {
    const text = draft.trim();
    if (!text) return;
    // A due date typed inline ("call landlord tomorrow") is picked up here too.
    const parsed = parseQuickAdd(text, { now, utcOffsetMinutes: -new Date().getTimezoneOffset() });

    store.upsert('tasks', {
      id: newId('task'),
      title: parsed.startsAt ? parsed.title || text : text,
      notes: null,
      dueAt: parsed.startsAt,
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

  return (
    <ScrollView
      contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, paddingBottom: spacing.xxl * 2 }}
      keyboardShouldPersistTaps="handled"
    >
      <Field
        placeholder="Add a to-do"
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={add}
        returnKeyType="done"
      />

      {open.length === 0 ? (
        <Muted>Nothing to do. Enjoy it.</Muted>
      ) : (
        open.map((task) => (
          <Card key={task.id}>
            <Row style={{ alignItems: 'flex-start' }}>
              <CheckCircle checked={false} onPress={() => toggle(task)} />
              <Pressable
                style={{ flex: 1 }}
                onLongPress={() =>
                  Alert.alert('Delete this to-do?', task.title, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => store.remove('tasks', task.id) },
                  ])
                }
              >
                <Text style={typography.body}>{task.title}</Text>
                <Row gap={spacing.sm}>
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
                  <Text style={typography.tiny}>added by {memberName(store, task.createdBy)}</Text>
                </Row>
              </Pressable>
            </Row>
          </Card>
        ))
      )}

      {done.length > 0 ? (
        <View style={{ marginTop: spacing.lg }}>
          <Pressable onPress={() => setShowDone((v) => !v)} hitSlop={8}>
            <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600' }}>
              {showDone ? 'Hide' : 'Show'} {done.length} done
            </Text>
          </Pressable>

          {showDone
            ? done.map((task) => (
                <Card key={task.id}>
                  <Row>
                    <CheckCircle checked onPress={() => toggle(task)} color={colors.success} />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[typography.body, { color: colors.textMuted, textDecorationLine: 'line-through' }]}
                      >
                        {task.title}
                      </Text>
                      {task.doneBy ? (
                        <Text style={typography.tiny}>done by {memberName(store, task.doneBy)}</Text>
                      ) : null}
                    </View>
                  </Row>
                </Card>
              ))
            : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Shopping
// ---------------------------------------------------------------------------

function ShoppingList() {
  const store = useStore();
  // Stable singleton reference; `store` itself changes identity on every edit.
  const api = useStore((s) => s.api());
  const [draft, setDraft] = useState('');
  const [suggestions, setSuggestions] = useState<{ name: string; category: string | null }[]>([]);
  const [closing, setClosing] = useState(false);

  const items = selectAll<ShoppingItem>(store, 'shoppingItems').filter((i) => !i.runId);
  const todo = items.filter((i) => !i.checked).sort((a, b) => a.position - b.position);
  const got = items
    .filter((i) => i.checked)
    .sort((a, b) => (b.checkedAt ?? 0) - (a.checkedAt ?? 0));

  const spent = got.reduce((sum, i) => sum + (i.priceCents ?? 0), 0);
  const currency = store.space?.baseCurrency ?? 'EUR';

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

    // "2 kg tomatoes" — pull a leading quantity out so it shows in its own column.
    const match = /^([\d.,]+\s*(?:kg|g|l|ml|x|adet|stück|stk|pcs)?)\s+(.*)$/i.exec(trimmed);
    const quantity = match ? match[1]!.trim() : null;
    const label = match ? match[2]!.trim() : trimmed;

    store.upsert('shoppingItems', {
      id: newId('shop'),
      name: label,
      quantity,
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

  function setPrice(item: ShoppingItem, text: string) {
    const cents = parseAmountToCents(text, currency);
    store.upsert('shoppingItems', { ...item, priceCents: cents });
  }

  async function finishRun() {
    setClosing(true);
    try {
      const result = await store.api().completeShoppingRun({});
      await store.sync({ force: true });
      Alert.alert(
        'Shop finished',
        `${result.itemCount} item${result.itemCount === 1 ? '' : 's'} put away${
          result.totalCents > 0 ? ` · ${formatCents(result.totalCents, currency)}` : ''
        }.`,
      );
    } catch {
      Alert.alert('Could not finish', 'You need a connection to close out a shop. Try again in a moment.');
    } finally {
      setClosing(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, paddingBottom: spacing.xxl * 2 }}
      keyboardShouldPersistTaps="handled"
    >
      <Field
        placeholder="Add to the list"
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={() => add(draft)}
        returnKeyType="done"
      />

      {suggestions.length > 0 ? (
        <View style={{ marginBottom: spacing.md }}>
          <Text style={[typography.tiny, { marginBottom: spacing.xs }]}>Usual suspects</Text>
          <Row style={{ flexWrap: 'wrap' }} gap={spacing.xs}>
            {suggestions.map((s) => (
              <Chip key={s.name} label={`+ ${s.name}`} onPress={() => add(s.name, s.category)} />
            ))}
          </Row>
        </View>
      ) : null}

      {todo.length === 0 && got.length === 0 ? (
        <Muted>The list is empty. Add something, and it appears on the other phone straight away.</Muted>
      ) : null}

      {todo.map((item) => (
        <Card key={item.id}>
          <Row>
            <CheckCircle checked={false} onPress={() => toggle(item)} />
            <Pressable
              style={{ flex: 1 }}
              onLongPress={() => store.remove('shoppingItems', item.id)}
            >
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={typography.body}>{item.name}</Text>
                {item.quantity ? <Text style={typography.small}>{item.quantity}</Text> : null}
              </Row>
              <Text style={typography.tiny}>added by {memberName(store, item.createdBy)}</Text>
            </Pressable>
          </Row>
        </Card>
      ))}

      {got.length > 0 ? (
        <View style={{ marginTop: spacing.lg }}>
          <Row style={{ justifyContent: 'space-between', marginBottom: spacing.sm }}>
            <Text style={typography.subheading}>In the trolley ({got.length})</Text>
            {spent > 0 ? <Text style={typography.small}>{formatCents(spent, currency)}</Text> : null}
          </Row>

          {got.map((item) => (
            <Card key={item.id}>
              <Row>
                <CheckCircle checked onPress={() => toggle(item)} color={colors.success} />
                <View style={{ flex: 1 }}>
                  <Text style={[typography.body, { color: colors.textMuted }]}>{item.name}</Text>
                  <Text style={typography.tiny}>
                    {item.checkedBy ? `${memberName(store, item.checkedBy)} got this` : 'ticked off'}
                  </Text>
                </View>
                <Field
                  placeholder="0,00"
                  keyboardType="decimal-pad"
                  defaultValue={item.priceCents != null ? String(item.priceCents / 100) : ''}
                  onEndEditing={(e) => setPrice(item, e.nativeEvent.text)}
                  style={{ width: 84, paddingVertical: spacing.sm, textAlign: 'right' }}
                />
              </Row>
            </Card>
          ))}

          <Button
            label="Finish this shop"
            onPress={() => void finishRun()}
            busy={closing}
            style={{ marginTop: spacing.sm }}
          />
          <Muted>
            Moves everything ticked into your shopping history and clears the list for next time.
          </Muted>
        </View>
      ) : null}
    </ScrollView>
  );
}

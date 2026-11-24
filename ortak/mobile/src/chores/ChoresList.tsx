/**
 * Chores — the jobs that come round again, and whose turn they are.
 *
 * Sits behind the third segment on the Lists tab. Ticking a chore does not
 * close it: it schedules the next one and, when the chore takes turns, hands it
 * to the other person. The card at the top shows the split of the last 30 days
 * in each person's ink, so "who does more around here" is a bar rather than an
 * argument. The rules themselves live in `shared/src/chores.ts`.
 *
 * Rendered inside the Lists screen's ScrollView, so this is a plain View.
 */

import { useState } from 'react';
import { Alert, Pressable, Text, View, type AlertButton } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useStore, selectAll, memberName, memberColor } from '../store/useStore.js';
import { newId } from '../util/id.js';
import {
  choreBalance,
  choreStatus,
  completeChore,
  describeDue,
  describeInterval,
  groupChores,
  localDayStart,
  undoLastCompletion,
  type ChoreMode,
  type ChoreOptions,
} from '../../../shared/src/chores.js';
import type { Chore } from '../../../shared/src/types.js';
import { Button, Card, Field, Kicker, MemberSquare, Muted, Row, Seg, Tag, TickBox } from '../ui/components.js';
import { colors, fonts, radius, spacing, typography } from '../ui/theme.js';

const INTERVALS: readonly (readonly [number, string])[] = [
  [1, 'Daily'],
  [3, 'Every 3 days'],
  [7, 'Weekly'],
  [14, 'Every 2 weeks'],
  [30, 'Monthly'],
];

const EFFORTS: readonly (readonly [number, string])[] = [
  [1, 'Quick'],
  [2, 'Medium'],
  [3, 'Big job'],
];

export function ChoresList() {
  const store = useStore();
  const [draft, setDraft] = useState('');
  const [everyDays, setEveryDays] = useState(7);
  const [mode, setMode] = useState<ChoreMode>('rotate');
  const [effort, setEffort] = useState(1);

  const now = Date.now();
  const utcOffsetMinutes = -new Date().getTimezoneOffset();
  const opts: ChoreOptions = { now, utcOffsetMinutes };
  const memberIds = store.members.map((m) => m.id);

  const chores = selectAll<Chore>(store, 'chores');
  const groups = groupChores(chores, opts);
  const balance = chores.length > 0 && memberIds.length >= 2 ? choreBalance(chores, memberIds, opts) : null;

  function addChore() {
    const title = draft.trim();
    if (!title || !store.user) return;

    store.upsert('chores', {
      id: newId('chore'),
      title,
      everyDays,
      nextDueAt: localDayStart(now, utcOffsetMinutes),
      mode,
      assigneeId: mode === 'anyone' ? null : store.user.id,
      effort,
      history: [],
      paused: false,
    });
    setDraft('');
  }

  function complete(chore: Chore) {
    if (!store.user) return;
    void Haptics.selectionAsync();
    store.upsert('chores', { ...chore, ...completeChore(chore, store.user.id, memberIds, opts) });
  }

  function openMenu(chore: Chore) {
    const buttons: AlertButton[] = [];

    const undone = undoLastCompletion(chore, opts);
    if (undone) {
      buttons.push({
        text: 'Undo last tick',
        onPress: () => store.upsert('chores', { ...chore, ...undone }),
      });
    }

    buttons.push({
      text: chore.paused ? 'Resume' : 'Pause',
      onPress: () =>
        store.upsert('chores', {
          ...chore,
          paused: !chore.paused,
          // A chore resumed after a month away is due now, not a month overdue.
          nextDueAt: chore.paused ? localDayStart(now, utcOffsetMinutes) : chore.nextDueAt,
        }),
    });
    buttons.push({
      text: 'Delete',
      style: 'destructive',
      onPress: () => store.remove('chores', chore.id),
    });
    buttons.push({ text: 'Cancel', style: 'cancel' });

    const last = chore.history[chore.history.length - 1];
    const detail = [
      describeInterval(chore.everyDays),
      last ? `last done by ${memberName(store, last.by) || 'someone'}` : null,
    ]
      .filter(Boolean)
      .join(' · ');

    Alert.alert(chore.title, detail, buttons);
  }

  const sections: { label: string; items: Chore[] }[] = [
    { label: 'To do', items: groups.due },
    { label: 'Coming up', items: groups.upcoming },
    { label: 'Paused', items: groups.paused },
  ].filter((s) => s.items.length > 0);

  return (
    <View style={{ marginTop: spacing.lg }}>
      {balance ? (
        <Card>
          <Kicker>Last 30 days</Kicker>
          {balance.some((load) => load.count > 0) ? (
            <View
              style={{
                flexDirection: 'row',
                height: 10,
                gap: 2,
                borderRadius: radius.pill,
                overflow: 'hidden',
                backgroundColor: colors.surfaceAlt,
                marginVertical: spacing.xs,
              }}
            >
              {balance
                .filter((load) => load.share > 0)
                .map((load) => (
                  <View
                    key={load.memberId}
                    style={{ flex: load.share, backgroundColor: memberColor(store, load.memberId) }}
                  />
                ))}
            </View>
          ) : (
            <Muted>Tick a chore off and the split of who did what shows up here.</Muted>
          )}
          <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
            {balance.map((load) => (
              <Row key={load.memberId} gap={6}>
                <MemberSquare
                  name={memberName(store, load.memberId)}
                  color={memberColor(store, load.memberId)}
                  size={20}
                />
                <Text style={typography.small}>
                  {memberName(store, load.memberId)} · {load.count} done
                </Text>
              </Row>
            ))}
          </Row>
        </Card>
      ) : null}

      <Field
        placeholder="Add a chore — “Take out the bins”"
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={addChore}
        returnKeyType="done"
      />

      {draft.trim() ? (
        <View style={{ gap: spacing.md, marginBottom: spacing.lg }}>
          <Row style={{ flexWrap: 'wrap' }}>
            {INTERVALS.map(([days, label]) => (
              <Tag key={days} label={label} selected={everyDays === days} onPress={() => setEveryDays(days)} />
            ))}
          </Row>
          <Seg
            options={[
              { value: 'rotate', label: 'Take turns' },
              { value: 'fixed', label: 'Mine' },
              { value: 'anyone', label: 'Whoever' },
            ]}
            value={mode}
            onChange={setMode}
          />
          <Row style={{ flexWrap: 'wrap' }}>
            {EFFORTS.map(([level, label]) => (
              <Tag key={level} label={label} selected={effort === level} onPress={() => setEffort(level)} />
            ))}
          </Row>
          <Button label="Add chore" onPress={addChore} />
        </View>
      ) : null}

      {chores.length === 0 ? (
        <Card>
          <Text style={typography.subheading}>No chores yet</Text>
          <Muted>
            Add the jobs that come round again — bins, laundry, the bathroom. Ikimiz takes turns for
            you and keeps count of who did what.
          </Muted>
        </Card>
      ) : null}

      {sections.map((section) => (
        <View key={section.label} style={{ marginTop: spacing.md }}>
          <Kicker style={{ marginBottom: spacing.sm }}>{section.label}</Kicker>
          <Card style={{ paddingVertical: spacing.xs, gap: 0 }}>
            {section.items.map((chore, index) => (
              <ChoreRow
                key={chore.id}
                chore={chore}
                first={index === 0}
                due={describeDue(chore, opts)}
                overdue={choreStatus(chore, opts) === 'overdue'}
                assigneeName={memberName(store, chore.assigneeId)}
                assigneeColor={memberColor(store, chore.assigneeId)}
                onTick={() => complete(chore)}
                onOpen={() => openMenu(chore)}
              />
            ))}
          </Card>
        </View>
      ))}
    </View>
  );
}

function ChoreRow({
  chore,
  first,
  due,
  overdue,
  assigneeName,
  assigneeColor,
  onTick,
  onOpen,
}: {
  chore: Chore;
  first: boolean;
  due: string;
  overdue: boolean;
  assigneeName: string;
  assigneeColor: string;
  onTick: () => void;
  onOpen: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.md,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: colors.dividerSoft,
      }}
    >
      {chore.paused ? null : <TickBox checked={false} onPress={onTick} hitSize={44} />}
      <Pressable style={{ flex: 1 }} onPress={onOpen} onLongPress={onOpen}>
        <Text style={[typography.body, { fontFamily: fonts.headingSemi }]} numberOfLines={2}>
          {chore.title}
        </Text>
        <Text style={[typography.small, overdue && { color: colors.danger }]}>
          {due} · {describeInterval(chore.everyDays)}
        </Text>
      </Pressable>
      {chore.assigneeId && assigneeName ? (
        <MemberSquare name={assigneeName} color={assigneeColor} size={26} />
      ) : (
        <Tag label="Anyone" />
      )}
    </View>
  );
}

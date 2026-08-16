/**
 * One trip: who's on it, what got spent, and the shortest way to settle up.
 *
 * The balances are computed on the phone from synced rows, so this screen works
 * on a beach with no signal — the same code the server runs (shared/src/split.ts)
 * produces the same numbers.
 */

import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useStore, selectAll } from '../../src/store/useStore.js';
import { newId } from '../../src/util/id.js';
import { summarizeTrip } from '../../../shared/src/split.js';
import { formatCents, parseAmountToCents } from '../../../shared/src/money.js';
import type { Expense, Settlement, SplitMode, Trip, TripMember } from '../../../shared/src/types.js';
import { Avatar, Button, Card, Chip, Field, Muted, Row } from '../../src/ui/components.js';
import { colors, relativeDay, spacing, typography } from '../../src/ui/theme.js';

export default function TripScreen() {
  const { id: tripId } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const store = useStore();

  const trip = tripId ? (store.entities.trips[tripId] as unknown as Trip | undefined) : undefined;

  const members = selectAll<TripMember>(store, 'tripMembers').filter((m) => m.tripId === tripId);
  const expenses = selectAll<Expense>(store, 'expenses')
    .filter((e) => e.tripId === tripId)
    .sort((a, b) => b.spentAt - a.spentAt);
  const settlements = selectAll<Settlement>(store, 'settlements').filter((s) => s.tripId === tripId);

  const summary = useMemo(
    () => summarizeTrip(members, expenses, settlements, trip?.currency ?? 'EUR'),
    [members, expenses, settlements, trip?.currency],
  );

  const [showAdd, setShowAdd] = useState(false);
  const [newMember, setNewMember] = useState('');

  // In an effect, not during render — setting navigation options while
  // rendering is a side effect React will complain about.
  useEffect(() => {
    if (trip?.name) navigation.setOptions({ title: trip.name });
  }, [navigation, trip?.name]);

  if (!trip || trip.deleted) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.lg }}>
        <Muted>This trip has been deleted.</Muted>
      </View>
    );
  }

  const nameOf = (memberId: string) => members.find((m) => m.id === memberId)?.name ?? 'Unknown';
  const colorOf = (memberId: string) => members.find((m) => m.id === memberId)?.color ?? colors.accent;

  function addMember() {
    const name = newMember.trim();
    if (!name) return;
    store.upsert('tripMembers', {
      id: newId('tm'),
      tripId: trip!.id,
      name,
      userId: null,
      color: colors.members[members.length % colors.members.length]!,
    });
    setNewMember('');
  }

  function settle(fromMemberId: string, toMemberId: string, amountCents: number) {
    store.upsert('settlements', {
      id: newId('st'),
      tripId: trip!.id,
      fromMemberId,
      toMemberId,
      amountCents,
      settledAt: Date.now(),
      note: null,
    });
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl * 2 }}
      keyboardShouldPersistTaps="handled"
    >
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={typography.heading}>{formatCents(summary.totalCents, trip.currency)}</Text>
          <Muted>{expenses.length} expenses</Muted>
        </Row>
      </Card>

      {/* ---- Settle up ---- */}
      <Text style={[typography.heading, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>
        Settle up
      </Text>

      {summary.transfers.length === 0 ? (
        <Card>
          <Muted>Everyone’s square. Nothing to pay.</Muted>
        </Card>
      ) : (
        summary.transfers.map((transfer) => (
          <Card key={`${transfer.fromMemberId}-${transfer.toMemberId}`}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Row style={{ flex: 1 }}>
                <Avatar name={nameOf(transfer.fromMemberId)} color={colorOf(transfer.fromMemberId)} size={24} />
                <Text style={typography.body}>→</Text>
                <Avatar name={nameOf(transfer.toMemberId)} color={colorOf(transfer.toMemberId)} size={24} />
                <Text style={[typography.body, { flex: 1 }]} numberOfLines={1}>
                  {nameOf(transfer.fromMemberId)} pays {nameOf(transfer.toMemberId)}
                </Text>
              </Row>
              <Text style={[typography.subheading, { color: colors.accent }]}>
                {formatCents(transfer.amountCents, trip.currency)}
              </Text>
            </Row>
            <Pressable
              hitSlop={8}
              style={{ marginTop: spacing.sm }}
              onPress={() =>
                Alert.alert(
                  'Mark as paid?',
                  `${nameOf(transfer.fromMemberId)} → ${nameOf(transfer.toMemberId)}: ${formatCents(transfer.amountCents, trip.currency)}`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Paid',
                      onPress: () =>
                        settle(transfer.fromMemberId, transfer.toMemberId, transfer.amountCents),
                    },
                  ],
                )
              }
            >
              <Text style={{ color: colors.success, fontSize: 13, fontWeight: '600' }}>
                Mark as paid
              </Text>
            </Pressable>
          </Card>
        ))
      )}

      {summary.problems.length > 0 ? (
        <Card style={{ borderColor: colors.warning }}>
          <Muted>
            {summary.problems.length} expense
            {summary.problems.length === 1 ? '' : 's'} couldn’t be split — someone on it is no longer
            a member of this trip.
          </Muted>
        </Card>
      ) : null}

      {/* ---- Balances ---- */}
      <Text style={[typography.heading, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>
        Balances
      </Text>
      {summary.balances.map((balance) => (
        <Card key={balance.memberId}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Row style={{ flex: 1 }}>
              <Avatar name={nameOf(balance.memberId)} color={colorOf(balance.memberId)} size={26} />
              <View>
                <Text style={typography.body}>{nameOf(balance.memberId)}</Text>
                <Text style={typography.tiny}>
                  paid {formatCents(balance.paidCents, trip.currency)} · used{' '}
                  {formatCents(balance.owedCents, trip.currency)}
                </Text>
              </View>
            </Row>
            <Text
              style={{
                fontSize: 15,
                fontWeight: '700',
                color:
                  balance.netCents > 0
                    ? colors.success
                    : balance.netCents < 0
                      ? colors.warning
                      : colors.textMuted,
              }}
            >
              {balance.netCents === 0
                ? '—'
                : `${balance.netCents > 0 ? '+' : '−'}${formatCents(Math.abs(balance.netCents), trip.currency)}`}
            </Text>
          </Row>
        </Card>
      ))}

      <Row style={{ marginTop: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Field
            placeholder="Add someone to the trip"
            value={newMember}
            onChangeText={setNewMember}
            onSubmitEditing={addMember}
            returnKeyType="done"
            style={{ marginBottom: 0 }}
          />
        </View>
      </Row>

      {/* ---- Expenses ---- */}
      <Row style={{ justifyContent: 'space-between', marginTop: spacing.lg, marginBottom: spacing.sm }}>
        <Text style={typography.heading}>Expenses</Text>
        <Pressable onPress={() => setShowAdd((v) => !v)} hitSlop={8}>
          <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600' }}>
            {showAdd ? 'Cancel' : '+ Add'}
          </Text>
        </Pressable>
      </Row>

      {showAdd ? (
        <AddExpense
          trip={trip}
          members={members}
          onDone={() => setShowAdd(false)}
        />
      ) : null}

      {expenses.length === 0 ? (
        <Muted>No expenses yet. Add the first one and the balances update for everyone.</Muted>
      ) : (
        expenses.map((expense) => (
          <Card key={expense.id}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={typography.body}>{expense.description}</Text>
                <Text style={typography.tiny}>
                  {nameOf(expense.paidBy)} paid · {relativeDay(expense.spentAt)} ·{' '}
                  {expense.splits.length} way{expense.splits.length === 1 ? '' : 's'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={typography.subheading}>
                  {formatCents(expense.amountCents, expense.currency)}
                </Text>
                {expense.currency !== trip.currency ? (
                  <Text style={typography.tiny}>
                    ≈{' '}
                    {formatCents(
                      Math.round((expense.amountCents / 100) * expense.rateToTrip * 100),
                      trip.currency,
                    )}
                  </Text>
                ) : null}
              </View>
            </Row>
            <Pressable
              hitSlop={8}
              style={{ marginTop: spacing.xs }}
              onPress={() =>
                Alert.alert('Delete this expense?', expense.description, [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => store.remove('expenses', expense.id),
                  },
                ])
              }
            >
              <Text style={{ color: colors.textFaint, fontSize: 12 }}>Delete</Text>
            </Pressable>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

/** The add-expense form: amount, who paid, and who it was for. */
function AddExpense({
  trip,
  members,
  onDone,
}: {
  trip: Trip;
  members: TripMember[];
  onDone: () => void;
}) {
  const store = useStore();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState<string>(
    members.find((m) => m.userId === store.user?.id)?.id ?? members[0]?.id ?? '',
  );
  const [mode, setMode] = useState<SplitMode>('equal');
  const [participants, setParticipants] = useState<string[]>(members.map((m) => m.id));

  function toggleParticipant(memberId: string) {
    setParticipants((current) =>
      current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId],
    );
  }

  function save() {
    const cents = parseAmountToCents(amount, trip.currency);
    if (!cents || cents <= 0) return Alert.alert('Enter an amount', 'How much was it?');
    if (!description.trim()) return Alert.alert('What was it for?', 'Give the expense a name.');
    if (participants.length === 0) return Alert.alert('Who was it for?', 'Pick at least one person.');
    if (!paidBy) return Alert.alert('Who paid?', 'Pick who put the money down.');

    store.upsert('expenses', {
      id: newId('exp'),
      tripId: trip.id,
      description: description.trim(),
      amountCents: cents,
      currency: trip.currency,
      rateToTrip: 1,
      paidBy,
      spentAt: Date.now(),
      category: null,
      splitMode: mode,
      splits: participants.map((memberId) => ({ memberId })),
      note: null,
    });

    setDescription('');
    setAmount('');
    onDone();
  }

  return (
    <Card>
      <Field placeholder="What was it?" value={description} onChangeText={setDescription} />
      <Field
        placeholder={`Amount in ${trip.currency}`}
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
      />

      <Text style={[typography.small, { marginBottom: spacing.xs }]}>Paid by</Text>
      <Row style={{ flexWrap: 'wrap', marginBottom: spacing.md }} gap={spacing.xs}>
        {members.map((member) => (
          <Chip
            key={member.id}
            label={member.name}
            selected={paidBy === member.id}
            onPress={() => setPaidBy(member.id)}
          />
        ))}
      </Row>

      <Text style={[typography.small, { marginBottom: spacing.xs }]}>Split between</Text>
      <Row style={{ flexWrap: 'wrap', marginBottom: spacing.md }} gap={spacing.xs}>
        {members.map((member) => (
          <Chip
            key={member.id}
            label={member.name}
            selected={participants.includes(member.id)}
            onPress={() => toggleParticipant(member.id)}
          />
        ))}
      </Row>

      <Row style={{ marginBottom: spacing.md }} gap={spacing.xs}>
        <Chip label="Evenly" selected={mode === 'equal'} onPress={() => setMode('equal')} />
        <Chip label="By shares" selected={mode === 'shares'} onPress={() => setMode('shares')} />
      </Row>

      <Button label="Add expense" onPress={save} />
    </Card>
  );
}

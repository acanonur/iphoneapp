/**
 * Money — shared costs, split fairly.
 *
 * A ledger is a list of who paid for what and who it was for. One of them is
 * the **Everyday** ledger, for the running costs of living together — the
 * groceries one of you paid for, the electricity bill — and the rest are trips
 * and one-offs with friends. They are the same thing underneath (a `Trip`),
 * which is why a holiday and the household settle up with the same arithmetic.
 */

import { useMemo, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore, selectAll } from '../../src/store/useStore.js';
import { newId } from '../../src/util/id.js';
import { summarizeTrip, personalView } from '../../../shared/src/split.js';
import { formatCents } from '../../../shared/src/money.js';
import type { Expense, Settlement, Trip, TripMember } from '../../../shared/src/types.js';
import { Button, Card, Field, Kicker, Muted, NoticeCard, Row, ScreenHeader } from '../../src/ui/components.js';
import { colors, fonts, relativeDay, spacing, typography } from '../../src/ui/theme.js';

/** The name that marks the household's running ledger. */
const EVERYDAY = 'Everyday';

export default function MoneyScreen() {
  const store = useStore();
  const router = useRouter();
  const [name, setName] = useState('');

  const trips = selectAll<Trip>(store, 'trips');
  const members = selectAll<TripMember>(store, 'tripMembers');
  const expenses = selectAll<Expense>(store, 'expenses');
  const settlements = selectAll<Settlement>(store, 'settlements');

  const rows = useMemo(
    () =>
      trips
        .filter((t) => !t.archived)
        .sort(
          (a, b) =>
            Number(b.name === EVERYDAY) - Number(a.name === EVERYDAY) ||
            (b.startsAt ?? b.updatedAt) - (a.startsAt ?? a.updatedAt),
        )
        .map((trip) => {
          const tripMembers = members.filter((m) => m.tripId === trip.id);
          const summary = summarizeTrip(
            tripMembers,
            expenses.filter((e) => e.tripId === trip.id),
            settlements.filter((s) => s.tripId === trip.id),
            trip.currency,
          );
          const me = tripMembers.find((m) => m.userId === store.user?.id);
          return {
            trip,
            memberCount: tripMembers.length,
            summary,
            myNet: me ? personalView(summary, me.id).netCents : null,
          };
        }),
    [trips, members, expenses, settlements, store.user?.id],
  );

  const hasEveryday = trips.some((t) => !t.archived && t.name === EVERYDAY);

  function createTrip(preset?: string) {
    const title = (preset ?? name).trim();
    if (!title) return;

    const tripId = newId('trip');
    store.upsert('trips', {
      id: tripId,
      name: title,
      currency: store.space?.baseCurrency ?? 'EUR',
      startsAt: null,
      endsAt: null,
      notes: null,
      archived: false,
    });

    // Everyone in the household joins by default; other friends get added in
    // the trip itself.
    for (const member of store.members) {
      store.upsert('tripMembers', {
        id: newId('tm'),
        tripId,
        name: member.name,
        userId: member.id,
        color: member.color,
      });
    }

    setName('');
    router.push(`/trip/${tripId}`);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'left', 'right']}>
      <ScreenHeader
        title="Money"
        members={store.members.map((m) => ({ id: m.id, name: m.name, color: m.color }))}
      />
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
        keyboardShouldPersistTaps="handled"
      >
        {hasEveryday ? null : (
          <NoticeCard kicker="Everyday costs">
            <Muted>
              One running ledger for the household — groceries, bills, the takeaway one of you paid
              for. Log it as it happens and settle up whenever you like.
            </Muted>
            <Button
              label="Start the everyday ledger"
              onPress={() => createTrip(EVERYDAY)}
              style={{ marginTop: spacing.sm, alignSelf: 'flex-start' }}
            />
          </NoticeCard>
        )}

        <Field
          placeholder="New ledger — “Antalya with the gang”"
          value={name}
          onChangeText={setName}
          onSubmitEditing={() => createTrip()}
          returnKeyType="done"
        />

        {rows.length > 0 ? <Kicker style={{ marginBottom: spacing.sm }}>Ledgers</Kicker> : null}

        {rows.length === 0 ? (
          <Card>
            <Text style={typography.subheading}>No ledgers yet</Text>
            <Muted>
              Make one for a holiday, add whoever is coming — including friends who don’t use the app
              — and log what each person pays. Hane works out the fewest transfers that settle
              everyone up.
            </Muted>
          </Card>
        ) : (
          rows.map(({ trip, memberCount, summary, myNet }) => (
            <Card key={trip.id} onPress={() => router.push(`/trip/${trip.id}`)}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={[typography.subheading, { flex: 1 }]} numberOfLines={1}>
                  {trip.name}
                </Text>
                <Text style={typography.small}>{formatCents(summary.totalCents, trip.currency)}</Text>
              </Row>

              <Row style={{ justifyContent: 'space-between', marginTop: spacing.xs }}>
                <Muted>
                  {memberCount} people
                  {trip.startsAt ? ` · ${relativeDay(trip.startsAt)}` : ''}
                </Muted>
                {myNet !== null && myNet !== 0 ? (
                  <Text
                    style={{
                      fontFamily: fonts.headingSemi,
                      fontSize: 13,
                      color: myNet > 0 ? colors.success : colors.accent,
                    }}
                  >
                    {myNet > 0 ? 'you are owed ' : 'you owe '}
                    {formatCents(Math.abs(myNet), trip.currency)}
                  </Text>
                ) : (
                  <Text style={typography.tiny}>settled</Text>
                )}
              </Row>
            </Card>
          ))
        )}

        {name.trim() ? (
          <Button
            label="New ledger"
            variant="secondary"
            onPress={() => createTrip()}
            style={{ marginTop: spacing.sm }}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

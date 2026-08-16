/**
 * Trips — the "who paid for what on holiday" ledger.
 */

import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore, selectAll } from '../../src/store/useStore.js';
import { newId } from '../../src/util/id.js';
import { summarizeTrip, personalView } from '../../../shared/src/split.js';
import { formatCents } from '../../../shared/src/money.js';
import type { Expense, Settlement, Trip, TripMember } from '../../../shared/src/types.js';
import { Button, Card, Field, Muted, Row } from '../../src/ui/components.js';
import { colors, relativeDay, spacing, typography } from '../../src/ui/theme.js';

export default function TripsScreen() {
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
        .sort((a, b) => (b.startsAt ?? b.updatedAt) - (a.startsAt ?? a.updatedAt))
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

  function createTrip() {
    const title = name.trim();
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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['left', 'right']}>
      <View style={{ flex: 1, padding: spacing.lg }}>
        <Field
          placeholder="New trip — “Antalya with the gang”"
          value={name}
          onChangeText={setName}
          onSubmitEditing={createTrip}
          returnKeyType="done"
        />

        {rows.length === 0 ? (
          <Card>
            <Text style={[typography.body, { marginBottom: spacing.sm }]}>No trips yet.</Text>
            <Muted>
              Make one for a holiday, add whoever is coming — including friends who don’t use the app
              — and log what each person pays. Ortak works out the fewest transfers that settle
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
                      fontSize: 13,
                      fontWeight: '600',
                      color: myNet > 0 ? colors.success : colors.warning,
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

        {rows.length > 0 ? (
          <Button
            label="New trip"
            variant="secondary"
            onPress={createTrip}
            style={{ marginTop: spacing.md }}
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

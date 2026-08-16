/**
 * Settings: the invite code, which calendar shared plans go into, and the
 * shortcut/Mac details for getting notes into Apple Notes.
 */

import { useEffect, useState } from 'react';
import { Alert, Pressable, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useStore, pendingCount } from '../src/store/useStore.js';
import {
  listWritableCalendars,
  loadCalendarSettings,
  saveCalendarSettings,
  suggestDefaultCalendar,
  type CalendarChoice,
  type CalendarSettings,
} from '../src/calendar/deviceCalendar.js';
import { Avatar, Button, Card, Chip, Divider, Field, Muted, Row, Screen } from '../src/ui/components.js';
import { colors, shortDateTime, spacing, typography } from '../src/ui/theme.js';

export default function SettingsScreen() {
  const store = useStore();
  const router = useRouter();

  const [calendars, setCalendars] = useState<CalendarChoice[]>([]);
  const [settings, setSettings] = useState<CalendarSettings | null>(null);
  const [loadingCalendars, setLoadingCalendars] = useState(true);
  const [name, setName] = useState(store.user?.name ?? '');

  useEffect(() => {
    void (async () => {
      const stored = await loadCalendarSettings();
      const available = await listWritableCalendars();
      setCalendars(available);

      // First run: preselect the phone's own default so there is nothing to do.
      if (!stored.calendarId && available.length > 0) {
        const suggested = await suggestDefaultCalendar();
        const next = { ...stored, calendarId: suggested };
        await saveCalendarSettings(next);
        setSettings(next);
      } else {
        setSettings(stored);
      }
      setLoadingCalendars(false);
    })();
  }, []);

  async function update(patch: Partial<CalendarSettings>) {
    if (!settings) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    await saveCalendarSettings(next);
  }

  const queued = pendingCount(store);

  return (
    <Screen scroll>
      {/* ---- Space ---- */}
      <Text style={typography.heading}>{store.space?.name ?? 'Your space'}</Text>
      <Muted>
        {store.online ? 'Connected' : 'Offline'}
        {store.lastSyncAt ? ` · last synced ${shortDateTime(store.lastSyncAt)}` : ''}
        {queued > 0 ? ` · ${queued} waiting` : ''}
      </Muted>

      <Card style={{ marginTop: spacing.md }}>
        <Text style={[typography.small, { marginBottom: spacing.sm }]}>Members</Text>
        {store.members.map((member) => (
          <Row key={member.id} style={{ marginBottom: spacing.xs }}>
            <Avatar name={member.name} color={member.color} size={24} />
            <Text style={typography.body}>{member.name}</Text>
            {member.id === store.user?.id ? <Text style={typography.tiny}>(you)</Text> : null}
          </Row>
        ))}

        <Divider />

        <Text style={[typography.small, { marginBottom: spacing.xs }]}>Invite code</Text>
        <Pressable
          onPress={async () => {
            if (store.space?.inviteCode) {
              await Clipboard.setStringAsync(store.space.inviteCode);
              Alert.alert('Copied', 'Send it to the other phone — they enter it when setting up.');
            }
          }}
        >
          <Text style={[typography.heading, { letterSpacing: 2, color: colors.accent }]}>
            {store.space?.inviteCode ?? '—'}
          </Text>
        </Pressable>
        <Muted>Tap to copy. Anyone with this code and your server address can join.</Muted>

        <Button
          label="Rotate code"
          variant="ghost"
          style={{ marginTop: spacing.sm }}
          onPress={() =>
            Alert.alert(
              'Rotate the invite code?',
              'The old code stops working. Do this once you have both joined.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Rotate',
                  onPress: async () => {
                    try {
                      await store.api().rotateInvite();
                      await store.refreshMembers();
                    } catch {
                      Alert.alert('Could not rotate', 'Check your connection and try again.');
                    }
                  },
                },
              ],
            )
          }
        />
      </Card>

      <Field
        label="Your name"
        value={name}
        onChangeText={setName}
        onEndEditing={async () => {
          if (name.trim() && name.trim() !== store.user?.name) {
            try {
              await store.api().rename(name.trim());
              await store.refreshMembers();
            } catch {
              // Not worth an alert; it will be retried next time.
            }
          }
        }}
      />

      {/* ---- Calendar ---- */}
      <Text style={[typography.heading, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>
        Calendar
      </Text>

      <Card>
        <Muted>
          Pick where shared plans should land on this phone. Whatever you choose here syncs onward
          through that account, so an event added by either of you turns up in your own calendar,
          your Mac and your watch.
        </Muted>

        {loadingCalendars ? (
          <Muted>Looking for calendars…</Muted>
        ) : calendars.length === 0 ? (
          <View style={{ marginTop: spacing.md }}>
            <Muted>
              No writable calendars found. Ortak needs calendar permission — check your phone’s
              privacy settings for Ortak.
            </Muted>
          </View>
        ) : (
          <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
            {calendars.map((calendar) => (
              <Pressable
                key={calendar.id}
                onPress={() => void update({ calendarId: calendar.id })}
                style={{
                  padding: spacing.md,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor:
                    settings?.calendarId === calendar.id ? colors.accent : colors.border,
                  backgroundColor:
                    settings?.calendarId === calendar.id ? colors.accentSoft : 'transparent',
                }}
              >
                <Row>
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: calendar.color,
                    }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={typography.body}>{calendar.title}</Text>
                    <Text style={typography.tiny}>{calendar.sourceLabel}</Text>
                  </View>
                </Row>
              </Pressable>
            ))}
          </View>
        )}

        <Divider />

        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={typography.body}>Copy plans automatically</Text>
            <Muted>Off means you tap “Sync now” on the calendar tab yourself.</Muted>
          </View>
          <Switch
            value={settings?.autoMirror ?? true}
            onValueChange={(value) => void update({ autoMirror: value })}
            trackColor={{ true: colors.accent, false: colors.border }}
          />
        </Row>

        <Divider />

        <Text style={[typography.small, { marginBottom: spacing.xs }]}>Default reminder</Text>
        <Row style={{ flexWrap: 'wrap' }} gap={spacing.xs}>
          {[null, 10, 30, 60, 1440].map((minutes) => (
            <Chip
              key={String(minutes)}
              label={
                minutes === null
                  ? 'None'
                  : minutes >= 1440
                    ? '1 day'
                    : minutes >= 60
                      ? '1 hour'
                      : `${minutes} min`
              }
              selected={settings?.defaultReminderMinutes === minutes}
              onPress={() => void update({ defaultReminderMinutes: minutes })}
            />
          ))}
        </Row>
      </Card>

      {/* ---- Notes ---- */}
      <Text style={[typography.heading, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>
        Apple Notes
      </Text>
      <Card>
        <Muted>
          iOS gives no app write access to Apple Notes, so Ortak keeps the shared copy and exports on
          demand. Any note has an Export button; for one-tap or automatic export, the README has a
          Shortcut recipe and a Mac script that writes straight into a Notes folder.
        </Muted>
        <Text style={[typography.tiny, { marginTop: spacing.sm }]} selectable>
          Server: {store.serverUrl || '—'}
        </Text>
      </Card>

      {/* ---- Archive ---- */}
      <Text style={[typography.heading, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>
        Chat archive
      </Text>
      <Card>
        <Muted>
          Import a WhatsApp chat and it becomes permanently searchable. Re-importing the same chat
          later only adds what is new.
        </Muted>
        <Button
          label="Import a chat export"
          variant="secondary"
          style={{ marginTop: spacing.md }}
          onPress={() => router.push('/import')}
        />
      </Card>

      <Button
        label="Sign out on this phone"
        variant="ghost"
        style={{ marginTop: spacing.xl }}
        onPress={() =>
          Alert.alert(
            'Sign out?',
            queued > 0
              ? `${queued} change${queued === 1 ? '' : 's'} haven’t synced yet and will be lost.`
              : 'Your data stays on the server. You can rejoin with the invite code.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Sign out',
                style: 'destructive',
                onPress: () => void store.signOut(),
              },
            ],
          )
        }
      />
    </Screen>
  );
}

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
  listReminderLists,
  loadCalendarSettings,
  publishAvailability,
  remindersSupported,
  saveCalendarSettings,
  suggestDefaultCalendar,
  type CalendarChoice,
  type CalendarSettings,
  type ReminderList,
} from '../src/calendar/deviceCalendar.js';
import { MemberSquare, Button, Card, Tag, Divider, Field, Muted, Row, Screen } from '../src/ui/components.js';
import { colors, shortDateTime, spacing, typography } from '../src/ui/theme.js';

export default function SettingsScreen() {
  const store = useStore();
  const router = useRouter();

  const [calendars, setCalendars] = useState<CalendarChoice[]>([]);
  const [settings, setSettings] = useState<CalendarSettings | null>(null);
  const [loadingCalendars, setLoadingCalendars] = useState(true);
  const [name, setName] = useState(store.user?.name ?? '');
  const [reminderLists, setReminderLists] = useState<ReminderList[]>([]);
  const [publishing, setPublishing] = useState(false);

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
            <MemberSquare name={member.name} color={member.color} size={24} />
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
                    settings?.calendarId === calendar.id ? colors.accent : colors.divider,
                  backgroundColor:
                    settings?.calendarId === calendar.id ? colors.accent100 : 'transparent',
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
            trackColor={{ true: colors.accent, false: colors.divider }}
          />
        </Row>

        <Divider />

        <Text style={[typography.small, { marginBottom: spacing.xs }]}>Default reminder</Text>
        <Row style={{ flexWrap: 'wrap' }} gap={spacing.xs}>
          {[null, 10, 30, 60, 1440].map((minutes) => (
            <Tag
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

      {/* ---- Availability ---- */}
      <Text style={[typography.heading, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>
        Sharing when you're busy
      </Text>

      <Card>
        <Muted>
          The other half of calendar sync. Pick which of your own calendars Ortak may read, and the
          app can tell you when the two of you are both actually free instead of only writing events
          out. Nothing here leaves your server.
        </Muted>

        {calendars.length === 0 ? null : (
          <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
            {calendars.map((calendar) => {
              const sharing = settings?.availabilityCalendarIds.includes(calendar.id) ?? false;
              return (
                <Pressable
                  key={`avail-${calendar.id}`}
                  onPress={() => {
                    const current = settings?.availabilityCalendarIds ?? [];
                    void update({
                      availabilityCalendarIds: sharing
                        ? current.filter((id) => id !== calendar.id)
                        : [...current, calendar.id],
                    });
                  }}
                  style={{
                    padding: spacing.md,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: sharing ? colors.accent : colors.divider,
                    backgroundColor: sharing ? colors.accent100 : 'transparent',
                  }}
                >
                  <Row>
                    <Text style={{ fontSize: 15 }}>{sharing ? '✓' : '○'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={typography.body}>{calendar.title}</Text>
                      <Text style={typography.tiny}>{calendar.sourceLabel}</Text>
                    </View>
                  </Row>
                </Pressable>
              );
            })}
          </View>
        )}

        <Divider />

        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={typography.body}>Also share what it is</Text>
            <Muted>Off means the other phone sees only that you're busy, not the titles.</Muted>
          </View>
          <Switch
            value={settings?.shareBusyTitles ?? false}
            onValueChange={(value) => void update({ shareBusyTitles: value })}
            trackColor={{ true: colors.accent, false: colors.divider }}
          />
        </Row>

        {(settings?.availabilityCalendarIds.length ?? 0) > 0 ? (
          <>
            <Button
              label="Update now"
              variant="secondary"
              busy={publishing}
              style={{ marginTop: spacing.md }}
              onPress={async () => {
                if (!settings) return;
                setPublishing(true);
                const report = await publishAvailability(store.api(), settings);
                setPublishing(false);
                Alert.alert(
                  'Availability shared',
                  report.blocked === 'permission'
                    ? 'Ortak needs calendar permission to read your calendars.'
                    : `${report.published} entr${report.published === 1 ? 'y' : 'ies'} read` +
                      (report.removed > 0 ? `, ${report.removed} no longer there.` : '.'),
                );
              }}
            />
            <Button
              label="Stop sharing"
              variant="ghost"
              onPress={() =>
                Alert.alert('Stop sharing your availability?', 'Everything already shared is removed.', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Stop',
                    style: 'destructive',
                    onPress: async () => {
                      await update({ availabilityCalendarIds: [] });
                      try {
                        await store.api().stopSharingAvailability();
                        await store.sync({ force: true });
                      } catch {
                        // It will be cleared on the next successful publish.
                      }
                    },
                  },
                ])
              }
            />
          </>
        ) : null}
      </Card>

      {/* ---- Reminders ---- */}
      {remindersSupported() ? (
        <>
          <Text style={[typography.heading, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>
            Apple Reminders
          </Text>
          <Card>
            <Muted>
              Apple Notes has no API, but Reminders does — so shared to-dos can be copied into a real
              Reminders list, where Siri and your watch can see them. One direction: Ortak stays the
              shared original.
            </Muted>

            {reminderLists.length === 0 ? (
              <Button
                label="Choose a list"
                variant="secondary"
                style={{ marginTop: spacing.md }}
                onPress={async () => {
                  const lists = await listReminderLists();
                  setReminderLists(lists);
                  if (lists.length === 0) {
                    Alert.alert(
                      'No reminder lists',
                      'Ortak needs permission to use Reminders. Turn it on in your phone’s settings.',
                    );
                  }
                }}
              />
            ) : (
              <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
                {reminderLists.map((list) => (
                  <Pressable
                    key={list.id}
                    onPress={() => void update({ reminderListId: list.id })}
                    style={{
                      padding: spacing.md,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: settings?.reminderListId === list.id ? colors.accent : colors.divider,
                      backgroundColor:
                        settings?.reminderListId === list.id ? colors.accent100 : 'transparent',
                    }}
                  >
                    <Text style={typography.body}>{list.title}</Text>
                    <Text style={typography.tiny}>{list.sourceLabel}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </Card>
        </>
      ) : null}

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

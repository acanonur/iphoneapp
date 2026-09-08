/**
 * First run: point the app at a server, then either start a household or join
 * the one the other person already made.
 */

import { useState } from 'react';
import { Text, View } from 'react-native';
import { useStore } from '../src/store/useStore.js';
import { ApiError, OrtakApi, normaliseServerUrl } from '../src/api/client.js';
import { Button, Card, Field, Muted, Row, Screen, Title, Tag } from '../src/ui/components.js';
import { colors, spacing, typography } from '../src/ui/theme.js';

type Mode = 'create' | 'join';

export default function Onboarding() {
  const signIn = useStore((s) => s.signIn);

  const [mode, setMode] = useState<Mode>('create');
  const [serverUrl, setServerUrl] = useState('');
  const [userName, setUserName] = useState('');
  const [spaceName, setSpaceName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);

    const url = normaliseServerUrl(serverUrl);
    if (!url) return setError('Enter the address of your Ortak server.');
    if (!userName.trim()) return setError('Enter your name.');
    if (mode === 'create' && !spaceName.trim()) return setError('Give your shared space a name.');
    if (mode === 'join' && !inviteCode.trim()) return setError('Enter the invite code.');

    setBusy(true);
    try {
      const api = new OrtakApi(url);
      // Fail fast with a clear message rather than a confusing 404 later.
      await api.health();

      const session =
        mode === 'create'
          ? await api.createSpace({
              spaceName: spaceName.trim(),
              userName: userName.trim(),
              signupSecret: secret.trim() || undefined,
            })
          : await api.joinSpace({
              inviteCode: inviteCode.trim().toUpperCase(),
              userName: userName.trim(),
              signupSecret: secret.trim() || undefined,
            });

      await signIn(session, url);
    } catch (e) {
      if (e instanceof ApiError) {
        setError(
          e.status === 0
            ? `Could not reach ${url}. Check the address and that the server is running.`
            : e.message,
        );
      } else {
        setError('Something went wrong. Try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scroll>
      <View style={{ marginTop: spacing.xxl }}>
        <Title>Ortak</Title>
        <Text style={[typography.body, { color: colors.textMuted, marginBottom: spacing.xl }]}>
          One shared calendar, list, notebook and expense pot for two people and two different
          phones.
        </Text>
      </View>

      <Field
        label="Server address"
        placeholder="https://ortak.example.com"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        value={serverUrl}
        onChangeText={setServerUrl}
        hint="Where your Ortak server runs. Both phones use the same address."
      />

      <Row style={{ marginBottom: spacing.lg }}>
        <Tag label="Start a new space" selected={mode === 'create'} onPress={() => setMode('create')} />
        <Tag label="Join with a code" selected={mode === 'join'} onPress={() => setMode('join')} />
      </Row>

      <Field
        label="Your name"
        placeholder="Onur"
        value={userName}
        onChangeText={setUserName}
        autoCapitalize="words"
      />

      {mode === 'create' ? (
        <Field
          label="Space name"
          placeholder="Ev"
          value={spaceName}
          onChangeText={setSpaceName}
          hint="Whatever you'd call the two of you — it only shows up in settings."
        />
      ) : (
        <Field
          label="Invite code"
          placeholder="ABCD-2345"
          value={inviteCode}
          onChangeText={setInviteCode}
          autoCapitalize="characters"
          autoCorrect={false}
          hint="From the other phone: Settings → Invite."
        />
      )}

      <Field
        label="Sign-up secret (optional)"
        placeholder="Only if your server asks for one"
        value={secret}
        onChangeText={setSecret}
        autoCapitalize="none"
        secureTextEntry
      />

      {error ? (
        <Card style={{ borderColor: colors.accent700 }}>
          <Text style={{ color: colors.accent700, fontSize: 14 }}>{error}</Text>
        </Card>
      ) : null}

      <Button
        label={mode === 'create' ? 'Create space' : 'Join space'}
        onPress={() => void submit()}
        busy={busy}
        style={{ marginTop: spacing.sm }}
      />

      <View style={{ marginTop: spacing.xl }}>
        <Muted>
          Ortak keeps your data on your own server. Nothing is sent anywhere else, and the calendar
          entries it creates go straight into the calendar app already on your phone.
        </Muted>
      </View>
    </Screen>
  );
}

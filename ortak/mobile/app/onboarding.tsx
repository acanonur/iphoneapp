/**
 * First run: start a project, or join one someone else started.
 *
 * The screen used to open with "Server address", which made the very first
 * question anyone was asked the one question a household cannot answer. It is
 * gone from the main path in both directions:
 *
 *  - **Joining** never needs it. The invite carries the address, so pasting the
 *    link someone sent fills in everything.
 *  - **Starting** takes it from `ORTAK_SERVER_URL` when the app was built with
 *    one. Otherwise it is asked for once, below the fold, phrased as where the
 *    project is kept rather than as a setting.
 */

import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import { useStore } from '../src/store/useStore.js';
import { ApiError, OrtakApi, normaliseServerUrl } from '../src/api/client.js';
import { parseJoinInput } from '../../shared/src/invite.js';
import { Button, Card, Field, Muted, Rule, Screen, Title } from '../src/ui/components.js';
import { colors, spacing, typography } from '../src/ui/theme.js';

type Mode = 'create' | 'join';

/** Baked in at build time by app.config.js, when ORTAK_SERVER_URL was set. */
function configuredServerUrl(): string {
  const value = Constants.expoConfig?.extra?.defaultServerUrl;
  return typeof value === 'string' ? value : '';
}

export default function Onboarding() {
  const signIn = useStore((s) => s.signIn);
  const params = useLocalSearchParams<{ code?: string; server?: string }>();

  const builtInServer = useMemo(configuredServerUrl, []);

  const [mode, setMode] = useState<Mode>('create');
  const [userName, setUserName] = useState('');
  const [spaceName, setSpaceName] = useState('');

  // What the person pasted on the join side — a link, a message, or a code.
  const [invite, setInvite] = useState('');

  // Only ever shown when we do not already know the answer.
  const [serverUrl, setServerUrl] = useState(builtInServer);
  const [showServer, setShowServer] = useState(false);
  const [secret, setSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedInvite = useMemo(() => parseJoinInput(invite), [invite]);

  // Arriving from a tapped ortak://join link.
  useEffect(() => {
    if (!params.code && !params.server) return;
    setMode('join');
    if (params.code) setInvite(String(params.code));
    if (params.server) setServerUrl(String(params.server));
  }, [params.code, params.server]);

  async function pasteInvite() {
    const text = await Clipboard.getStringAsync();
    if (text) setInvite(text);
  }

  /** The address to use, given everything we know. */
  function resolveServer(): string | null {
    if (mode === 'join' && parsedInvite.serverUrl) return parsedInvite.serverUrl;
    return normaliseServerUrl(serverUrl) || null;
  }

  async function submit() {
    setError(null);

    if (!userName.trim()) return setError('Enter your name.');

    if (mode === 'create' && !spaceName.trim()) {
      return setError('Give the project a name.');
    }

    let code: string | null = null;
    if (mode === 'join') {
      code = parsedInvite.inviteCode;
      if (!code) {
        return setError(
          invite.trim()
            ? "That doesn't look like an invite. Paste the whole message you were sent, or type the 8-character code."
            : 'Paste the invite you were sent.',
        );
      }
    }

    const url = resolveServer();
    if (!url) {
      setShowServer(true);
      return setError(
        mode === 'join'
          ? 'That invite has no address in it. Ask for the link, or fill in where the project is kept.'
          : 'Ortak needs somewhere to keep the project. Fill in the address of your server.',
      );
    }

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
              inviteCode: code!,
              userName: userName.trim(),
              signupSecret: secret.trim() || undefined,
            });

      await signIn(session, url);
    } catch (e) {
      if (e instanceof ApiError) {
        setError(
          e.status === 0
            ? `Could not reach ${url}. Check that the server is running and that both phones are on the same network.`
            : e.message,
        );
      } else {
        setError('Something went wrong. Try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  const serverKnown = Boolean(resolveServer());

  return (
    <Screen scroll>
      <View style={{ marginTop: spacing.xxl }}>
        <Title>Ortak</Title>
        <Text style={[typography.body, { color: colors.textMuted, marginBottom: spacing.xl }]}>
          One shared calendar, list, notebook and expense pot for two people and two different
          phones.
        </Text>
      </View>

      <Choice
        label="Start a project"
        detail="You set it up, then invite the other person."
        selected={mode === 'create'}
        onPress={() => {
          setMode('create');
          setError(null);
        }}
      />
      <Choice
        label="Join a project"
        detail="Someone sent you an invite."
        selected={mode === 'join'}
        onPress={() => {
          setMode('join');
          setError(null);
        }}
      />

      <Rule style={{ marginVertical: spacing.lg }} />

      <Field
        label="Your name"
        placeholder="Can"
        value={userName}
        onChangeText={setUserName}
        autoCapitalize="words"
      />

      {mode === 'create' ? (
        <Field
          label="Project name"
          placeholder="Ev"
          value={spaceName}
          onChangeText={setSpaceName}
          hint="Whatever you'd call the two of you."
        />
      ) : (
        <>
          <Field
            label="Invite"
            placeholder="Paste the message or link you were sent"
            value={invite}
            onChangeText={setInvite}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            hint={
              parsedInvite.inviteCode
                ? `Code ${parsedInvite.inviteCode}${
                    parsedInvite.serverUrl ? ' — address included' : ''
                  }`
                : 'A link, the whole message, or just the 8-character code.'
            }
          />
          <Button
            label="Paste from clipboard"
            variant="secondary"
            onPress={() => void pasteInvite()}
            style={{ marginBottom: spacing.md }}
          />
        </>
      )}

      {error ? (
        <Card style={{ borderColor: colors.accent700 }}>
          <Text style={{ color: colors.accent700, fontSize: 14 }}>{error}</Text>
        </Card>
      ) : null}

      <Button
        label={mode === 'create' ? 'Create project' : 'Join project'}
        onPress={() => void submit()}
        busy={busy}
        style={{ marginTop: spacing.sm }}
      />

      <Rule weight="row" style={{ marginTop: spacing.xl, marginBottom: spacing.md }} />

      {/*
        The address, and the optional sign-up secret, are kept out of the way.
        Neither is a question a household should be asked to start, and the join
        side normally never needs either.
      */}
      {showServer ? (
        <Field
          label="Where this is kept"
          placeholder="http://192.168.2.56:8788"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          value={serverUrl}
          onChangeText={setServerUrl}
          hint="The address of your Ortak server. Both phones talk to the same one."
        />
      ) : (
        <Disclosure
          label={serverKnown ? 'Change where this is kept' : 'Set where this is kept'}
          onPress={() => setShowServer(true)}
        />
      )}

      {showSecret ? (
        <Field
          label="Sign-up secret"
          placeholder="Only if your server asks for one"
          value={secret}
          onChangeText={setSecret}
          autoCapitalize="none"
          secureTextEntry
        />
      ) : (
        <Disclosure label="My server needs a sign-up secret" onPress={() => setShowSecret(true)} />
      )}

      <View style={{ marginTop: spacing.xl }}>
        <Muted>
          Ortak keeps your data on your own server. Nothing is sent anywhere else, and the calendar
          entries it creates go straight into the calendar app already on your phone.
        </Muted>
      </View>
    </Screen>
  );
}

/** One of the two ways in, as a full-width row rather than a chip. */
function Choice({
  label,
  detail,
  selected,
  onPress,
}: {
  label: string;
  detail: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        marginBottom: spacing.sm,
        backgroundColor: selected ? colors.text : colors.surface,
        borderLeftWidth: 3,
        borderLeftColor: selected ? colors.accent : 'transparent',
      }}
    >
      <Text
        style={[
          typography.body,
          { fontWeight: '600', color: selected ? colors.bg : colors.text },
        ]}
      >
        {label}
      </Text>
      <Text style={[typography.small, { color: selected ? colors.neutral300 : colors.textMuted }]}>
        {detail}
      </Text>
    </Pressable>
  );
}

/** A quiet link that reveals a field most people never need. */
function Disclosure({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ paddingVertical: spacing.sm }}>
      <Text style={[typography.small, { color: colors.accent }]}>{label}</Text>
    </Pressable>
  );
}

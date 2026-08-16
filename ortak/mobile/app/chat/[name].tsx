/**
 * Reading back one archived conversation.
 *
 * Paged backwards from the newest message, the way a chat app works, so opening
 * a five-year group chat doesn't try to load five years of it.
 */

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useStore } from '../../src/store/useStore.js';
import type { ArchiveMessageRow } from '../../src/api/client.js';
import { Button, Card, Muted, Row } from '../../src/ui/components.js';
import { colors, clockTime, relativeDay, spacing, typography } from '../../src/ui/theme.js';

const PAGE_SIZE = 80;

export default function ChatScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const chatName = typeof name === 'string' ? decodeURIComponent(name) : '';
  const navigation = useNavigation();
  const api = useStore((s) => s.api());

  const [messages, setMessages] = useState<ArchiveMessageRow[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    navigation.setOptions({ title: chatName || 'Chat' });
  }, [navigation, chatName]);

  const load = useCallback(
    async (before?: number) => {
      if (!chatName) return;
      setLoading(true);
      try {
        const result = await api.archiveMessages({
          chat: chatName,
          limit: PAGE_SIZE,
          before,
        });
        setMessages((current) =>
          before ? [...result.messages, ...current] : result.messages,
        );
        setHasMore(result.hasMore);
      } catch {
        // Leaves whatever is already on screen in place.
      } finally {
        setLoading(false);
      }
    },
    [chatName, api],
  );

  useEffect(() => {
    void load();
  }, [load]);

  let lastDay = '';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
    >
      {hasMore ? (
        <Button
          label={loading ? 'Loading…' : 'Load earlier messages'}
          variant="secondary"
          busy={loading}
          onPress={() => void load(messages[0]?.sentAt)}
          style={{ marginBottom: spacing.md }}
        />
      ) : null}

      {loading && messages.length === 0 ? <ActivityIndicator color={colors.accent} /> : null}

      {!loading && messages.length === 0 ? (
        <Muted>Nothing here. The archive may need a connection to load.</Muted>
      ) : null}

      {messages.map((message) => {
        const day = relativeDay(message.sentAt);
        const showDay = day !== lastDay;
        lastDay = day;

        if (message.kind === 'system') {
          return (
            <View key={message.id}>
              {showDay ? <DayDivider label={day} /> : null}
              <Text style={[typography.tiny, { textAlign: 'center', marginVertical: spacing.xs }]}>
                {message.body}
              </Text>
            </View>
          );
        }

        return (
          <View key={message.id}>
            {showDay ? <DayDivider label={day} /> : null}
            <Card style={{ marginBottom: spacing.xs }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={[typography.tiny, { color: colors.accent, fontWeight: '600' }]}>
                  {message.author ?? 'Unknown'}
                </Text>
                <Text style={typography.tiny}>{clockTime(message.sentAt)}</Text>
              </Row>
              <Text style={typography.body}>
                {message.kind === 'media'
                  ? `📎 ${message.mediaName ?? 'attachment (not exported)'}`
                  : message.kind === 'deleted'
                    ? '🚫 deleted message'
                    : message.body}
              </Text>
            </Card>
          </View>
        );
      })}
    </ScrollView>
  );
}

function DayDivider({ label }: { label: string }) {
  return (
    <Text
      style={[
        typography.tiny,
        { textAlign: 'center', marginTop: spacing.md, marginBottom: spacing.sm, color: colors.textMuted },
      ]}
    >
      {label}
    </Text>
  );
}

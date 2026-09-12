/**
 * The chat archive: imported WhatsApp conversations, kept so the useful bits
 * stop scrolling away.
 *
 * Unlike the rest of the app this tab talks to the server directly rather than
 * reading local state — a multi-year group chat is far too much to mirror onto
 * the phone, and searching it is a job the database does better anyway.
 */

import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../../src/store/useStore.js';
import type { ArchiveChat, SearchHit } from '../../src/api/client.js';
import { Button, Card, Field, Muted, Row } from '../../src/ui/components.js';
import { colors, relativeDay, spacing, typography } from '../../src/ui/theme.js';

export default function ArchiveScreen() {
  // Stable across renders, so the focus effect doesn't refetch on every sync.
  const api = useStore((s) => s.api());
  const router = useRouter();

  const [chats, setChats] = useState<ArchiveChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);

      void api
        .archiveChats()
        .then((r) => {
          if (!cancelled) setChats(r.chats);
        })
        .catch(() => undefined)
        .finally(() => {
          if (!cancelled) setLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }, [api]),
  );

  async function runSearch(text: string) {
    setQuery(text);
    if (!text.trim()) {
      setHits(null);
      return;
    }
    setSearching(true);
    try {
      const result = await api.search(text, { kinds: ['archiveMessages'], limit: 60 });
      setHits(result.hits);
    } catch {
      setHits([]);
    } finally {
      setSearching(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl * 2 }}
        keyboardShouldPersistTaps="handled"
      >
        <Field
          placeholder="Search every archived message"
          value={query}
          onChangeText={(t) => void runSearch(t)}
          autoCapitalize="none"
          hint="Works without Turkish characters too — “tesisatci” finds “tesisatçı”."
        />

        {searching ? <ActivityIndicator color={colors.accent} /> : null}

        {hits !== null ? (
          <View>
            <Text style={[typography.subheading, { marginBottom: spacing.sm }]}>
              {hits.length === 0 ? 'No matches' : `${hits.length} match${hits.length === 1 ? '' : 'es'}`}
            </Text>
            {hits.map((hit) => (
              <Card
                key={hit.entityId}
                onPress={() => router.push(`/chat/${encodeURIComponent(hit.title)}`)}
              >
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text style={typography.small}>{hit.context || hit.title}</Text>
                  <Text style={typography.tiny}>{relativeDay(hit.sortAt)}</Text>
                </Row>
                <Text style={[typography.body, { marginTop: spacing.xs }]} numberOfLines={3}>
                  {hit.snippet.replace(/⟦|⟧/g, '')}
                </Text>
              </Card>
            ))}
          </View>
        ) : (
          <View>
            <Row style={{ justifyContent: 'space-between', marginBottom: spacing.sm }}>
              <Text style={typography.heading}>Chats</Text>
              <Pressable onPress={() => router.push('/import')} hitSlop={8}>
                <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600' }}>Import</Text>
              </Pressable>
            </Row>

            {loading ? (
              <ActivityIndicator color={colors.accent} />
            ) : chats.length === 0 ? (
              <Card>
                <Text style={[typography.body, { marginBottom: spacing.sm }]}>
                  Nothing archived yet.
                </Text>
                <Muted>
                  In WhatsApp, open a chat → ⋮ (or the contact name on iOS) → Export chat → Without
                  media, then share the file into Ortak. Everything in it becomes searchable and
                  stops disappearing up the scrollback.
                </Muted>
                <Button
                  label="Import a chat"
                  onPress={() => router.push('/import')}
                  style={{ marginTop: spacing.md }}
                />
              </Card>
            ) : (
              chats.map((chat) => (
                <Card
                  key={chat.chatName}
                  onPress={() => router.push(`/chat/${encodeURIComponent(chat.chatName)}`)}
                >
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Text style={[typography.subheading, { flex: 1 }]} numberOfLines={1}>
                      {chat.chatName}
                    </Text>
                    {chat.starredCount > 0 ? (
                      <Text style={typography.tiny}>★ {chat.starredCount}</Text>
                    ) : null}
                  </Row>
                  <Muted>
                    {chat.messageCount.toLocaleString()} messages · {relativeDay(chat.firstAt)} –{' '}
                    {relativeDay(chat.lastAt)}
                  </Muted>
                </Card>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

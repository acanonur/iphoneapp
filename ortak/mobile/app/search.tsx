/**
 * Search across everything at once — the answer to "where did we write that
 * down?" when nobody remembers whether it was a note, a message or a link.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useStore } from '../src/store/useStore.js';
import type { SearchHit } from '../src/api/client.js';
import type { EntityKind } from '../../shared/src/types.js';
import { Card, Tag, Field, Muted, Row, Screen } from '../src/ui/components.js';
import { colors, relativeDay, spacing, typography } from '../src/ui/theme.js';

const FILTERS: { label: string; kinds: EntityKind[] | undefined }[] = [
  { label: 'Everything', kinds: undefined },
  { label: 'Messages', kinds: ['archiveMessages'] },
  { label: 'Notes', kinds: ['notes'] },
  { label: 'Links', kinds: ['links'] },
  { label: 'Plans', kinds: ['events'] },
  { label: 'To-dos', kinds: ['tasks'] },
  { label: 'Money', kinds: ['expenses', 'trips'] },
];

const KIND_LABELS: Record<string, string> = {
  events: '📅 Plan',
  notes: '📝 Note',
  tasks: '✅ To-do',
  shoppingItems: '🛒 Shopping',
  links: '🔗 Link',
  archiveMessages: '💬 Message',
  trips: '✈️ Trip',
  expenses: '💶 Expense',
};

export default function SearchScreen() {
  const api = useStore((s) => s.api());
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState(0);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  // Debounced so typing doesn't fire a request per keystroke.
  useEffect(() => {
    if (!query.trim()) {
      setHits([]);
      setTotal(0);
      setFailed(false);
      return undefined;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      setFailed(false);
      try {
        const result = await api.search(query, {
          kinds: FILTERS[filter]?.kinds,
          limit: 80,
        });
        setHits(result.hits);
        setTotal(result.total);
      } catch {
        setFailed(true);
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, filter, api]);

  function open(hit: SearchHit) {
    switch (hit.kind) {
      case 'notes':
        router.push(`/note/${hit.entityId}`);
        break;
      case 'archiveMessages':
        router.push(`/chat/${encodeURIComponent(hit.title)}`);
        break;
      case 'trips':
        router.push(`/trip/${hit.entityId}`);
        break;
      case 'events':
        router.push('/(tabs)/calendar');
        break;
      case 'tasks':
      case 'shoppingItems':
        router.push('/(tabs)/lists');
        break;
      case 'links':
        router.push('/(tabs)/notes');
        break;
      default:
        break;
    }
  }

  return (
    <Screen scroll>
      <Field
        placeholder="Search everything"
        value={query}
        onChangeText={setQuery}
        autoFocus
        autoCapitalize="none"
        hint="Turkish and German spellings are interchangeable — “sut” finds “süt”."
      />

      <Row style={{ flexWrap: 'wrap', marginBottom: spacing.md }} gap={spacing.xs}>
        {FILTERS.map((option, index) => (
          <Tag
            key={option.label}
            label={option.label}
            selected={filter === index}
            onPress={() => setFilter(index)}
          />
        ))}
      </Row>

      {loading ? <ActivityIndicator color={colors.accent} /> : null}

      {failed ? (
        <Card style={{ borderColor: colors.accent }}>
          <Muted>
            Search runs on your server, so it needs a connection. Your own notes and lists are still
            here offline.
          </Muted>
        </Card>
      ) : null}

      {!loading && query.trim() && hits.length === 0 && !failed ? (
        <Muted>Nothing matches “{query}”.</Muted>
      ) : null}

      {hits.length > 0 ? (
        <Text style={[typography.tiny, { marginBottom: spacing.sm }]}>
          {total > hits.length ? `Showing ${hits.length} of ${total}` : `${total} result${total === 1 ? '' : 's'}`}
        </Text>
      ) : null}

      {hits.map((hit) => (
        <Card key={`${hit.kind}-${hit.entityId}`} onPress={() => open(hit)}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={typography.tiny}>{KIND_LABELS[hit.kind] ?? hit.kind}</Text>
            <Text style={typography.tiny}>{relativeDay(hit.sortAt)}</Text>
          </Row>
          <Text style={[typography.subheading, { marginTop: spacing.xs }]} numberOfLines={1}>
            {hit.title || '(untitled)'}
          </Text>
          {hit.snippet ? (
            <Text style={[typography.small, { marginTop: spacing.xs }]} numberOfLines={3}>
              {hit.snippet.replace(/⟦|⟧/g, '')}
            </Text>
          ) : null}
          {hit.context ? <Text style={typography.tiny}>{hit.context}</Text> : null}
        </Card>
      ))}

      {!query.trim() ? (
        <View style={{ marginTop: spacing.lg }}>
          <Muted>
            One box over every plan, note, to-do, shopping item, saved link and archived WhatsApp
            message.
          </Muted>
        </View>
      ) : null}
    </Screen>
  );
}

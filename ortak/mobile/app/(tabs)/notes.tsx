/**
 * Shared notes, plus the saved-links shelf.
 *
 * Both live here because they are the same instinct — "keep this so we don't
 * lose it" — and separating them meant two half-empty tabs.
 */

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore, selectAll, memberName } from '../../src/store/useStore.js';
import { newId } from '../../src/util/id.js';
import type { LinkItem, NoteItem } from '../../../shared/src/types.js';
import { Card, Chip, Field, Muted, Row } from '../../src/ui/components.js';
import { colors, relativeDay, spacing, typography } from '../../src/ui/theme.js';

type Tab = 'notes' | 'links';

export default function NotesScreen() {
  const [tab, setTab] = useState<Tab>('notes');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['left', 'right']}>
      <View style={{ padding: spacing.lg, paddingBottom: 0 }}>
        <Row>
          <Chip label="Notes" selected={tab === 'notes'} onPress={() => setTab('notes')} />
          <Chip label="Links" selected={tab === 'links'} onPress={() => setTab('links')} />
        </Row>
      </View>
      {tab === 'notes' ? <NoteList /> : <LinkList />}
    </SafeAreaView>
  );
}

function NoteList() {
  const store = useStore();
  const router = useRouter();
  const [query, setQuery] = useState('');

  const notes = selectAll<NoteItem>(store, 'notes');

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return notes
      .filter(
        (n) =>
          !needle ||
          n.title.toLowerCase().includes(needle) ||
          n.body.toLowerCase().includes(needle),
      )
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);
  }, [notes, query]);

  function create() {
    const id = newId('note');
    store.upsert('notes', {
      id,
      title: '',
      body: '',
      tags: [],
      pinned: false,
      exportedAt: null,
    });
    router.push(`/note/${id}`);
  }

  return (
    <ScrollView
      contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl * 2 }}
      keyboardShouldPersistTaps="handled"
    >
      <Row style={{ marginBottom: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Field placeholder="Filter notes" value={query} onChangeText={setQuery} style={{ marginBottom: 0 }} />
        </View>
        <Pressable onPress={create} hitSlop={8} style={{ paddingHorizontal: spacing.sm }}>
          <Text style={{ fontSize: 26, color: colors.accent }}>＋</Text>
        </Pressable>
      </Row>

      {visible.length === 0 ? (
        <Muted>
          {query ? 'Nothing matches.' : 'No notes yet. Tap ＋ to write one — both of you can edit it.'}
        </Muted>
      ) : (
        visible.map((note) => (
          <Card key={note.id} onPress={() => router.push(`/note/${note.id}`)}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={[typography.subheading, { flex: 1 }]} numberOfLines={1}>
                {note.pinned ? '📌 ' : ''}
                {note.title || 'Untitled'}
              </Text>
              {note.exportedAt ? <Text style={typography.tiny}>exported</Text> : null}
            </Row>
            {note.body ? (
              <Text style={[typography.small, { marginTop: spacing.xs }]} numberOfLines={2}>
                {note.body}
              </Text>
            ) : null}
            <Text style={[typography.tiny, { marginTop: spacing.xs }]}>
              {relativeDay(note.updatedAt)} · {memberName(store, note.createdBy)}
            </Text>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

function LinkList() {
  const store = useStore();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);

  const links = selectAll<LinkItem>(store, 'links')
    .filter((l) => !l.archived)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  async function save() {
    const value = url.trim();
    if (!value) return;
    setBusy(true);

    const id = newId('link');
    // Save immediately so it works offline; the preview fills in afterwards.
    store.upsert('links', {
      id,
      url: value,
      title: null,
      description: null,
      imageUrl: null,
      siteName: null,
      tags: [],
      note: null,
      archived: false,
    });
    setUrl('');

    try {
      const preview = await store.api().linkPreview(value);
      store.upsert('links', {
        id,
        url: preview.url ?? value,
        title: preview.title,
        description: preview.description,
        imageUrl: preview.imageUrl,
        siteName: preview.siteName,
        tags: [],
        note: null,
        archived: false,
      });
    } catch {
      // The bare URL is still saved and searchable.
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl * 2 }}
      keyboardShouldPersistTaps="handled"
    >
      <Field
        placeholder="Paste a link"
        value={url}
        onChangeText={setUrl}
        onSubmitEditing={() => void save()}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        returnKeyType="done"
        hint={busy ? 'Fetching the title…' : undefined}
      />

      {links.length === 0 ? (
        <Muted>
          Nothing saved yet. Links shared into Ortak from any app land here too, and everything is
          searchable.
        </Muted>
      ) : (
        links.map((link) => (
          <Card key={link.id}>
            <Text style={typography.subheading} numberOfLines={2}>
              {link.title || link.url}
            </Text>
            {link.description ? (
              <Text style={[typography.small, { marginTop: spacing.xs }]} numberOfLines={2}>
                {link.description}
              </Text>
            ) : null}
            <Row style={{ justifyContent: 'space-between', marginTop: spacing.sm }}>
              <Text style={typography.tiny} numberOfLines={1}>
                {link.siteName || link.url}
              </Text>
              <Pressable onPress={() => store.remove('links', link.id)} hitSlop={8}>
                <Text style={{ color: colors.textFaint, fontSize: 12 }}>Remove</Text>
              </Pressable>
            </Row>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

/**
 * Shared notes and the saved-links shelf, in Modernist.
 *
 * The filter row pairs a full-width input with a 44px square primary button —
 * the system's icon button — and nested tags become the system's tags rather
 * than pills. Notes are ruled rows: an 800-weight title, two lines of preview,
 * then the meta line with the tag path in accent.
 */

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore, selectAll, memberName } from '../../src/store/useStore.js';
import { newId } from '../../src/util/id.js';
import { buildTagTree, expandedTags, plainText } from '../../../shared/src/tags.js';
import type { LinkItem, NoteItem } from '../../../shared/src/types.js';
import {
  Button,
  Field,
  Row,
  ScreenHeader,
  Seg,
  Tag,
} from '../../src/ui/components.js';
import { PinIcon, PlusIcon } from '../../src/ui/icons.js';
import { colors, fonts, relativeDay, rules, spacing, typography } from '../../src/ui/theme.js';

type Half = 'notes' | 'links';

export default function NotesScreen() {
  const [half, setHalf] = useState<Half>('notes');
  const store = useStore();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'left', 'right']}>
      <ScreenHeader
        title="Notes"
        members={store.members.map((m) => ({ id: m.id, name: m.name, color: m.color }))}
      />
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
        keyboardShouldPersistTaps="handled"
      >
        <Seg
          options={[
            { value: 'notes', label: 'Notes' },
            { value: 'links', label: 'Links' },
          ]}
          value={half}
          onChange={setHalf}
        />
        {half === 'notes' ? <NoteList /> : <LinkList />}
      </ScrollView>
    </SafeAreaView>
  );
}

function NoteList() {
  const store = useStore();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  const notes = selectAll<NoteItem>(store, 'notes');

  /** Every note's tags, expanded so a note under #ev/tamirat also counts as #ev. */
  const tagsByNote = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const note of notes) {
      map.set(note.id, expandedTags(`${note.title}\n${note.body}`));
    }
    return map;
  }, [notes]);

  const tagTree = useMemo(() => buildTagTree([...tagsByNote.values()]), [tagsByNote]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return notes
      .filter((n) => {
        if (tagFilter && !(tagsByNote.get(n.id) ?? []).includes(tagFilter)) return false;
        return (
          !needle ||
          n.title.toLowerCase().includes(needle) ||
          n.body.toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);
  }, [notes, query, tagFilter, tagsByNote]);

  function create() {
    const id = newId('note');
    store.upsert('notes', {
      id,
      title: '',
      body: '',
      tags: [],
      pinned: false,
      exportedAt: null,
      linkedEventId: null,
    });
    router.push(`/note/${id}`);
  }

  /** One chip per top-level tag plus its immediate children — deeper is noise in a row. */
  const chips = tagTree.flatMap((node) => [
    { path: node.path, label: `#${node.name}`, count: node.totalCount },
    ...node.children.map((child) => ({
      path: child.path,
      label: `#${node.name}/${child.name}`,
      count: child.totalCount,
    })),
  ]);

  return (
    <View>
      <Row style={{ marginTop: spacing.lg, alignItems: 'stretch' }} gap={spacing.sm}>
        <View style={{ flex: 1 }}>
          <Field
            placeholder="Filter notes"
            value={query}
            onChangeText={setQuery}
            containerStyle={{ marginBottom: 0 }}
          />
        </View>
        <Pressable
          onPress={create}
          accessibilityLabel="New note"
          style={({ pressed }) => [
            {
              width: 44,
              height: 44,
              backgroundColor: colors.accent,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <PlusIcon size={18} color={colors.bg} />
        </Pressable>
      </Row>

      {chips.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: spacing.md }}
          contentContainerStyle={{ gap: 6 }}
        >
          {chips.map((chip) => (
            <Tag
              key={chip.path}
              label={`${chip.label} ${chip.count}`}
              selected={tagFilter === chip.path}
              onPress={() => setTagFilter(tagFilter === chip.path ? null : chip.path)}
            />
          ))}
        </ScrollView>
      ) : null}

      {visible.length === 0 ? (
        <Text style={[typography.small, { marginTop: spacing.xl }]}>
          {tagFilter
            ? `Nothing tagged #${tagFilter}.`
            : query
              ? 'Nothing matches.'
              : 'No notes yet. Tap ＋ to write one — both of you can edit it. Use #ev/tamirat to file it and [[another note]] to link.'}
        </Text>
      ) : (
        <View
          style={{
            marginTop: spacing.md,
            borderTopWidth: rules.section,
            borderTopColor: colors.divider,
          }}
        >
          {visible.map((note) => {
            const tags = tagsByNote.get(note.id) ?? [];
            return (
              <Pressable
                key={note.id}
                onPress={() => router.push(`/note/${note.id}`)}
                style={styles.noteRow}
              >
                <Row gap={spacing.sm}>
                  {note.pinned ? <PinIcon size={14} color={colors.accent} /> : null}
                  <Text style={[styles.noteTitle, { flex: 1 }]} numberOfLines={1}>
                    {note.title || 'Untitled'}
                  </Text>
                  {note.exportedAt ? <Tag label="exported" variant="outline" /> : null}
                </Row>

                {note.body ? (
                  <Text style={[typography.small, { color: colors.neutral800 }]} numberOfLines={2}>
                    {plainText(note.body)}
                  </Text>
                ) : null}

                <Row gap={spacing.sm}>
                  <Text style={typography.tiny}>
                    {relativeDay(note.updatedAt)} · {memberName(store, note.createdBy)}
                  </Text>
                  {tags.length > 0 ? (
                    <Text style={[typography.tiny, { color: colors.accent700 }]} numberOfLines={1}>
                      #{tags[tags.length - 1]}
                    </Text>
                  ) : null}
                </Row>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

function LinkList() {
  const store = useStore();
  const api = useStore((s) => s.api());
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
      const preview = await api.linkPreview(value);
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
    <View>
      <Field
        label="Paste a link"
        placeholder="https://"
        value={url}
        onChangeText={setUrl}
        onSubmitEditing={() => void save()}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        returnKeyType="done"
        hint={busy ? 'Fetching the title…' : undefined}
        containerStyle={{ marginBottom: 0 }}
      />

      {links.length === 0 ? (
        <Text style={[typography.small, { marginTop: spacing.xl }]}>
          Nothing saved yet. Links shared into Ortak from any app land here too, and everything is
          searchable.
        </Text>
      ) : (
        <View
          style={{
            marginTop: spacing.lg,
            borderTopWidth: rules.section,
            borderTopColor: colors.divider,
          }}
        >
          {links.map((link) => (
            <View key={link.id} style={styles.noteRow}>
              <Text style={styles.noteTitle} numberOfLines={2}>
                {link.title || link.url}
              </Text>
              {link.description ? (
                <Text style={[typography.small, { color: colors.neutral800 }]} numberOfLines={2}>
                  {link.description}
                </Text>
              ) : null}
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={[typography.tiny, { flex: 1 }]} numberOfLines={1}>
                  {link.siteName || link.url}
                </Text>
                <Button
                  label="Remove"
                  variant="ghost"
                  onPress={() => store.remove('links', link.id)}
                  style={{ minHeight: 28 }}
                />
              </Row>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = {
  noteRow: {
    paddingVertical: spacing.md,
    gap: 4,
    borderBottomWidth: rules.row,
    borderBottomColor: colors.dividerSoft,
  },
  noteTitle: {
    fontFamily: fonts.heading,
    fontSize: 16,
    lineHeight: 20,
    color: colors.text,
  },
};

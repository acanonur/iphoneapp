/**
 * A single shared note, and the ways to get a copy of it into Apple Notes.
 */

import { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useStore, selectAll, memberName } from '../../src/store/useStore.js';
import { copyNote, noteTextUrl, openNotesApp, shareNote } from '../../src/notes/appleNotes.js';
import { newId } from '../../src/util/id.js';
import { parseTags, buildBacklinkIndex } from '../../../shared/src/tags.js';
import type { EventItem, NoteItem } from '../../../shared/src/types.js';
import { Button, Card, Chip, Field, Muted, Row } from '../../src/ui/components.js';
import { colors, relativeDay, clockTime, shortDateTime, spacing, typography } from '../../src/ui/theme.js';

export default function NoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const store = useStore();
  // Zustand actions keep a stable identity, so the debounce effect below is
  // driven purely by what the user typed.
  const upsert = useStore((s) => s.upsert);

  const note = id ? (store.entities.notes[id] as unknown as NoteItem | undefined) : undefined;

  const [title, setTitle] = useState(note?.title ?? '');
  const [body, setBody] = useState(note?.body ?? '');
  const [exporting, setExporting] = useState(false);
  const [linking, setLinking] = useState(false);

  const allNotes = selectAll<NoteItem>(store, 'notes');
  const events = selectAll<EventItem>(store, 'events');

  /** Tags written in the text itself, Bear-style. */
  const tags = useMemo(() => parseTags(`${title}\n${body}`), [title, body]);

  /**
   * Craft-style backlinks. Computed over every note rather than stored, so a
   * link starts working the moment the note it points at is created — and
   * stops if that note is renamed, which is the honest behaviour.
   */
  const links = useMemo(() => {
    const index = buildBacklinkIndex(
      allNotes.map((n) => ({ id: n.id, title: n.title, body: n.body })),
    );
    const byId = new Map(allNotes.map((n) => [n.id, n]));
    return {
      incoming: (index.incoming[id ?? ''] ?? []).map((n) => byId.get(n)).filter(Boolean) as NoteItem[],
      outgoing: (index.outgoing[id ?? ''] ?? []).map((n) => byId.get(n)).filter(Boolean) as NoteItem[],
      unresolved: index.unresolved[id ?? ''] ?? [],
    };
  }, [allNotes, id]);

  const linkedEvent = note?.linkedEventId
    ? events.find((e) => e.id === note.linkedEventId)
    : undefined;

  /** Events worth offering to attach a note to — around now, soonest first. */
  const linkableEvents = useMemo(
    () =>
      events
        .filter((e) => e.endsAt >= Date.now() - 7 * 24 * 3600_000)
        .sort((a, b) => a.startsAt - b.startsAt)
        .slice(0, 12),
    [events],
  );

  useEffect(() => {
    navigation.setOptions({ title: title.trim() || 'Note' });
  }, [navigation, title]);

  /**
   * Push edits into the store as they're typed, with a short debounce.
   *
   * Every keystroke would be a sync push; a second of quiet is enough to keep
   * the other phone feeling live without hammering the server.
   */
  useEffect(() => {
    if (!note) return;
    if (title === note.title && body === note.body) return;

    const timer = setTimeout(() => {
      upsert('notes', { ...note, id: note.id, title, body });
    }, 800);
    return () => clearTimeout(timer);
  }, [title, body, note, upsert]);

  if (!note || note.deleted) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.lg }}>
        <Muted>This note has been deleted.</Muted>
      </View>
    );
  }

  async function exportToNotes() {
    setExporting(true);
    const outcome = await shareNote({ id: note!.id, title, body });
    setExporting(false);

    if (outcome === 'shared') {
      store.upsert('notes', { ...note!, id: note!.id, exportedAt: Date.now() });
    } else if (outcome === 'failed') {
      Alert.alert('Could not open the share sheet', 'Try copying the note instead.');
    }
  }

  async function copy() {
    if (await copyNote({ id: note!.id, title, body })) {
      const opened = await openNotesApp();
      Alert.alert(
        'Copied',
        opened
          ? 'The note is on your clipboard — paste it into Notes.'
          : 'The note is on your clipboard.',
      );
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl * 2 }}
        keyboardShouldPersistTaps="handled"
      >
        <Field placeholder="Title" value={title} onChangeText={setTitle} style={{ fontSize: 18, fontWeight: '600' }} />
        <Field
          placeholder="Write anything. #ev/tamirat files it, [[another note]] links it."
          value={body}
          onChangeText={setBody}
          multiline
          style={{ minHeight: 220 }}
        />

        <Row style={{ marginBottom: spacing.md }}>
          <Chip
            label={note.pinned ? '📌 Pinned' : 'Pin'}
            selected={note.pinned}
            onPress={() => store.upsert('notes', { ...note, id: note.id, pinned: !note.pinned })}
          />
        </Row>

        {tags.length > 0 ? (
          <Row style={{ flexWrap: 'wrap', marginBottom: spacing.md }} gap={spacing.xs}>
            {tags.map((tag) => (
              <Chip key={tag.path} label={`#${tag.path}`} selected />
            ))}
          </Row>
        ) : null}

        <Muted>
          Last edited {shortDateTime(note.updatedAt)} · started by {memberName(store, note.createdBy)}
        </Muted>

        {/* ---- Linked calendar entry (Agenda's idea) ---- */}
        <Card style={{ marginTop: spacing.lg }}>
          <Text style={[typography.subheading, { marginBottom: spacing.sm }]}>Attached to</Text>

          {linkedEvent ? (
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={typography.body}>{linkedEvent.title}</Text>
                <Muted>
                  {relativeDay(linkedEvent.startsAt)}
                  {linkedEvent.allDay ? '' : ` · ${clockTime(linkedEvent.startsAt)}`}
                </Muted>
              </View>
              <Pressable
                onPress={() => store.upsert('notes', { ...note, id: note.id, linkedEventId: null })}
                hitSlop={8}
              >
                <Text style={{ color: colors.textFaint, fontSize: 12 }}>Detach</Text>
              </Pressable>
            </Row>
          ) : linking ? (
            <View style={{ gap: spacing.xs }}>
              {linkableEvents.length === 0 ? (
                <Muted>Nothing in the calendar to attach this to yet.</Muted>
              ) : (
                linkableEvents.map((event) => (
                  <Pressable
                    key={event.id}
                    onPress={() => {
                      store.upsert('notes', { ...note, id: note.id, linkedEventId: event.id });
                      setLinking(false);
                    }}
                    style={{
                      padding: spacing.md,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text style={typography.body}>{event.title}</Text>
                    <Text style={typography.tiny}>{relativeDay(event.startsAt)}</Text>
                  </Pressable>
                ))
              )}
              <Button label="Cancel" variant="ghost" onPress={() => setLinking(false)} />
            </View>
          ) : (
            <>
              <Muted>
                Tie this note to a calendar entry and it turns up with the day — prep before, and
                what was decided after.
              </Muted>
              <Button
                label="Attach to a calendar entry"
                variant="secondary"
                onPress={() => setLinking(true)}
                style={{ marginTop: spacing.sm }}
              />
            </>
          )}
        </Card>

        {/* ---- Backlinks ---- */}
        {links.incoming.length > 0 || links.outgoing.length > 0 || links.unresolved.length > 0 ? (
          <Card>
            <Text style={[typography.subheading, { marginBottom: spacing.sm }]}>Links</Text>

            {links.outgoing.length > 0 ? (
              <View style={{ marginBottom: spacing.sm }}>
                <Text style={typography.tiny}>Points at</Text>
                {links.outgoing.map((target) => (
                  <Pressable key={target.id} onPress={() => router.push(`/note/${target.id}`)} hitSlop={4}>
                    <Text style={{ color: colors.accent, fontSize: 14, paddingVertical: 2 }}>
                      → {target.title || 'Untitled'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {links.incoming.length > 0 ? (
              <View style={{ marginBottom: spacing.sm }}>
                <Text style={typography.tiny}>Linked from</Text>
                {links.incoming.map((source) => (
                  <Pressable key={source.id} onPress={() => router.push(`/note/${source.id}`)} hitSlop={4}>
                    <Text style={{ color: colors.accent, fontSize: 14, paddingVertical: 2 }}>
                      ← {source.title || 'Untitled'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {links.unresolved.length > 0 ? (
              <View>
                <Text style={typography.tiny}>Not written yet</Text>
                {links.unresolved.map((target) => (
                  <Pressable
                    key={target}
                    hitSlop={4}
                    onPress={() => {
                      // Create the missing note with that exact title, so the
                      // link resolves the moment you come back.
                      const newNoteId = newId('note');
                      store.upsert('notes', {
                        id: newNoteId,
                        title: target,
                        body: '',
                        tags: [],
                        pinned: false,
                        exportedAt: null,
                        linkedEventId: null,
                      });
                      router.push(`/note/${newNoteId}`);
                    }}
                  >
                    <Text style={{ color: colors.warning, fontSize: 14, paddingVertical: 2 }}>
                      + {target}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </Card>
        ) : null}

        <Card style={{ marginTop: spacing.lg }}>
          <Text style={[typography.subheading, { marginBottom: spacing.sm }]}>Send to Apple Notes</Text>
          <Muted>
            iOS doesn’t let any app write into Apple Notes directly — that’s an Apple restriction, not
            something Ortak can work around. These get a copy across in a couple of taps.
          </Muted>

          <Button
            label="Export…"
            onPress={() => void exportToNotes()}
            busy={exporting}
            style={{ marginTop: spacing.md }}
          />
          <Button label="Copy to clipboard" variant="secondary" onPress={() => void copy()} style={{ marginTop: spacing.sm }} />

          {store.serverUrl ? (
            <View style={{ marginTop: spacing.md }}>
              <Text style={typography.tiny} selectable>
                For a Shortcut or the Mac script: {noteTextUrl(store.serverUrl, note.id)}
              </Text>
            </View>
          ) : null}
        </Card>

        <Button
          label="Delete note"
          variant="ghost"
          style={{ marginTop: spacing.lg }}
          onPress={() =>
            Alert.alert('Delete this note?', title || 'Untitled', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () => {
                  store.remove('notes', note.id);
                  navigation.goBack();
                },
              },
            ])
          }
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

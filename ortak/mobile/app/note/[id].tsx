/**
 * A single shared note, and the ways to get a copy of it into Apple Notes.
 */

import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useStore, memberName } from '../../src/store/useStore.js';
import { copyNote, noteTextUrl, openNotesApp, shareNote } from '../../src/notes/appleNotes.js';
import type { NoteItem } from '../../../shared/src/types.js';
import { Button, Card, Chip, Field, Muted, Row } from '../../src/ui/components.js';
import { colors, shortDateTime, spacing, typography } from '../../src/ui/theme.js';

export default function NoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const store = useStore();
  // Zustand actions keep a stable identity, so the debounce effect below is
  // driven purely by what the user typed.
  const upsert = useStore((s) => s.upsert);

  const note = id ? (store.entities.notes[id] as unknown as NoteItem | undefined) : undefined;

  const [title, setTitle] = useState(note?.title ?? '');
  const [body, setBody] = useState(note?.body ?? '');
  const [exporting, setExporting] = useState(false);

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
          placeholder="Write anything — the other phone sees it as you type."
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

        <Muted>
          Last edited {shortDateTime(note.updatedAt)} · started by {memberName(store, note.createdBy)}
        </Muted>

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

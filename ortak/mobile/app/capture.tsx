/**
 * The landing pad for anything shared into Ortak from another app — a WhatsApp
 * message someone forwarded, a link, an address.
 *
 * Reached from the share sheet on both platforms, from an `ortak://save?text=…`
 * deep link (what the iOS Shortcut recipe uses), or by opening it and pasting.
 * A shared chat export skips this screen and goes straight to the importer.
 */

import { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useStore } from '../src/store/useStore.js';
import { newId } from '../src/util/id.js';
import { chatExportFile, classifyShare, extractUrl, useIncomingShare } from '../src/share/incoming.js';
import { Button, Card, Tag, Field, Muted, Row, Screen } from '../src/ui/components.js';
import { spacing, typography } from '../src/ui/theme.js';

type Destination = 'note' | 'link' | 'task' | 'shopping' | 'archive';

export default function CaptureScreen() {
  const store = useStore();
  const router = useRouter();
  const { payload, clear } = useIncomingShare();

  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState<Destination>('note');

  // Prefill from whatever was shared in.
  useEffect(() => {
    if (!payload) return;

    // A shared WhatsApp export is a whole conversation, not a note — hand it
    // straight to the importer, which knows how to preview and parse it.
    const exportFile = chatExportFile(payload);
    if (exportFile) {
      clear();
      router.replace({
        pathname: '/import',
        params: { fileUri: exportFile.path, fileName: exportFile.fileName },
      });
      return;
    }

    const body = [payload.text, payload.url].filter(Boolean).join('\n');
    setText(body);
    const guess = classifyShare(payload);
    setDestination(guess === 'chat-import' ? 'note' : guess);
    clear();
  }, [payload, clear, router]);

  async function paste() {
    const clipboard = await Clipboard.getStringAsync();
    if (clipboard) {
      setText(clipboard);
      setDestination(extractUrl(clipboard) && clipboard.length < 400 ? 'link' : 'note');
    }
  }

  function save() {
    const body = text.trim();
    if (!body) return;

    switch (destination) {
      case 'link': {
        const url = extractUrl(body) ?? body;
        const id = newId('link');
        store.upsert('links', {
          id,
          url,
          title: title.trim() || null,
          description: null,
          imageUrl: null,
          siteName: null,
          tags: [],
          note: body === url ? null : body,
          archived: false,
        });
        // Fill in the preview in the background; the link is already saved.
        void store
          .api()
          .linkPreview(url)
          .then((preview) =>
            store.upsert('links', {
              id,
              url: preview.url ?? url,
              title: title.trim() || preview.title,
              description: preview.description,
              imageUrl: preview.imageUrl,
              siteName: preview.siteName,
              tags: [],
              note: body === url ? null : body,
              archived: false,
            }),
          )
          .catch(() => undefined);
        break;
      }

      case 'note':
        store.upsert('notes', {
          id: newId('note'),
          title: title.trim() || body.split('\n')[0]!.slice(0, 60),
          body,
          tags: ['shared'],
          pinned: false,
          exportedAt: null,
        });
        break;

      case 'task':
        store.upsert('tasks', {
          id: newId('task'),
          title: title.trim() || body.slice(0, 120),
          notes: title.trim() ? body : null,
          dueAt: null,
          assigneeId: null,
          done: false,
          doneAt: null,
          doneBy: null,
          category: null,
          priority: 0,
          position: Date.now(),
        });
        break;

      case 'shopping':
        for (const line of body.split('\n').map((l) => l.trim()).filter(Boolean)) {
          store.upsert('shoppingItems', {
            id: newId('shop'),
            name: line.slice(0, 200),
            quantity: null,
            category: null,
            store: null,
            checked: false,
            checkedBy: null,
            checkedAt: null,
            priceCents: null,
            note: null,
            position: Date.now(),
            runId: null,
          });
        }
        break;

      case 'archive':
        // A single forwarded message, kept in the archive alongside imported
        // chats so one search covers both.
        store.upsert('archiveMessages', {
          id: newId('msg'),
          chatName: title.trim() || 'Saved messages',
          author: null,
          sentAt: Date.now(),
          body,
          kind: 'message',
          mediaName: null,
          source: 'share',
          importId: null,
          starred: true,
          tags: [],
        });
        break;
    }

    Alert.alert('Saved', 'Both of you can see it now.', [
      { text: 'Done', onPress: () => router.back() },
    ]);
  }

  return (
    <Screen scroll>
      <Text style={[typography.heading, { marginBottom: spacing.sm }]}>Save this</Text>

      <Row style={{ flexWrap: 'wrap', marginBottom: spacing.md }} gap={spacing.xs}>
        <Tag label="📝 Note" selected={destination === 'note'} onPress={() => setDestination('note')} />
        <Tag label="🔗 Link" selected={destination === 'link'} onPress={() => setDestination('link')} />
        <Tag label="✅ To-do" selected={destination === 'task'} onPress={() => setDestination('task')} />
        <Tag label="🛒 Shopping" selected={destination === 'shopping'} onPress={() => setDestination('shopping')} />
        <Tag label="💬 Keep message" selected={destination === 'archive'} onPress={() => setDestination('archive')} />
      </Row>

      <Field
        label={destination === 'archive' ? 'Which chat was it from?' : 'Title (optional)'}
        placeholder={destination === 'archive' ? 'Ev 🏠' : 'Give it a name'}
        value={title}
        onChangeText={setTitle}
      />

      <Field
        label="Content"
        placeholder="Paste or type anything"
        value={text}
        onChangeText={setText}
        multiline
        style={{ minHeight: 160 }}
      />

      <Row>
        <View style={{ flex: 1 }}>
          <Button label="Paste from clipboard" variant="secondary" onPress={() => void paste()} />
        </View>
      </Row>

      <Button label="Save" onPress={save} style={{ marginTop: spacing.md }} />

      {destination === 'shopping' ? (
        <Muted>Each line becomes its own item on the shopping list.</Muted>
      ) : destination === 'archive' ? (
        <Muted>
          Kept with your imported chats and searchable alongside them — handy for the one message
          worth remembering out of a whole group.
        </Muted>
      ) : null}

      <Card style={{ marginTop: spacing.lg }}>
        <Text style={[typography.small, { marginBottom: spacing.xs }]}>Getting here faster</Text>
        <Muted>
          Share into Ortak from any app on either phone — long-press a WhatsApp message, tap Share,
          pick Ortak. Sharing a whole exported chat opens the importer instead.
        </Muted>
      </Card>
    </Screen>
  );
}

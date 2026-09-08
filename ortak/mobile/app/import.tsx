/**
 * Importing a WhatsApp chat export.
 *
 * WhatsApp offers no API for reading personal chats — the Business API only
 * covers messages sent to a business number, and anything that drives WhatsApp
 * Web breaks their Terms of Service and risks the number being banned. The
 * export built into the app is the supported route, so that is the one this
 * screen walks through.
 *
 * The file is previewed before anything is written, because the one genuinely
 * ambiguous thing in the format is whether dates are day-first or month-first,
 * and getting that wrong would silently mis-date years of messages.
 */

import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useStore } from '../src/store/useStore.js';
import { ApiError, type ImportPreview } from '../src/api/client.js';
import { Button, Card, Chip, Muted, Row } from '../src/ui/components.js';
import { colors, relativeDay, spacing, typography } from '../src/ui/theme.js';

export default function ImportScreen() {
  const store = useStore();
  const router = useRouter();
  // Set when a chat export was shared into Ortak rather than picked by hand.
  const { fileUri, fileName } = useLocalSearchParams<{ fileUri?: string; fileName?: string }>();

  const [file, setFile] = useState<{ name: string; content: string } | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [dateOrder, setDateOrder] = useState<'dmy' | 'mdy' | null>(null);
  const [busy, setBusy] = useState(false);

  const utcOffsetMinutes = -new Date().getTimezoneOffset();

  /** Read a file and show the preview — shared by the picker and the share sheet. */
  const loadFile = useCallback(
    async (uri: string, name: string) => {
      setBusy(true);
      try {
        const content = await new File(uri).text();
        setFile({ name, content });

        const result = await store.api().previewImport({
          content,
          filename: name,
          utcOffsetMinutes,
        });
        setPreview(result);
        setDateOrder(result.dateOrder === 'ymd' ? null : result.dateOrder);
      } catch (error) {
        if (error instanceof ApiError && error.code === 'no_messages') {
          Alert.alert('Not a chat export', error.message);
        } else if (error instanceof ApiError && error.status === 0) {
          Alert.alert('No connection', 'Importing needs a connection to your server.');
        } else {
          Alert.alert('Could not read that file', 'Make sure it is the .txt from “Export chat”.');
        }
        setFile(null);
        setPreview(null);
      } finally {
        setBusy(false);
      }
    },
    [store, utcOffsetMinutes],
  );

  // Opened by sharing an export into Ortak: skip straight to the preview.
  useEffect(() => {
    if (!fileUri) return;
    void loadFile(fileUri, fileName || 'WhatsApp Chat.txt');
  }, [fileUri, fileName, loadFile]);

  async function pickFile() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['text/plain', 'application/zip', '*/*'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    if (asset.name.toLowerCase().endsWith('.zip')) {
      Alert.alert(
        'Export without media',
        'That looks like a zip. In WhatsApp choose “Without media” when exporting, which gives a plain .txt file.',
      );
      return;
    }

    await loadFile(asset.uri, asset.name);
  }

  async function confirmImport() {
    if (!file || !preview) return;
    setBusy(true);
    try {
      const result = await store.api().runImport({
        content: file.content,
        filename: file.name,
        chatName: preview.chatName,
        utcOffsetMinutes,
        dateOrder: dateOrder ?? preview.dateOrder,
      });
      await store.sync({ force: true });

      Alert.alert(
        'Imported',
        `${result.addedCount.toLocaleString()} new message${result.addedCount === 1 ? '' : 's'} archived from ${result.chatName}.` +
          (result.duplicateCount > 0
            ? `\n\n${result.duplicateCount.toLocaleString()} were already here and were skipped.`
            : ''),
        [{ text: 'Done', onPress: () => router.back() }],
      );
    } catch {
      Alert.alert('Import failed', 'Nothing was saved. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl * 2 }}
    >
      <Card>
        <Text style={[typography.subheading, { marginBottom: spacing.sm }]}>How to get the file</Text>
        <Text style={typography.small}>
          1. Open the chat in WhatsApp{'\n'}
          2. Tap the contact or group name{'\n'}
          3. Scroll down to <Text style={{ color: colors.text }}>Export chat</Text>{'\n'}
          4. Choose <Text style={{ color: colors.text }}>Without media</Text>{'\n'}
          5. Share it into Ortak, or save it and pick it below
        </Text>
      </Card>

      <Button
        label={file ? 'Choose a different file' : 'Choose export file'}
        onPress={() => void pickFile()}
        busy={busy && !preview}
        style={{ marginTop: spacing.md }}
      />

      {preview ? (
        <View style={{ marginTop: spacing.lg }}>
          <Text style={[typography.heading, { marginBottom: spacing.sm }]}>{preview.chatName}</Text>

          <Card>
            <Text style={typography.body}>
              {preview.messageCount.toLocaleString()} messages
            </Text>
            <Muted>
              {preview.firstAt ? relativeDay(preview.firstAt) : '?'} –{' '}
              {preview.lastAt ? relativeDay(preview.lastAt) : '?'}
            </Muted>
            <Muted>{preview.participants.join(', ')}</Muted>
          </Card>

          {preview.dateOrderAmbiguous ? (
            <Card style={{ borderColor: colors.warning }}>
              <Text style={[typography.body, { marginBottom: spacing.sm }]}>
                Which way round are the dates?
              </Text>
              <Muted>
                Every date in this export works either way, so it can’t be worked out from the file.
                Check the first message below against what you remember.
              </Muted>
              <Row style={{ marginTop: spacing.md }}>
                <Chip
                  label="Day first (05.08 = 5 Aug)"
                  selected={dateOrder === 'dmy'}
                  onPress={() => setDateOrder('dmy')}
                />
                <Chip
                  label="Month first (05/08 = 8 May)"
                  selected={dateOrder === 'mdy'}
                  onPress={() => setDateOrder('mdy')}
                />
              </Row>
            </Card>
          ) : null}

          {preview.warnings.length > 0 ? (
            <Card>
              {preview.warnings.map((warning) => (
                <Muted key={warning}>{warning}</Muted>
              ))}
            </Card>
          ) : null}

          <Text style={[typography.subheading, { marginTop: spacing.md, marginBottom: spacing.sm }]}>
            First few messages
          </Text>
          {preview.sample.map((message, index) => (
            <Card key={index}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={typography.small}>{message.author ?? 'WhatsApp'}</Text>
                <Text style={typography.tiny}>
                  {new Date(message.sentAt).toLocaleString()}
                </Text>
              </Row>
              <Text style={typography.body} numberOfLines={3}>
                {message.body}
              </Text>
            </Card>
          ))}

          <Button
            label={`Import ${preview.messageCount.toLocaleString()} messages`}
            onPress={() => void confirmImport()}
            busy={busy}
            style={{ marginTop: spacing.md }}
          />
          <Muted>
            Importing the same chat again later is safe — only genuinely new messages get added.
          </Muted>
        </View>
      ) : null}
    </ScrollView>
  );
}

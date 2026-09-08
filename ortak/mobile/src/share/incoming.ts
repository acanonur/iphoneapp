/**
 * Catching things shared into Ortak from other apps.
 *
 * This is the quick way to keep a single WhatsApp message — the plumber's
 * number, the Airbnb link, the address for Saturday — without exporting a whole
 * chat: long-press the message in WhatsApp → Share → Ortak. Sharing an exported
 * chat `.txt` works the same way and goes straight to the import screen.
 *
 * Two mechanisms, because they cover different routes in:
 *
 *  - **A real share-sheet target**, via `expo-share-intent`. Its config plugin
 *    registers an Android `ACTION_SEND` filter and an iOS share extension, so
 *    Ortak appears in the share sheet on both platforms. It needs a development
 *    build — the native side cannot exist in Expo Go — but the app already
 *    needs one for calendar access, so that costs nothing extra. The native
 *    module is loaded optionally, so a build without it still runs.
 *
 *  - **Deep links** (`ortak://save?text=…&url=…`), which is what an iOS
 *    Shortcut targets and what makes the "Save to Ortak" recipe in the README
 *    work without any custom build at all.
 */

import { useEffect, useRef, useState } from 'react';
import * as Linking from 'expo-linking';
import { useShareIntent as useNativeShareIntent } from 'expo-share-intent';

export interface SharedFile {
  fileName: string;
  mimeType: string;
  path: string;
}

export interface SharedPayload {
  text: string | null;
  url: string | null;
  /** Files that came with the share — a WhatsApp export lands here. */
  files: SharedFile[];
  /** Where it came from, when the sharing app tells us. */
  source: string | null;
}

/** Pull a payload out of an `ortak://save?...` deep link. */
export function parseShareUrl(incoming: string): SharedPayload | null {
  try {
    const parsed = Linking.parse(incoming);
    const path = (parsed.path ?? '').replace(/^\/+/, '');
    if (path !== 'save' && path !== 'share') return null;

    const params = parsed.queryParams ?? {};
    const read = (key: string): string | null => {
      const value = params[key];
      if (typeof value === 'string') return value;
      if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
      return null;
    };

    const text = read('text');
    const url = read('url');
    if (!text && !url) return null;

    return { text, url, files: [], source: read('source') };
  } catch {
    return null;
  }
}

/** The first http(s) URL inside a block of shared text, if there is one. */
export function extractUrl(text: string): string | null {
  const match = /https?:\/\/[^\s<>"']+/i.exec(text);
  return match ? match[0].replace(/[.,;:)\]]+$/, '') : null;
}

/** A shared file that looks like a WhatsApp "Export chat" result. */
export function chatExportFile(payload: SharedPayload): SharedFile | null {
  return (
    payload.files.find(
      (file) =>
        file.mimeType?.startsWith('text/') ||
        /\.txt$/i.test(file.fileName ?? '') ||
        /^_chat\.txt$/i.test(file.fileName ?? ''),
    ) ?? null
  );
}

/**
 * Guess what the user meant to save, so the capture screen opens on the right
 * thing instead of asking.
 */
export function classifyShare(payload: SharedPayload): 'chat-import' | 'link' | 'note' {
  if (chatExportFile(payload)) return 'chat-import';
  if (payload.url) return 'link';
  if (payload.text && extractUrl(payload.text) && payload.text.trim().length < 400) return 'link';
  return 'note';
}

/**
 * Whatever was most recently shared into the app.
 *
 * Covers a cold start (the app was launched by the share) and a warm one (it
 * was already open). Call `clear()` once the payload has been saved.
 */
export function useIncomingShare(): { payload: SharedPayload | null; clear: () => void } {
  const [payload, setPayload] = useState<SharedPayload | null>(null);

  // Returns an inert default when the native module is absent (Expo Go, or a
  // build made before the plugin was added), so this is always safe to call.
  const { hasShareIntent, shareIntent, resetShareIntent } = useNativeShareIntent({
    resetOnBackground: true,
  });

  // Deep links, for the Shortcut route.
  useEffect(() => {
    let cancelled = false;

    void Linking.getInitialURL().then((url) => {
      if (cancelled || !url) return;
      const parsed = parseShareUrl(url);
      if (parsed) setPayload(parsed);
    });

    const subscription = Linking.addEventListener('url', (event) => {
      const parsed = parseShareUrl(event.url);
      if (parsed) setPayload(parsed);
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  // The native share sheet. Depend on the primitives rather than the intent
  // object, whose identity changes on every render of the underlying hook.
  const text = shareIntent?.text ?? null;
  const webUrl = shareIntent?.webUrl ?? null;
  const files = shareIntent?.files ?? null;
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!hasShareIntent) return;

    const shared: SharedFile[] = (files ?? []).map((file) => ({
      fileName: file.fileName,
      mimeType: file.mimeType,
      path: file.path,
    }));

    if (!text && !webUrl && shared.length === 0) return;

    // The same share can be reported more than once; only act on it once.
    const fingerprint = `${text ?? ''}|${webUrl ?? ''}|${shared.map((f) => f.path).join(',')}`;
    if (handled.current === fingerprint) return;
    handled.current = fingerprint;

    setPayload({ text, url: webUrl, files: shared, source: 'share-sheet' });
    resetShareIntent();
  }, [hasShareIntent, text, webUrl, files, resetShareIntent]);

  return {
    payload,
    clear: () => {
      handled.current = null;
      setPayload(null);
    },
  };
}

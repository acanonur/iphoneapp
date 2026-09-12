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

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
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
    // `ortak://save?text=…` has no path at all: a custom scheme with no
    // authority puts "save" in the *hostname*, and only the triple-slashed
    // `ortak:///save` fills in the path. Reading the path alone rejected every
    // link the documented iOS Shortcut produces.
    const segment = (parsed.path ?? parsed.hostname ?? '').replace(/^\/+/, '').toLowerCase();
    if (segment !== 'save' && segment !== 'share') return null;

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
 * The most recent share, held outside React.
 *
 * Intake and consumption happen in two different places: the intake hook has to
 * be mounted once, high up and permanently, or the native module is never
 * drained and deep links are never heard; the capture screen that consumes the
 * payload is pushed afterwards and mounts later. Holding the payload in a
 * module-level store lets the root layout produce and the screen consume
 * without either having to own the other.
 *
 * This used to be one hook that did both, mounted only inside `/capture` — a
 * screen nothing navigated to on a share. So on iOS the share extension's
 * callback URL hit an unmatched route and the payload was never read, and on
 * Android the intent sat in the native module until the person happened to open
 * the capture screen by hand.
 */
let currentPayload: SharedPayload | null = null;
const subscribers = new Set<() => void>();

function publishPayload(payload: SharedPayload | null): void {
  currentPayload = payload;
  for (const notify of subscribers) notify();
}

function subscribe(notify: () => void): () => void {
  subscribers.add(notify);
  return () => {
    subscribers.delete(notify);
  };
}

/** Read the pending share, if any. Call `clear()` once it has been dealt with. */
export function useSharedPayload(): { payload: SharedPayload | null; clear: () => void } {
  const payload = useSyncExternalStore(
    subscribe,
    () => currentPayload,
    () => currentPayload,
  );
  const clear = useCallback(() => publishPayload(null), []);
  return { payload, clear };
}

/**
 * Drain incoming shares into the store above.
 *
 * Mount exactly once, in the root layout. Covers a cold start (the app was
 * launched by the share) and a warm one (it was already open), over both the
 * native share sheet and the `ortak://save?…` deep link the Shortcut uses.
 */
export function useShareIntake(): void {
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
      if (parsed) publishPayload(parsed);
    });

    const subscription = Linking.addEventListener('url', (event) => {
      const parsed = parseShareUrl(event.url);
      if (parsed) publishPayload(parsed);
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

    publishPayload({ text, url: webUrl, files: shared, source: 'share-sheet' });
    resetShareIntent();
  }, [hasShareIntent, text, webUrl, files, resetShareIntent]);
}

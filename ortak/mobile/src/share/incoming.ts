/**
 * Catching things shared into Ortak from other apps.
 *
 * This is the quick way to keep a single WhatsApp message — the plumber's
 * number, the Airbnb link, the address for Saturday — without exporting a whole
 * chat: long-press the message in WhatsApp → Share → Ortak.
 *
 * Two mechanisms, because the platforms differ:
 *
 *  - **Deep links** (`ortak://save?text=…&url=…`). Works everywhere with no
 *    extra native code, and is what an iOS Shortcut targets. The README has a
 *    "Save to Ortak" Shortcut recipe that puts Ortak in the iOS share sheet
 *    without a custom share extension.
 *
 *  - **A real share-sheet target**, via the optional `expo-share-intent`
 *    package. It is loaded dynamically here: if it isn't installed the app runs
 *    exactly as before, minus the native share target. Adding it needs a
 *    development build — it cannot work in Expo Go, which has a fixed set of
 *    native modules.
 */

import { useEffect, useState } from 'react';
import * as Linking from 'expo-linking';

export interface SharedPayload {
  text: string | null;
  url: string | null;
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

    return { text, url, source: read('source') };
  } catch {
    return null;
  }
}

/** The first http(s) URL inside a block of shared text, if there is one. */
export function extractUrl(text: string): string | null {
  const match = /https?:\/\/[^\s<>"']+/i.exec(text);
  return match ? match[0].replace(/[.,;:)\]]+$/, '') : null;
}

/**
 * Guess what the user meant to save, so the capture screen opens on the right
 * tab instead of asking.
 */
export function classifyShare(payload: SharedPayload): 'link' | 'note' {
  if (payload.url) return 'link';
  if (payload.text && extractUrl(payload.text) && payload.text.trim().length < 400) return 'link';
  return 'note';
}

interface ShareIntentModule {
  getShareIntent?: () => Promise<{ text?: string; webUrl?: string } | null>;
  addShareIntentListener?: (
    handler: (intent: { text?: string; webUrl?: string }) => void,
  ) => { remove: () => void };
}

/** Load expo-share-intent if this build has it, without breaking builds that don't. */
function loadShareIntentModule(): ShareIntentModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-share-intent') as ShareIntentModule;
  } catch {
    return null;
  }
}

/**
 * Whatever was most recently shared into the app.
 *
 * Covers a cold start (the app was launched by the share) and a warm one (it
 * was already open). Call `clear()` once the payload has been saved.
 */
export function useIncomingShare(): { payload: SharedPayload | null; clear: () => void } {
  const [payload, setPayload] = useState<SharedPayload | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Cold start via deep link.
    void Linking.getInitialURL().then((url) => {
      if (cancelled || !url) return;
      const parsed = parseShareUrl(url);
      if (parsed) setPayload(parsed);
    });

    // Warm deep links.
    const linkSubscription = Linking.addEventListener('url', (event) => {
      const parsed = parseShareUrl(event.url);
      if (parsed) setPayload(parsed);
    });

    // Native share target, when the package is present.
    const shareIntent = loadShareIntentModule();
    let intentSubscription: { remove: () => void } | null = null;

    if (shareIntent) {
      void shareIntent.getShareIntent?.().then((intent) => {
        if (cancelled || !intent) return;
        if (intent.text || intent.webUrl) {
          setPayload({ text: intent.text ?? null, url: intent.webUrl ?? null, source: 'share-sheet' });
        }
      });

      intentSubscription =
        shareIntent.addShareIntentListener?.((intent) => {
          if (intent.text || intent.webUrl) {
            setPayload({ text: intent.text ?? null, url: intent.webUrl ?? null, source: 'share-sheet' });
          }
        }) ?? null;
    }

    return () => {
      cancelled = true;
      linkSubscription.remove();
      intentSubscription?.remove();
    };
  }, []);

  return { payload, clear: () => setPayload(null) };
}

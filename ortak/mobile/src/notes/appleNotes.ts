/**
 * Getting a note out of Ortak and into Apple Notes.
 *
 * ## The honest constraint
 *
 * There is no public API for Apple Notes on iOS. No third-party app can create,
 * read or write notes in it — that is a deliberate Apple restriction, not a gap
 * in this app, and no library works around it. So Ortak keeps the shared note as
 * the source of truth and offers three real ways to get a copy into Notes:
 *
 *  1. **Share sheet** (below). Tap Export → the iOS share sheet opens → tap
 *    Notes. Two taps, works on a stock phone, no setup. This is the default.
 *
 *  2. **Shortcuts automation**, for one-tap or fully automatic export. The
 *    server serves any note as plain text at `/api/notes/<id>.txt`, which a
 *    Shortcut can fetch and pipe into the built-in "Create Note" action. Recipe
 *    is in the README.
 *
 *  3. **On the Mac**, where AppleScript *is* allowed to write to Notes:
 *    `scripts/sync-notes-to-apple-notes.sh` pulls the shared notes and creates
 *    them in a dedicated Notes folder.
 *
 * On Android the share sheet reaches Google Keep and anything else installed,
 * which is the same mechanism.
 */

import { Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';

export interface ExportableNote {
  id: string;
  title: string;
  body: string;
}

function formatNote(note: ExportableNote): string {
  return note.title.trim() ? `${note.title.trim()}\n\n${note.body}` : note.body;
}

export type ExportOutcome = 'shared' | 'dismissed' | 'failed';

/**
 * Open the system share sheet with the note's text.
 *
 * On iOS the sheet lists Notes directly, so this is the two-tap path into Apple
 * Notes. The title is passed separately because iOS uses it as the suggested
 * note title.
 */
export async function shareNote(note: ExportableNote): Promise<ExportOutcome> {
  try {
    const result = await Share.share(
      { message: formatNote(note), title: note.title || 'Note' },
      { subject: note.title || 'Note from Ortak', dialogTitle: 'Save note to…' },
    );
    return result.action === Share.dismissedAction ? 'dismissed' : 'shared';
  } catch {
    return 'failed';
  }
}

export async function copyNote(note: ExportableNote): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(formatNote(note));
    return true;
  } catch {
    return false;
  }
}

/**
 * The URL a Shortcut fetches to get one note as plain text.
 *
 * Handed to the user in Settings so they can paste it into a Shortcut's "Get
 * contents of URL" action along with their token.
 */
export function noteTextUrl(serverUrl: string, noteId: string): string {
  return `${serverUrl.replace(/\/+$/, '')}/api/notes/${noteId}.txt`;
}

/**
 * Try to hand a note straight to the Notes app.
 *
 * Apple publishes `mobilenotes://` but does not document any way to pass
 * content through it, so this only opens the app; it cannot create the note. It
 * exists for the "I'll paste it myself" flow: copy, then jump across. Returns
 * false when the app can't be opened, and callers fall back to the share sheet.
 */
export async function openNotesApp(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    const supported = await Linking.canOpenURL('mobilenotes://');
    if (!supported) return false;
    await Linking.openURL('mobilenotes://');
    return true;
  } catch {
    return false;
  }
}

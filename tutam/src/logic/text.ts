import { LANGS, type Lang, type Text } from '../model/types';

/**
 * The string to show for a piece of recipe text.
 *
 * Starter recipes carry all three languages; a recipe someone wrote themselves
 * is a plain string and is shown as written, whatever the app's language.
 */
export function localise(text: Text | undefined | null, lang: Lang): string {
  if (text == null) return '';
  if (typeof text === 'string') return text;
  return text[lang] || text.en || '';
}

/** Every language's version of a text, for searching across all of them. */
export function allVersions(text: Text | undefined | null): string[] {
  if (text == null) return [];
  if (typeof text === 'string') return [text];
  return LANGS.map((lang) => text[lang]).filter(Boolean);
}

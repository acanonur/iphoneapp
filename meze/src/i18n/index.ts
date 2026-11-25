import { getLocales } from 'expo-localization';
import { LANGS, type Lang } from '../model/types';
import { en, type StringKey, type Strings } from './en';
import { tr } from './tr';
import { de } from './de';

const TABLES: Record<Lang, Strings> = { en, tr, de };

/** The phone's language if Meze speaks it, otherwise English. */
export function systemLang(): Lang {
  for (const locale of getLocales()) {
    const code = locale.languageCode?.toLowerCase();
    if (code && (LANGS as readonly string[]).includes(code)) return code as Lang;
  }
  return 'en';
}

/** Looks a string up and fills in its `{placeholders}`. */
export function translate(lang: Lang, key: StringKey, vars?: Record<string, string | number>): string {
  let text: string = TABLES[lang][key] ?? en[key];
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.split(`{${name}}`).join(String(value));
    }
  }
  return text;
}

export type { StringKey } from './en';

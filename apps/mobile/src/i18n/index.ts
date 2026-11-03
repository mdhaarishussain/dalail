import en from './en.json';
import romanUr from './roman-ur.json';

/**
 * Minimal i18n. All UI strings live in the JSON files; components call t().
 * `en.json` is the source of truth for keys; other locales must have the same keys
 * (enforced by a test). Urdu script (`ur.json`) is a later phase.
 */
export type Locale = 'en' | 'roman-ur';
export type StringKey = keyof typeof en;

const tables: Record<Locale, Record<StringKey, string>> = {
  en,
  'roman-ur': romanUr,
};

let current: Locale = 'en';

export function setLocale(locale: Locale): void {
  current = locale;
}

export function getLocale(): Locale {
  return current;
}

export function t(key: StringKey, locale: Locale = current): string {
  return tables[locale][key];
}

export const locales = Object.keys(tables) as Locale[];
export const stringTables = tables;

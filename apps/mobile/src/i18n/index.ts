import en from './en.json';
import romanUr from './roman-ur.json';

/**
 * Minimal i18n. All UI strings live in the JSON files; components call t() / useT().
 * `en.json` is the source of truth for keys; other locales must have the same keys
 * (enforced by a test). Urdu script (`ur.json`) is a later phase.
 */
export type Locale = 'en' | 'roman-ur';
export type StringKey = keyof typeof en;

const tables: Record<Locale, Record<StringKey, string>> = {
  en,
  'roman-ur': romanUr,
};

/** t('key', locale, { n: 3 }) — `{n}` placeholders are replaced. */
export function t(
  key: StringKey,
  locale: Locale = 'en',
  vars?: Record<string, string | number>,
): string {
  let s = tables[locale][key] ?? tables.en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

export const locales = Object.keys(tables) as Locale[];
export const stringTables = tables;

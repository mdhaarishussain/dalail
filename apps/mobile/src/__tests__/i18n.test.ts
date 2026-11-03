import { locales, stringTables } from '../i18n';

describe('i18n tables', () => {
  const reference = Object.keys(stringTables.en).sort();

  it.each(locales)('%s has exactly the same keys as en', (locale) => {
    expect(Object.keys(stringTables[locale]).sort()).toEqual(reference);
  });

  it.each(locales)('%s has no empty strings', (locale) => {
    for (const value of Object.values(stringTables[locale])) {
      expect(value.trim()).not.toBe('');
    }
  });
});

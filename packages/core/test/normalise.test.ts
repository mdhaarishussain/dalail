import { describe, expect, it } from 'vitest';
import golden from '../src/normalise/normalise.golden.json';
import rules from '../src/normalise/rules.json';
import { foldToken, isStopword, normaliseRomanUrdu } from '../src/normalise';

describe('normaliseRomanUrdu golden cases', () => {
  it.each(golden.cases)('$rule: "$input"', ({ input, norm, folded }) => {
    expect(normaliseRomanUrdu(input)).toEqual({ norm, folded });
  });
});

describe('rule coverage', () => {
  const covered = new Set(golden.cases.map((c) => c.rule));
  const charmapIds = [rules.charmap_norm._ids, rules.charmap_fold._ids].join(' ').split(' ');
  it.each([...rules.izafat, ...rules.fold].map((r) => r.id).concat(charmapIds))(
    'rule %s has a golden case',
    (id) => {
      expect(covered.has(id)).toBe(true);
    },
  );
});

describe('spelling variants converge', () => {
  it.each([
    ['ilm-e-ghaib', 'ilm e ghayb'],
    ['ilm-e-ghaib', 'ilm e-ghayb'],
    ['qalam', 'kalam'],
    ['kitaab', 'kitab'],
    ['zameen', 'zamin'],
    ['كتاب', 'کتاب'],
    ['پاني', 'پانی'],
    ['کِتَاب', 'کتاب'],
    ['گھر', 'گہر'],
  ])('%s ~ %s', (a, b) => {
    expect(normaliseRomanUrdu(a).folded).toBe(normaliseRomanUrdu(b).folded);
  });
});

describe('helpers', () => {
  it('folds a single token', () => {
    expect(foldToken('khidkee')).toBe('kidki');
  });
  it('knows stopwords', () => {
    expect(isStopword('aur')).toBe(true);
    expect(isStopword('qalam')).toBe(false);
  });
});

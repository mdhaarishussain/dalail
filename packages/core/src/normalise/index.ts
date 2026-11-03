import rulesData from './rules.json';
import stopwordsData from './stopwords.json';
import synonymsData from './synonyms.json';

/**
 * Roman Urdu normaliser. Used on device for queries and mirrored in
 * pipeline/src/dalail_pipeline/normalise.py for indexed aliases; both are held to
 * normalise.golden.json (see docs/decisions/0004-normaliser-parity.md).
 */
export interface Normalised {
  /** Lowercased, diacritics/punctuation stripped, izafat unified, synonym tokens appended. */
  norm: string;
  /** `norm` with the consonant/vowel folding rules applied per token. */
  folded: string;
}

interface Rule {
  id: string;
  pattern: string;
  replace: string;
}

const toJsReplace = (r: Rule) => ({ re: new RegExp(r.pattern, 'gu'), replace: r.replace });

const izafatRules = (rulesData.izafat as Rule[]).map(toJsReplace);
const foldRules = (rulesData.fold as Rule[]).map(toJsReplace);

/** Single-character maps; keys starting with "_" are documentation. */
function charMap(table: Record<string, string>): Map<string, string> {
  return new Map(Object.entries(table).filter(([k]) => !k.startsWith('_')));
}
const normChars = charMap(rulesData.charmap_norm);
const foldChars = charMap(rulesData.charmap_fold);
const mapChars = (s: string, table: Map<string, string>) =>
  Array.from(s, (ch) => table.get(ch) ?? ch).join('');

export function foldToken(token: string): string {
  let out = token;
  for (const { re, replace } of foldRules) out = out.replace(re, replace);
  return mapChars(out, foldChars);
}

const synonymIndex: Map<string, string> = new Map();
for (const [group, members] of Object.entries(synonymsData.groups as Record<string, string[]>)) {
  for (const member of members) synonymIndex.set(foldToken(member), group);
}

const stopwords = new Set<string>(stopwordsData.words);

export function isStopword(token: string): boolean {
  return stopwords.has(token);
}

/** Lowercase, strip diacritics, unify izafat, strip punctuation; returns tokens. */
export function baseTokens(text: string): string[] {
  let s = mapChars(text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase(), normChars);
  for (const { re, replace } of izafatRules) s = s.replace(re, replace);
  s = s.replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  return s === '' ? [] : s.split(' ');
}

export function normaliseRomanUrdu(text: string): Normalised {
  const tokens = baseTokens(text);
  const groups: string[] = [];
  for (const t of tokens) {
    const group = synonymIndex.get(foldToken(t));
    if (group !== undefined && !groups.includes(group) && !tokens.includes(group)) {
      groups.push(group);
    }
  }
  const normTokens = [...tokens, ...groups];
  return {
    norm: normTokens.join(' '),
    folded: normTokens.map(foldToken).join(' '),
  };
}

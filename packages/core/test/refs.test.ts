import { describe, expect, it } from 'vitest';
import { extractInlineRefs, parseDalilRef } from '../src/refs';

describe('parseDalilRef', () => {
  it('parses a single ayah', () => {
    expect(parseDalilRef('quran:2:255')).toMatchObject({
      kind: 'quran',
      surah: 2,
      from: 255,
      to: 255,
    });
  });
  it('parses a range', () => {
    expect(parseDalilRef('quran:18:1-10')).toMatchObject({ from: 1, to: 10 });
  });
  it('rejects a reversed range and zero', () => {
    expect(parseDalilRef('quran:18:10-1')).toBeNull();
    expect(parseDalilRef('quran:0:1')).toBeNull();
  });
  it('parses hadith and fixture refs', () => {
    expect(parseDalilRef('hadith:h-0001')).toMatchObject({ kind: 'hadith', id: 'h-0001' });
    expect(parseDalilRef('fixture:quran:3')).toMatchObject({
      kind: 'fixture',
      collection: 'quran',
      n: 3,
    });
  });
  it.each(['quran:1', 'hadith:1', 'bukhari:1', 'fixture:tafsir:1', ''])('rejects %j', (r) => {
    expect(parseDalilRef(r)).toBeNull();
  });
});

describe('extractInlineRefs', () => {
  it('finds [[ref]] tokens', () => {
    expect(extractInlineRefs('a [[fixture:quran:1]] b [[hadith:h-0002]]')).toEqual([
      'fixture:quran:1',
      'hadith:h-0002',
    ]);
  });
});

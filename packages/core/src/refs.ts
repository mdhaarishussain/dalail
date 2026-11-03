/**
 * Dalil reference grammar (brief §4):
 *   quran:<surah>:<ayah> | quran:<surah>:<from>-<to> | hadith:<id> | fixture:quran:<n> | fixture:hadith:<n>
 */
export type DalilRef =
  | { kind: 'quran'; surah: number; from: number; to: number; raw: string }
  | { kind: 'hadith'; id: string; raw: string }
  | { kind: 'fixture'; collection: 'quran' | 'hadith'; n: number; raw: string };

const QURAN = /^quran:(\d{1,3}):(\d{1,3})(?:-(\d{1,3}))?$/;
const HADITH = /^hadith:(h-\d{4,})$/;
const FIXTURE = /^fixture:(quran|hadith):(\d+)$/;

export function parseDalilRef(raw: string): DalilRef | null {
  let m = QURAN.exec(raw);
  if (m) {
    const surah = Number(m[1]);
    const from = Number(m[2]);
    const to = m[3] === undefined ? from : Number(m[3]);
    if (surah < 1 || from < 1 || to < from) return null;
    return { kind: 'quran', surah, from, to, raw };
  }
  m = HADITH.exec(raw);
  if (m) return { kind: 'hadith', id: m[1] as string, raw };
  m = FIXTURE.exec(raw);
  if (m) return { kind: 'fixture', collection: m[1] as 'quran' | 'hadith', n: Number(m[2]), raw };
  return null;
}

/** Inline references in body markdown: [[quran:5:35]]. */
export function extractInlineRefs(markdown: string): string[] {
  return [...markdown.matchAll(/\[\[([^\]\s]+)\]\]/g)].map((m) => m[1] as string);
}

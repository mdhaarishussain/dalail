import { parseDalilRef } from '@dalail/core';
import type { Dalil, NodeDetail } from '../data/types';

/** Only verified, non-fixture answers may leave the app. */
export function canShare(node: Pick<NodeDetail, 'status' | 'isFixture' | 'origin'>): boolean {
  return node.status === 'verified' && !node.isFixture && node.origin !== 'gemini-research';
}

/** Reference label built only from stored data (never from memory). */
export function dalilLabel(d: Dalil): string {
  if (d.kind === 'hadith' || d.kind === 'fixture') return d.reference;
  if (d.kind === 'quran')
    return `Quran ${d.surah}:${d.from === d.to ? d.from : `${d.from}-${d.to}`}`;
  const p = parseDalilRef(d.ref);
  return p?.kind === 'quran'
    ? `Quran ${p.surah}:${p.from === p.to ? p.from : `${p.from}-${p.to}`}`
    : d.ref;
}

/**
 * WhatsApp-friendly text: claim, short answer, dalil references, source line.
 * Returns null when the node may not be shared.
 */
export function formatShareText(node: NodeDetail, dalail: Dalil[]): string | null {
  if (!canShare(node) || !node.shortAnswer.trim()) return null;
  const lines = [`*${node.claimEn}*`, '', node.shortAnswer.trim()];
  const refs = dalail.filter((d) => !d.missing).map(dalilLabel);
  if (refs.length) lines.push('', `Dalail: ${refs.join(' · ')}`);
  const src = [node.responseSource.scholar, node.responseSource.work].filter(Boolean).join(', ');
  if (src)
    lines.push('', `— ${src}${node.responseSource.page ? `, p. ${node.responseSource.page}` : ''}`);
  return lines.join('\n');
}

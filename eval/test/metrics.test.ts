import { describe, expect, it } from 'vitest';
import type { RetrievalCandidate, RetrievalResult } from '@dalail/core';
import { computeMetrics, type Outcome } from '../src/metrics';

const cand = (nodeId: string): RetrievalCandidate => ({
  nodeId, score: 1, confidence: 1, coverage: 1, cosine: null, topic: 't', claimEn: '', status: 'verified',
}); // prettier-ignore
const res = (status: RetrievalResult['status'], ...ids: string[]): RetrievalResult => ({
  status,
  candidates: ids.map(cand),
});

describe('computeMetrics', () => {
  it('computes top-1, top-3, rates and status accuracy', () => {
    const outcomes: Outcome[] = [
      { question: { q: 'a', expect: ['x'], style: 'en' }, result: res('match', 'x') },
      { question: { q: 'b', expect: ['y'], style: 'en' }, result: res('ambiguous', 'x', 'y') },
      { question: { q: 'c', expect: ['z'], style: 'variant' }, result: res('no_match') },
      { question: { q: 'd', expect_status: 'no_match' }, result: res('no_match') },
      { question: { q: 'e', expect_status: 'no_match' }, result: res('match', 'x') },
    ];
    const m = computeMetrics(outcomes);
    expect(m.answerable).toBe(3);
    expect(m.top1).toBeCloseTo(1 / 3);
    expect(m.top3).toBeCloseTo(2 / 3);
    expect(m.ambiguousRate).toBeCloseTo(1 / 3);
    expect(m.noMatchRate).toBeCloseTo(1 / 3);
    expect(m.statusAccuracy).toBe(0.5);
    expect(m.byStyle.en).toEqual({ n: 2, top1: 0.5, top3: 1 });
  });
});

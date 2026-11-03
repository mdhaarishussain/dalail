import type { RetrievalResult, RetrievalStatus } from '@dalail/core';

export interface Question {
  q: string;
  expect?: string[];
  expect_status?: RetrievalStatus;
  style?: string;
}

export interface Outcome {
  question: Question;
  result: RetrievalResult;
}

export interface Metrics {
  questions: number;
  answerable: number;
  top1: number;
  top3: number;
  ambiguousRate: number;
  noMatchRate: number;
  /** Share of expect_status questions whose status was exactly right. */
  statusAccuracy: number;
  byStyle: Record<string, { n: number; top1: number; top3: number }>;
}

const ratio = (a: number, b: number) => (b === 0 ? 0 : a / b);

export function isTop1(o: Outcome): boolean {
  const first = o.result.candidates[0]?.nodeId;
  return first !== undefined && (o.question.expect ?? []).includes(first);
}

export function isTop3(o: Outcome): boolean {
  return o.result.candidates.slice(0, 3).some((c) => (o.question.expect ?? []).includes(c.nodeId));
}

export function computeMetrics(outcomes: Outcome[]): Metrics {
  const answerable = outcomes.filter((o) => (o.question.expect?.length ?? 0) > 0);
  const withStatus = outcomes.filter((o) => o.question.expect_status !== undefined);
  const byStyle: Metrics['byStyle'] = {};
  for (const o of answerable) {
    const s = (byStyle[o.question.style ?? 'other'] ??= { n: 0, top1: 0, top3: 0 });
    s.n += 1;
    s.top1 += Number(isTop1(o));
    s.top3 += Number(isTop3(o));
  }
  for (const s of Object.values(byStyle)) {
    s.top1 = ratio(s.top1, s.n);
    s.top3 = ratio(s.top3, s.n);
  }
  return {
    questions: outcomes.length,
    answerable: answerable.length,
    top1: ratio(answerable.filter(isTop1).length, answerable.length),
    top3: ratio(answerable.filter(isTop3).length, answerable.length),
    ambiguousRate: ratio(
      answerable.filter((o) => o.result.status === 'ambiguous').length,
      answerable.length,
    ),
    noMatchRate: ratio(
      answerable.filter((o) => o.result.status === 'no_match').length,
      answerable.length,
    ),
    statusAccuracy: ratio(
      withStatus.filter((o) => o.result.status === o.question.expect_status).length,
      withStatus.length,
    ),
    byStyle,
  };
}

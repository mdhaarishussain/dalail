/** Retrieval contract types (see docs/architecture.md). */
export type RetrievalStatus = 'match' | 'ambiguous' | 'no_match';

export interface RetrievalCandidate {
  nodeId: string;
  /** Reciprocal-rank-fusion score; candidates are ordered by it. */
  score: number;
  /** 0..1, from keyword coverage and/or vector similarity. Drives match / ambiguous / no_match. */
  confidence: number;
  /** Share of the query's content tokens found in the node's best-matching alias. */
  coverage: number;
  /** Best cosine similarity of any alias, or null in keyword-only mode. */
  cosine: number | null;
  topic: string;
  claimEn: string;
  status: string;
}

export interface RetrievalResult {
  status: RetrievalStatus;
  /** One candidate for `match`, up to 3 for `ambiguous`, none for `no_match`. */
  candidates: RetrievalCandidate[];
}

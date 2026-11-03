/**
 * Shared types for the retrieval contract (see docs/architecture.md).
 * Phase 0 defines only the outcome shape; candidates are filled in Phase 1.
 */
export type RetrievalStatus = 'match' | 'ambiguous' | 'no_match';

export interface RetrievalCandidate {
  nodeId: string;
  score: number;
}

export interface RetrievalResult {
  status: RetrievalStatus;
  /** At most 3 candidates when status is `ambiguous`; empty for `no_match`. */
  candidates: RetrievalCandidate[];
}

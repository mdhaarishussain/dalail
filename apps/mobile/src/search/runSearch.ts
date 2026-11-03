import { retrieve, type RetrievalResult } from '@dalail/core';
import type { Services } from '../services/ServicesContext';

/** Embedding is best-effort: if it is slow or fails, search continues keyword-only. */
export const EMBED_TIMEOUT_MS = 1500;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);
}

export async function runSearch(
  query: string,
  services: Pick<Services, 'repo' | 'embedQuery'>,
): Promise<RetrievalResult> {
  const embedding = services.embedQuery
    ? await withTimeout(
        services.embedQuery(query).catch(() => null),
        EMBED_TIMEOUT_MS,
      )
    : null;
  return retrieve(query, {
    exec: services.repo.exec,
    queryEmbedding: embedding,
    statuses: services.repo.statuses,
  });
}

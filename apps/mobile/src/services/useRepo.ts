import { useMemo } from 'react';
import { CorpusRepository } from '../data/repository';
import type { NodeStatus } from '../data/types';
import { useUser } from '../state/userStore';
import { useServices } from './ServicesContext';

const ALL: readonly NodeStatus[] = ['verified', 'under_review', 'draft'];
const VERIFIED: readonly NodeStatus[] = ['verified'];

/** Repository limited to what this build may show: prod → verified only; dev → setting. */
export function useRepo(): CorpusRepository {
  const { repo, meta } = useServices();
  const showUnverified = useUser((s) => s.showUnverified);
  const statuses = meta.buildMode === 'dev' && showUnverified ? ALL : VERIFIED;
  return useMemo(() => new CorpusRepository(repo.exec, statuses), [repo.exec, statuses]);
}

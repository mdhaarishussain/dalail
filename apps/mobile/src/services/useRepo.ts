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
  const showResearch = useUser((s) => s.showResearch);
  const dev = meta.buildMode === 'dev';
  const statuses = dev && showUnverified ? ALL : VERIFIED;
  const research = dev && showResearch;
  return useMemo(
    () => new CorpusRepository(repo.exec, statuses, research),
    [repo.exec, statuses, research],
  );
}

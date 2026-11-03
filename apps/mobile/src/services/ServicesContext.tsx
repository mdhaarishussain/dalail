import { createContext, useContext, type ReactNode } from 'react';
import type { CorpusRepository } from '../data/repository';
import type { CorpusMeta } from '../data/types';
import type { Tier } from './tier';

export interface Services {
  repo: CorpusRepository;
  meta: CorpusMeta;
  /** e5 query embedding (`query: ` prefix, L2-normalised); null when unavailable → keyword-only. */
  embedQuery: ((text: string, prefix?: string) => Promise<number[] | null>) | null;
  detectedTier: Tier;
  /** Dev-only diagnostics hooks. */
  diagnostics?: {
    vecVersion: string | null;
    modelPath: string | null;
    modelStatus: string;
    initMs: number;
  };
}

const Ctx = createContext<Services | null>(null);

export function ServicesProvider({
  services,
  children,
}: {
  services: Services;
  children: ReactNode;
}) {
  return <Ctx.Provider value={services}>{children}</Ctx.Provider>;
}

export function useServices(): Services {
  const s = useContext(Ctx);
  if (!s) throw new Error('useServices() outside <ServicesProvider>');
  return s;
}

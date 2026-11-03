import path from 'node:path';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import type { Row, SqlExecutor } from '@dalail/core';
import { CorpusRepository } from '../data/repository';
import type { Services } from '../services/ServicesContext';
import { configureUserStorage, initialData, useUser } from '../state/userStore';

/** The keyword-only dev DB built by `build --dev --no-embed --out ../dist/ci` (scripts/ci.sh builds it first). */
export const TEST_DB =
  process.env.DALAIL_TEST_DB ?? path.resolve(__dirname, '../../../../dist/ci/dalail.db');

export function testExecutor(): SqlExecutor {
  if (!fs.existsSync(TEST_DB)) {
    throw new Error(
      `${TEST_DB} missing. Run: cd pipeline && uv run python -m dalail_pipeline build --dev --no-embed --out ../dist/ci`,
    );
  }
  const db = new DatabaseSync(TEST_DB, { readOnly: true });
  return {
    all: async (sql, params = []) =>
      db.prepare(sql).all(...(params as (string | number | null)[])) as Row[],
  };
}

export async function testServices(overrides: Partial<Services> = {}): Promise<Services> {
  const repo = new CorpusRepository(testExecutor());
  return { repo, meta: await repo.meta(), embedQuery: null, detectedTier: 'lite', ...overrides };
}

export function resetUser(patch: Partial<typeof initialData> = {}): void {
  const mem = new Map<string, string>();
  configureUserStorage({
    getItem: (k) => mem.get(k) ?? null,
    setItem: (k, v) => void mem.set(k, v),
    removeItem: (k) => void mem.delete(k),
  });
  useUser.setState({ ...initialData, hydrated: true, ...patch });
}

/**
 * Eval runner: `pnpm --filter @dalail/eval eval [--db PATH] [--mode auto|keyword|hybrid] [--min-top1 0.8]`.
 * Runs @dalail/core retrieval against dist/dalail.db with node:sqlite — the same code path as the app.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { parseArgs } from 'node:util';
import { readMeta, retrieve, type SqlExecutor, type SqlValue } from '@dalail/core';
import { parse } from 'yaml';
import { computeMetrics, isTop1, type Outcome, type Question } from './metrics';

const here = dirname(new URL(import.meta.url).pathname);
const evalDir = resolve(here, '..');
const repo = resolve(evalDir, '..');

const { values: args } = parseArgs({
  options: {
    db: { type: 'string', default: resolve(repo, 'dist/dalail.db') },
    questions: { type: 'string', default: resolve(evalDir, 'questions.fixture.yaml') },
    embeddings: { type: 'string', default: resolve(evalDir, '.cache/query-embeddings.json') },
    mode: { type: 'string', default: 'auto' },
    'min-top1': { type: 'string' },
    out: { type: 'string', default: resolve(evalDir, 'results/latest.json') },
    verbose: { type: 'boolean', default: false },
  },
});

function sqliteVecPath(): string {
  if (process.env.DALAIL_SQLITE_VEC) return process.env.DALAIL_SQLITE_VEC;
  const r = spawnSync(
    'uv',
    [
      'run',
      '--project',
      resolve(repo, 'pipeline'),
      'python',
      '-c',
      'import sqlite_vec; print(sqlite_vec.loadable_path())',
    ],
    { encoding: 'utf8' },
  );
  if (r.status !== 0) throw new Error(`could not locate sqlite-vec via uv: ${r.stderr}`);
  return r.stdout.trim();
}

async function main(): Promise<number> {
  if (!existsSync(args.db)) {
    console.error(
      `no DB at ${args.db}; run: cd pipeline && uv run python -m dalail_pipeline build --dev [--no-embed]`,
    );
    return 1;
  }
  const db = new DatabaseSync(args.db, { readOnly: true, allowExtension: true });
  const exec: SqlExecutor = {
    all: async (sql, params = []) =>
      db.prepare(sql).all(...(params as (string | number | null | Uint8Array)[])) as Record<
        string,
        SqlValue
      >[],
  };
  const meta = await readMeta(exec);
  const questions = (parse(readFileSync(args.questions, 'utf8')) as { questions: Question[] })
    .questions;

  let vectors: Record<string, number[]> | null = null;
  const hasVec = meta.embed_model !== 'none';
  const wantHybrid = args.mode === 'hybrid' || (args.mode === 'auto' && hasVec);
  if (wantHybrid) {
    if (!hasVec) throw new Error('--mode hybrid needs a DB built with embeddings');
    if (!existsSync(args.embeddings)) {
      throw new Error(
        `no query embeddings at ${args.embeddings}; run: uv run python -m dalail_pipeline embed-queries ../eval/questions.fixture.yaml`,
      );
    }
    const cache = JSON.parse(readFileSync(args.embeddings, 'utf8')) as {
      sha256: string;
      vectors: Record<string, number[]>;
    };
    if (cache.sha256 !== meta.embed_model_sha256)
      throw new Error('query embeddings were made with a different model than the DB');
    vectors = cache.vectors;
    db.loadExtension(sqliteVecPath());
  }
  const mode = vectors ? 'hybrid' : 'keyword';

  const outcomes: Outcome[] = [];
  const times: number[] = [];
  for (const question of questions) {
    const t0 = performance.now();
    const queryEmbedding = vectors ? (vectors[question.q] ?? null) : null;
    if (vectors && !queryEmbedding)
      throw new Error(`no embedding for "${question.q}"; re-run embed-queries`);
    const result = await retrieve(question.q, { exec, queryEmbedding });
    times.push(performance.now() - t0);
    outcomes.push({ question, result });
  }
  const m = computeMetrics(outcomes);
  const pct = (x: number) => `${(100 * x).toFixed(1)}%`.padStart(7);
  times.sort((a, b) => a - b);
  console.log(
    `DB ${args.db} (corpus ${meta.corpus_version}, ${meta.build_mode}, embed_model=${meta.embed_model}); mode=${mode}`,
  );
  console.log(`questions ${m.questions}, answerable ${m.answerable}`);
  console.log(
    `top-1 ${pct(m.top1)}   top-3 ${pct(m.top3)}   ambiguous ${pct(m.ambiguousRate)}   no-match ${pct(m.noMatchRate)}   status-accuracy ${pct(m.statusAccuracy)}`,
  );
  console.log(
    `latency p50 ${times[Math.floor(times.length / 2)]?.toFixed(1)} ms, max ${times.at(-1)?.toFixed(1)} ms`,
  );
  for (const [style, s] of Object.entries(m.byStyle).sort()) {
    console.log(
      `  ${style.padEnd(12)} n=${String(s.n).padStart(2)}  top-1 ${pct(s.top1)}  top-3 ${pct(s.top3)}`,
    );
  }
  const misses = outcomes.filter((o) =>
    o.question.expect_status
      ? o.result.status !== o.question.expect_status || (o.question.expect && !isTop1(o))
      : !isTop1(o),
  );
  for (const o of misses) {
    const got =
      o.result.candidates.map((c) => `${c.nodeId}(${c.confidence.toFixed(2)})`).join(', ') || '-';
    console.log(
      `  MISS "${o.question.q}" → ${o.result.status}: ${got}; expected ${o.question.expect_status ?? ''} ${(o.question.expect ?? []).join(', ')}`,
    );
  }
  if (args.verbose) console.log(JSON.stringify(outcomes, null, 2));
  mkdirSync(dirname(args.out), { recursive: true });
  writeFileSync(args.out, JSON.stringify({ meta, mode, metrics: m, outcomes }, null, 2));

  const min = args['min-top1'] === undefined ? null : Number(args['min-top1']);
  if (min !== null && m.top1 < min) {
    console.error(`top-1 ${pct(m.top1)} is below --min-top1 ${pct(min)}`);
    return 1;
  }
  return 0;
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  },
);

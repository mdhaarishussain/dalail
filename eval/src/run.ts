/**
 * Eval runner: `pnpm --filter @dalail/eval eval [--db PATH] [--mode auto|keyword|hybrid] [--min-top1 0.9]`.
 * Runs @dalail/core retrieval against dist/dalail.db with node:sqlite — the same code path as the app.
 * Two sets, reported separately: fixture (fake data, fixture nodes only) and real (human-written,
 * real nodes only). --min-top1 gates the fixture set; --min-top1-real gates the real set.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { parseArgs } from 'node:util';
import { readMeta, retrieve, type SqlExecutor, type SqlValue } from '@dalail/core';
import { parse } from 'yaml';
import { computeMetrics, isTop1, type Metrics, type Outcome, type Question } from './metrics';

const here = dirname(new URL(import.meta.url).pathname);
const evalDir = resolve(here, '..');
const repo = resolve(evalDir, '..');

const { values: args } = parseArgs({
  options: {
    db: { type: 'string', default: resolve(repo, 'dist/dalail.db') },
    fixture: { type: 'string', default: resolve(evalDir, 'questions.fixture.yaml') },
    real: { type: 'string', default: resolve(evalDir, 'questions.real.yaml') },
    heldout: { type: 'string', default: resolve(evalDir, 'questions.heldout.yaml') },
    embeddings: { type: 'string', default: resolve(evalDir, '.cache/query-embeddings.json') },
    mode: { type: 'string', default: 'auto' },
    'min-top1': { type: 'string' },
    'min-top1-real': { type: 'string' },
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

const pct = (x: number) => `${(100 * x).toFixed(1)}%`.padStart(7);

function report(name: string, outcomes: Outcome[], m: Metrics, times: number[]): void {
  console.log(`\n=== ${name} eval: ${m.questions} question(s), ${m.answerable} answerable ===`);
  if (m.questions === 0) {
    console.log(
      '  (empty — add human-written questions to eval/questions.real.yaml; see eval/REAL_QUESTIONS.md)',
    );
    return;
  }
  console.log(
    `top-1 ${pct(m.top1)}   top-3 ${pct(m.top3)}   ambiguous ${pct(m.ambiguousRate)}   no-match ${pct(m.noMatchRate)}   status-accuracy ${pct(m.statusAccuracy)}`,
  );
  const sorted = [...times].sort((a, b) => a - b);
  console.log(
    `latency p50 ${sorted[Math.floor(sorted.length / 2)]?.toFixed(1)} ms, max ${sorted.at(-1)?.toFixed(1)} ms`,
  );
  for (const [style, s] of Object.entries(m.byStyle).sort()) {
    console.log(
      `  ${style.padEnd(12)} n=${String(s.n).padStart(2)}  top-1 ${pct(s.top1)}  top-3 ${pct(s.top3)}`,
    );
  }
  for (const o of outcomes) {
    const q = o.question;
    const miss = q.expect_status
      ? o.result.status !== q.expect_status || (q.expect && !isTop1(o))
      : !isTop1(o);
    if (!miss) continue;
    const got =
      o.result.candidates.map((c) => `${c.nodeId}(${c.confidence.toFixed(2)})`).join(', ') || '-';
    console.log(
      `  MISS "${q.q}" → ${o.result.status}: ${got}; expected ${q.expect_status ?? ''} ${(q.expect ?? []).join(', ')}`,
    );
  }
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
  const load = (file: string): Question[] =>
    existsSync(file)
      ? ((parse(readFileSync(file, 'utf8')) as { questions?: Question[] } | null)?.questions ?? [])
      : [];
  const sets = [
    { name: 'fixture', questions: load(args.fixture), fixture: 1 },
    { name: 'real', questions: load(args.real), fixture: 0 },
    { name: 'held-out (research)', questions: load(args.heldout), fixture: 0 },
  ];

  let vectors: Record<string, number[]> | null = null;
  const hasVec = meta.embed_model !== 'none';
  if (args.mode === 'hybrid' || (args.mode === 'auto' && hasVec)) {
    if (!hasVec) throw new Error('--mode hybrid needs a DB built with embeddings');
    if (!existsSync(args.embeddings)) {
      throw new Error(
        `no query embeddings at ${args.embeddings}; run: uv run python -m dalail_pipeline embed-queries ../eval/questions.fixture.yaml ../eval/questions.real.yaml`,
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
  console.log(
    `DB ${args.db} (corpus ${meta.corpus_version}, ${meta.build_mode}, embed_model=${meta.embed_model}); mode=${mode}`,
  );

  const results: Record<string, { metrics: Metrics; outcomes: Outcome[] }> = {};
  for (const set of sets) {
    const ids = await exec.all('SELECT id FROM nodes WHERE is_fixture = ?', [set.fixture]);
    const allowedNodeIds = new Set(ids.map((r) => String(r.id)));
    const outcomes: Outcome[] = [];
    const times: number[] = [];
    for (const question of set.questions) {
      const queryEmbedding = vectors ? (vectors[question.q] ?? null) : null;
      if (vectors && !queryEmbedding)
        throw new Error(`no embedding for "${question.q}"; re-run embed-queries`);
      const t0 = performance.now();
      const result = await retrieve(question.q, { exec, queryEmbedding, allowedNodeIds });
      times.push(performance.now() - t0);
      outcomes.push({ question, result });
    }
    const metrics = computeMetrics(outcomes);
    report(set.name, outcomes, metrics, times);
    results[set.name] = { metrics, outcomes };
  }
  if (args.verbose) console.log(JSON.stringify(results, null, 2));
  mkdirSync(dirname(args.out), { recursive: true });
  writeFileSync(args.out, JSON.stringify({ meta, mode, ...results }, null, 2));

  let code = 0;
  for (const [flag, name] of [
    ['min-top1', 'fixture'],
    ['min-top1-real', 'real'],
  ] as const) {
    const min = args[flag] === undefined ? null : Number(args[flag]);
    const m = results[name]?.metrics;
    if (min !== null && m && m.answerable > 0 && m.top1 < min) {
      console.error(`${name} top-1 ${pct(m.top1)} is below --${flag} ${pct(min)}`);
      code = 1;
    }
  }
  return code;
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  },
);

/**
 * Leave-one-out retrieval on the research aliases (dev builds, ADR 0008).
 *
 * For every Roman Urdu alias of a research claim that has ≥ 2 such aliases: remove that alias from
 * the index (FTS row + vector row) inside a transaction on a temp copy of the DB, search with its
 * text among research claims only, record where its own node lands, roll back.
 *
 *   pnpm --filter @dalail/eval loo --write-queries     # eval/.cache/loo-queries.yaml for embed-queries
 *   pnpm --filter @dalail/eval loo [--mode keyword|hybrid|both]
 */
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { parseArgs } from 'node:util';
import { readMeta, retrieve, type SqlExecutor, type SqlValue } from '@dalail/core';
import { stringify } from 'yaml';

const here = dirname(new URL(import.meta.url).pathname);
const evalDir = resolve(here, '..');
const repo = resolve(evalDir, '..');

const { values: args } = parseArgs({
  options: {
    db: { type: 'string', default: resolve(repo, 'dist/dalail.db') },
    embeddings: { type: 'string', default: resolve(evalDir, '.cache/loo-embeddings.json') },
    mode: { type: 'string', default: 'both' },
    'write-queries': { type: 'boolean', default: false },
    out: { type: 'string', default: resolve(evalDir, 'results/loo.json') },
  },
});

interface Alias {
  rowid: number;
  nodeId: string;
  topic: string;
  text: string;
}

interface Tally {
  n: number;
  top1: number;
  top3: number;
  ambiguous: number;
  noMatch: number;
}

const tally = (): Tally => ({ n: 0, top1: 0, top3: 0, ambiguous: 0, noMatch: 0 });
const pct = (x: number, n: number) => (n ? `${((100 * x) / n).toFixed(1)}%` : '—').padStart(7);

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

function loadAliases(db: DatabaseSync): { aliases: Alias[]; researchIds: Set<string> } {
  const rows = db
    .prepare(
      `SELECT a.rowid AS rowid, a.node_id AS node_id, n.topic AS topic, a.text AS text
         FROM node_aliases a JOIN nodes n ON n.id = a.node_id
        WHERE n.origin = 'gemini-research' AND n.node_type = 'claim-only' AND a.lang = 'roman-ur'
        ORDER BY a.rowid`,
    )
    .all() as { rowid: number; node_id: string; topic: string; text: string }[];
  const per = new Map<string, number>();
  for (const r of rows) per.set(r.node_id, (per.get(r.node_id) ?? 0) + 1);
  const researchIds = new Set(
    (
      db
        .prepare(
          "SELECT id FROM nodes WHERE origin = 'gemini-research' AND node_type = 'claim-only'",
        )
        .all() as {
        id: string;
      }[]
    ).map((r) => r.id),
  );
  return {
    aliases: rows
      .filter((r) => (per.get(r.node_id) ?? 0) >= 2)
      .map((r) => ({ rowid: r.rowid, nodeId: r.node_id, topic: r.topic, text: r.text })),
    researchIds,
  };
}

async function main(): Promise<number> {
  if (!existsSync(args.db)) {
    console.error(
      `no DB at ${args.db}; build it: cd pipeline && uv run python -m dalail_pipeline build --dev`,
    );
    return 1;
  }
  const work = join(mkdtempSync(join(tmpdir(), 'dalail-loo-')), 'dalail.db');
  copyFileSync(args.db, work);
  const db = new DatabaseSync(work, { allowExtension: true });
  const { aliases, researchIds } = loadAliases(db);
  if (aliases.length === 0) {
    console.error('no research aliases in this DB (build --dev after import-research)');
    return 1;
  }

  if (args['write-queries']) {
    const out = resolve(evalDir, '.cache/loo-queries.yaml');
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(
      out,
      stringify({ questions: [...new Set(aliases.map((a) => a.text))].map((q) => ({ q })) }),
    );
    console.log(
      `wrote ${aliases.length} queries -> ${out}\nnext: cd pipeline && uv run python -m dalail_pipeline embed-queries ../eval/.cache/loo-queries.yaml --out ../eval/.cache/loo-embeddings.json`,
    );
    return 0;
  }

  const exec: SqlExecutor = {
    all: async (sql, params = []) =>
      db.prepare(sql).all(...(params as (string | number | null | Uint8Array)[])) as Record<
        string,
        SqlValue
      >[],
  };
  const meta = await readMeta(exec);
  const hasVec = meta.embed_model !== 'none';
  let vectors: Record<string, number[]> | null = null;
  if (hasVec && existsSync(args.embeddings)) {
    const cache = JSON.parse(readFileSync(args.embeddings, 'utf8')) as {
      sha256: string;
      vectors: Record<string, number[]>;
    };
    if (cache.sha256 === meta.embed_model_sha256) vectors = cache.vectors;
  }
  if (vectors) db.loadExtension(sqliteVecPath());
  const modes = (args.mode === 'both' ? ['keyword', 'hybrid'] : [args.mode]).filter(
    (m) => m === 'keyword' || vectors,
  );
  if (args.mode !== 'keyword' && !vectors) {
    console.log(
      '(hybrid skipped: no vectors in the DB or no loo-embeddings.json — run with --write-queries first)',
    );
  }

  const results: Record<
    string,
    { overall: Tally; byTopic: Record<string, Tally>; misses: string[] }
  > = {};
  for (const mode of modes) {
    const overall = tally();
    const byTopic: Record<string, Tally> = {};
    const misses: string[] = [];
    for (const a of aliases) {
      db.exec('BEGIN');
      try {
        db.prepare('DELETE FROM nodes_fts WHERE rowid = ?').run(a.rowid);
        if (hasVec) db.prepare('DELETE FROM vec_aliases WHERE alias_rowid = ?').run(a.rowid);
        const r = await retrieve(a.text, {
          exec,
          queryEmbedding: mode === 'hybrid' ? (vectors?.[a.text] ?? null) : null,
          allowedNodeIds: researchIds,
        });
        const ids = r.candidates.map((c) => c.nodeId);
        for (const t of [overall, (byTopic[a.topic] ??= tally())]) {
          t.n += 1;
          t.top1 += Number(ids[0] === a.nodeId);
          t.top3 += Number(ids.slice(0, 3).includes(a.nodeId));
          t.ambiguous += Number(r.status === 'ambiguous');
          t.noMatch += Number(r.status === 'no_match');
        }
        if (ids[0] !== a.nodeId)
          misses.push(
            `${a.nodeId}: "${a.text.slice(0, 80)}" → ${r.status} ${ids.slice(0, 3).join(', ') || '-'}`,
          );
      } finally {
        db.exec('ROLLBACK');
      }
    }
    results[mode] = { overall, byTopic, misses };
    console.log(
      `\n=== leave-one-out (${mode}), research aliases: ${overall.n} queries over ${new Set(aliases.map((a) => a.nodeId)).size} claims ===`,
    );
    console.log(
      `top-1 ${pct(overall.top1, overall.n)}   top-3 ${pct(overall.top3, overall.n)}   ambiguous ${pct(overall.ambiguous, overall.n)}   no-match ${pct(overall.noMatch, overall.n)}`,
    );
    for (const [topic, t] of Object.entries(byTopic).sort()) {
      console.log(
        `  ${topic.padEnd(18)} n=${String(t.n).padStart(3)}  top-1 ${pct(t.top1, t.n)}  top-3 ${pct(t.top3, t.n)}  no-match ${pct(t.noMatch, t.n)}`,
      );
    }
  }
  mkdirSync(dirname(args.out), { recursive: true });
  writeFileSync(args.out, JSON.stringify({ meta, results }, null, 2));
  console.log(`\nfull results incl. misses: ${args.out}`);
  return 0;
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  },
);

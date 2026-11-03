import { baseTokens, isStopword, normaliseRomanUrdu } from '../normalise';
import type { RetrievalCandidate, RetrievalResult } from '../types';
import defaults from './config.json';
import { float32Blob, type Row, type SqlExecutor } from './sql';

export type RetrievalConfig = Omit<typeof defaults, '_doc'>;
export const defaultRetrievalConfig: RetrievalConfig = defaults;

export interface RetrieveOptions {
  exec: SqlExecutor;
  /** e5 vector of `query: <text>`; omit for keyword-only (Lite mode, --no-embed DB). */
  queryEmbedding?: ArrayLike<number> | null;
  /** Only these node statuses are eligible. Default: every status present in the DB. */
  statuses?: readonly string[];
  /** Restrict candidates to these node ids (eval uses it to keep fixture and real sets apart). */
  allowedNodeIds?: ReadonlySet<string>;
  config?: Partial<RetrievalConfig>;
}

interface NodeSignal {
  nodeId: string;
  coverage: number;
  bm25: number | null;
  cosine: number | null;
}

/** FTS5 query over normalised + folded columns. Every term is quoted, so user input cannot inject syntax. */
export function ftsQuery(terms: readonly string[]): string {
  const quoted = [...new Set(terms)].map((t) => `"${t.replaceAll('"', '""')}"`);
  return `{text_norm text_folded} : (${quoted.join(' OR ')})`;
}

/** For each content token of the query, the spellings that count as "that token". */
function queryTokenVariants(query: string, topicTokens: ReadonlySet<string>): Set<string>[] {
  return baseTokens(query)
    .filter((t) => !isStopword(t))
    .map((t) => {
      const n = normaliseRomanUrdu(t);
      return new Set([...n.norm.split(' '), ...n.folded.split(' ')].filter(Boolean));
    })
    .filter((v) => ![...v].some((t) => topicTokens.has(t)));
}

function coverage(variants: Set<string>[], aliasTokens: ReadonlySet<string>): number {
  if (variants.length === 0) return 0;
  const hit = variants.filter((v) => [...v].some((t) => aliasTokens.has(t))).length;
  return hit / variants.length;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export async function retrieve(query: string, opts: RetrieveOptions): Promise<RetrievalResult> {
  const cfg: RetrievalConfig = { ...defaultRetrievalConfig, ...opts.config };
  const { exec } = opts;
  const n = normaliseRomanUrdu(query);
  const terms = [...n.norm.split(' '), ...n.folded.split(' ')].filter(Boolean);
  if (terms.length === 0) return { status: 'no_match', candidates: [] };

  // --- keyword ---------------------------------------------------------------------
  const ftsRows = await exec.all(
    `SELECT node_id, topic, kind, text_norm, text_folded, bm25(nodes_fts) AS bm
       FROM nodes_fts WHERE nodes_fts MATCH ? ORDER BY bm LIMIT ?`,
    [ftsQuery(terms), cfg.ftsLimit],
  );
  const topicRows = ftsRows.filter((r) => r.kind === 'topic');
  const matchedTopics = new Set(topicRows.map((r) => String(r.topic)));
  const topicTokens = new Set(
    topicRows.flatMap((r) => `${String(r.text_norm)} ${String(r.text_folded)}`.split(' ')),
  );
  const variants = queryTokenVariants(query, topicTokens);
  // Only function words / topic names: nothing specific to look for.
  if (variants.length === 0) return { status: 'no_match', candidates: [] };

  const signals = new Map<string, NodeSignal>();
  const signal = (id: string): NodeSignal => {
    let s = signals.get(id);
    if (!s) {
      s = { nodeId: id, coverage: 0, bm25: null, cosine: null };
      signals.set(id, s);
    }
    return s;
  };
  for (const r of ftsRows) {
    if (r.kind === 'topic') continue;
    const s = signal(String(r.node_id));
    const aliasTokens = new Set(`${String(r.text_norm)} ${String(r.text_folded)}`.split(' '));
    s.coverage = Math.max(s.coverage, coverage(variants, aliasTokens));
    const bm = Number(r.bm);
    s.bm25 = s.bm25 === null ? bm : Math.min(s.bm25, bm);
  }

  // --- vector ----------------------------------------------------------------------
  if (opts.queryEmbedding) {
    const vecRows = await exec.all(
      `SELECT a.node_id AS node_id, MIN(vec_distance_cosine(v.embedding, ?)) AS d
         FROM vec_aliases v JOIN node_aliases a ON a.rowid = v.alias_rowid
        GROUP BY a.node_id ORDER BY d LIMIT ?`,
      [float32Blob(opts.queryEmbedding), cfg.vecLimit],
    );
    for (const r of vecRows) signal(String(r.node_id)).cosine = 1 - Number(r.d);
  }
  if (signals.size === 0) return { status: 'no_match', candidates: [] };

  // --- node info + status filter -----------------------------------------------------
  const ids = [...signals.keys()];
  const info = new Map<string, Row>();
  for (const r of await exec.all(
    `SELECT id, topic, claim_en, status FROM nodes WHERE id IN (${ids.map(() => '?').join(',')})`,
    ids,
  )) {
    info.set(String(r.id), r);
  }
  const eligible = [...signals.values()].filter((s) => {
    const row = info.get(s.nodeId);
    return (
      row !== undefined &&
      (!opts.statuses || opts.statuses.includes(String(row.status))) &&
      (!opts.allowedNodeIds || opts.allowedNodeIds.has(s.nodeId))
    );
  });

  // --- reciprocal rank fusion ----------------------------------------------------------
  const fused = new Map<string, number>();
  const addList = (list: NodeSignal[]) =>
    list.forEach((s, i) =>
      fused.set(s.nodeId, (fused.get(s.nodeId) ?? 0) + 1 / (cfg.rrfK + i + 1)),
    );
  addList(
    eligible
      .filter((s) => s.bm25 !== null)
      .sort((a, b) => b.coverage - a.coverage || (a.bm25 ?? 0) - (b.bm25 ?? 0)),
  );
  addList(
    eligible.filter((s) => s.cosine !== null).sort((a, b) => (b.cosine ?? 0) - (a.cosine ?? 0)),
  );

  const candidates: RetrievalCandidate[] = eligible.map((s) => {
    const row = info.get(s.nodeId) as Row;
    const vecConf =
      s.cosine === null ? 0 : clamp01((s.cosine - cfg.cosFloor) / (cfg.cosCeil - cfg.cosFloor));
    const topic = String(row.topic);
    // Keyword coverage and vector similarity are treated as independent evidence (noisy-OR):
    // each alone can carry a match, and agreement between them raises confidence.
    const evidence = 1 - (1 - s.coverage) * (1 - vecConf);
    const confidence = clamp01(evidence + (matchedTopics.has(topic) ? cfg.topicBoost : 0));
    return {
      nodeId: s.nodeId,
      score: fused.get(s.nodeId) ?? 0,
      confidence,
      coverage: s.coverage,
      cosine: s.cosine,
      topic,
      claimEn: String(row.claim_en),
      status: String(row.status),
    };
  });
  candidates.sort((a, b) => b.score - a.score || b.confidence - a.confidence);
  return decide(candidates, cfg);
}

/** confidence = f(top score, gap to #2); see docs/architecture.md. */
export function decide(sorted: RetrievalCandidate[], cfg: RetrievalConfig): RetrievalResult {
  const [top, second] = sorted;
  if (!top || top.confidence < cfg.minConfidence) return { status: 'no_match', candidates: [] };
  const gap = top.confidence - (second?.confidence ?? 0);
  if (gap >= cfg.minGap) return { status: 'match', candidates: [top] };
  const close = sorted
    .filter((c) => c.confidence >= top.confidence - cfg.ambiguousWindow)
    .slice(0, cfg.maxCandidates);
  return { status: 'ambiguous', candidates: close };
}

import { DatabaseSync } from 'node:sqlite';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  decide,
  defaultRetrievalConfig,
  ftsQuery,
  normaliseRomanUrdu,
  retrieve,
  type RetrievalCandidate,
  type SqlExecutor,
  type SqlValue,
} from '../src';

/**
 * A tiny DB with the same tables/columns the pipeline writes. Aliases are neutral words.
 * vec_distance_cosine is provided as a JS function so the vector path runs without sqlite-vec.
 */
const NODES: [id: string, topic: string, status: string, aliases: string[], vec: number[]][] = [
  ['n-pen', 't1', 'verified', ['qalam aur kitaab', 'pen and book'], [1, 0, 0]],
  ['n-window', 't1', 'verified', ['khidki aur darwaza', 'window and door'], [0, 1, 0]],
  ['n-home', 't1', 'verified', ['ghar ka rasta'], [0, 0, 1]],
  ['n-clock', 't2', 'verified', ['ghar ki deewaar ki ghadi'], [0, 0.6, 0.8]],
  ['n-draft', 't2', 'draft', ['chaand aur sitaare'], [0.6, 0.8, 0]],
];

function makeDb(): SqlExecutor {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE nodes (id TEXT PRIMARY KEY, topic TEXT, claim_en TEXT, status TEXT);
    CREATE TABLE node_aliases (rowid INTEGER PRIMARY KEY, node_id TEXT, text TEXT, text_norm TEXT, text_folded TEXT);
    CREATE TABLE vec_aliases (alias_rowid INTEGER PRIMARY KEY, embedding BLOB);
    CREATE VIRTUAL TABLE nodes_fts USING fts5(text, text_norm, text_folded, node_id UNINDEXED, topic UNINDEXED, kind UNINDEXED);
  `);
  db.function('vec_distance_cosine', (a: SqlValue, b: SqlValue) => {
    const fa = new Float32Array((a as Uint8Array).slice().buffer);
    const fb = new Float32Array((b as Uint8Array).slice().buffer);
    let dot = 0, na = 0, nb = 0; // prettier-ignore
    fa.forEach((x, i) => {
      const y = fb[i] ?? 0;
      dot += x * y;
      na += x * x;
      nb += y * y;
    });
    return 1 - dot / Math.sqrt(na * nb);
  });
  let rowid = 0;
  for (const [id, topic, status, aliases, vec] of NODES) {
    db.prepare('INSERT INTO nodes VALUES (?, ?, ?, ?)').run(id, topic, `claim ${id}`, status);
    for (const text of aliases) {
      rowid += 1;
      const n = normaliseRomanUrdu(text);
      db.prepare('INSERT INTO node_aliases VALUES (?, ?, ?, ?, ?)').run(
        rowid,
        id,
        text,
        n.norm,
        n.folded,
      );
      db.prepare('INSERT INTO nodes_fts(rowid, text, text_norm, text_folded, node_id, topic, kind) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        rowid, text, n.norm, n.folded, id, topic, 'alias',
      ); // prettier-ignore
      db.prepare('INSERT INTO vec_aliases VALUES (?, ?)').run(
        rowid,
        new Uint8Array(Float32Array.from(vec).buffer),
      );
    }
  }
  const n = normaliseRomanUrdu('Topic One');
  db.prepare("INSERT INTO nodes_fts(text, text_norm, text_folded, node_id, topic, kind) VALUES (?, ?, ?, '', 't1', 'topic')").run(
    'Topic One', n.norm, n.folded,
  ); // prettier-ignore
  return {
    all: async (sql, params = []) =>
      db.prepare(sql).all(...(params as (string | number | null | Uint8Array)[])) as Record<
        string,
        SqlValue
      >[],
  };
}

let exec: SqlExecutor;
beforeAll(() => {
  exec = makeDb();
});

describe('retrieve (keyword only)', () => {
  it('matches an exact Roman Urdu phrasing', async () => {
    const r = await retrieve('qalam aur kitaab', { exec });
    expect(r.status).toBe('match');
    expect(r.candidates[0]?.nodeId).toBe('n-pen');
  });

  it('matches spelling variants through folding', async () => {
    for (const q of ['kalam kitab', 'QALAM, kitaab!', 'kidki darvaza']) {
      const r = await retrieve(q, { exec });
      expect(r.status, q).toBe('match');
    }
  });

  it('matches English twins', async () => {
    const r = await retrieve('the window and the door', { exec });
    expect(r.candidates[0]?.nodeId).toBe('n-window');
  });

  it('returns ambiguous (never a single match) when two nodes are equally close', async () => {
    const r = await retrieve('ghar', { exec });
    expect(r.status).toBe('ambiguous');
    expect(r.candidates.map((c) => c.nodeId).sort()).toEqual(['n-clock', 'n-home']);
    expect(r.candidates.length).toBeLessThanOrEqual(3);
  });

  it('returns no_match for unrelated or empty queries', async () => {
    expect((await retrieve('cricket score batao', { exec })).status).toBe('no_match');
    expect((await retrieve('  ?!  ', { exec })).status).toBe('no_match');
  });

  it('filters by status', async () => {
    expect((await retrieve('chaand sitaare', { exec })).candidates[0]?.nodeId).toBe('n-draft');
    expect((await retrieve('chaand sitaare', { exec, statuses: ['verified'] })).status).toBe(
      'no_match',
    );
  });

  it('restricts candidates to allowedNodeIds', async () => {
    const r = await retrieve('ghar', { exec, allowedNodeIds: new Set(['n-clock']) });
    expect(r.candidates.map((c) => c.nodeId)).toEqual(['n-clock']);
  });

  it('is safe against FTS syntax in user input', async () => {
    for (const q of [
      '"qalam',
      'qalam OR',
      'NEAR(qalam kitaab)',
      'text_norm:qalam',
      '*',
      'qalam -kitaab',
    ]) {
      await expect(retrieve(q, { exec })).resolves.toBeDefined();
    }
  });

  it('returns no_match when the query has only function words', async () => {
    expect((await retrieve('aur ke ki', { exec, queryEmbedding: [1, 0, 0] })).status).toBe(
      'no_match',
    );
  });

  it('ignores topic-name words when measuring coverage', async () => {
    const r = await retrieve('topic one qalam kitaab', { exec });
    expect(r.status).toBe('match');
    expect(r.candidates[0]?.coverage).toBe(1);
  });
});

describe('retrieve (hybrid)', () => {
  it('finds a node by vector when keywords miss', async () => {
    const r = await retrieve('xyz unrelated words', { exec, queryEmbedding: [0.99, 0.01, 0] });
    expect(r.candidates[0]?.nodeId).toBe('n-pen');
    expect(r.candidates[0]?.cosine).toBeGreaterThan(0.99);
  });
});

describe('decide', () => {
  const c = (nodeId: string, confidence: number): RetrievalCandidate => ({
    nodeId, score: 0, confidence, coverage: confidence, cosine: null, topic: 't', claimEn: '', status: 'verified',
  }); // prettier-ignore
  const cfg = defaultRetrievalConfig;
  it('match needs a clear gap', () => {
    expect(decide([c('a', 1), c('b', 0.5)], cfg).status).toBe('match');
    expect(decide([c('a', 1), c('b', 0.9), c('c', 0.85), c('d', 0.8)], cfg)).toMatchObject({
      status: 'ambiguous',
    });
    expect(
      decide([c('a', 1), c('b', 0.9), c('c', 0.85), c('d', 0.8)], cfg).candidates,
    ).toHaveLength(3);
  });
  it('low confidence is no_match', () => {
    expect(decide([c('a', 0.2)], cfg).status).toBe('no_match');
    expect(decide([], cfg).status).toBe('no_match');
  });
});

describe('ftsQuery', () => {
  it('quotes and de-duplicates terms', () => {
    expect(ftsQuery(['a"b', 'c', 'c'])).toBe('{text_norm text_folded} : ("a""b" OR "c")');
  });
});

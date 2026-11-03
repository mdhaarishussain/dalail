import { parseDalilRef, type Row, type SqlExecutor } from '@dalail/core';
import type {
  ResearchInfo,
  AyahText,
  CorpusMeta,
  Dalil,
  NodeDetail,
  NodeStatus,
  NodeSummary,
  Opponent,
  SourceRef,
  Topic,
} from './types';

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const strOrNull = (v: unknown): string | null =>
  v === null || v === undefined || v === '' ? null : String(v);
const RESEARCH = 'gemini-research';
const json = <T>(v: unknown, fallback: T): T => {
  try {
    return v ? (JSON.parse(String(v)) as T) : fallback;
  } catch {
    return fallback;
  }
};

function summary(r: Row): NodeSummary {
  return {
    id: str(r.id),
    topic: str(r.topic),
    claimEn: str(r.claim_en),
    status: str(r.status) as NodeStatus,
    isFixture: Number(r.is_fixture) === 1,
    opponents: json<string[]>(r.opponent_json, []),
    origin: str(r.origin) === RESEARCH ? RESEARCH : 'scholar-article',
  };
}

const COLS = 'id, topic, claim_en, status, is_fixture, opponent_json, origin, node_type';

/** Read-only access to dalail.db. Works on any SqlExecutor (op-sqlite on device, node:sqlite in tests). */
export class CorpusRepository {
  constructor(
    readonly exec: SqlExecutor,
    /** Statuses the UI may show for corpus nodes. Prod DBs only contain verified rows anyway. */
    public statuses: readonly NodeStatus[] = ['verified'],
    /** Dev builds only: include the Gemini research import (ADR 0008). */
    public includeResearch = false,
  ) {}

  /** Visible = (corpus node with an allowed status) OR (research node and research is switched on). */
  private visible(prefix = ''): { sql: string; params: (string | number)[] } {
    const origin = `${prefix}origin`;
    const status = `${prefix}status`;
    return {
      sql: `((${origin} != '${RESEARCH}' AND ${status} IN (${this.statuses.map(() => '?').join(',')}))
             OR (${origin} = '${RESEARCH}' AND ? = 1))`,
      params: [...this.statuses, this.includeResearch ? 1 : 0],
    };
  }

  /** Same rule for search results (see runSearch). */
  isEligible = (n: { status: string; origin: string }): boolean =>
    n.origin === RESEARCH ? this.includeResearch : this.statuses.includes(n.status as NodeStatus);

  async meta(): Promise<CorpusMeta> {
    const rows = await this.exec.all('SELECT key, value FROM meta');
    const m = Object.fromEntries(rows.map((r) => [str(r.key), str(r.value)]));
    return {
      corpusVersion: m.corpus_version ?? '',
      buildMode: m.build_mode === 'prod' ? 'prod' : 'dev',
      embedModel: m.embed_model ?? 'none',
      builtAt: m.built_at ?? '',
      sha: m.sha ?? '',
    };
  }

  async topics(): Promise<Topic[]> {
    const rows = await this.exec.all(
      'SELECT id, name_en, name_roman_urdu FROM topics ORDER BY sort, id',
    );
    return rows.map((r) => ({
      id: str(r.id),
      nameEn: str(r.name_en),
      nameRomanUrdu: str(r.name_roman_urdu),
    }));
  }

  async opponents(): Promise<Opponent[]> {
    const rows = await this.exec.all(
      'SELECT id, name_en, name_roman_urdu FROM opponents ORDER BY id',
    );
    return rows.map((r) => ({
      id: str(r.id),
      nameEn: str(r.name_en),
      nameRomanUrdu: str(r.name_roman_urdu),
    }));
  }

  async nodesByTopic(topic: string, opponent?: string | null): Promise<NodeSummary[]> {
    const v = this.visible();
    const rows = await this.exec.all(
      `SELECT ${COLS} FROM nodes
        WHERE topic = ? AND node_type != 'counter-question' AND ${v.sql} ORDER BY id`,
      [topic, ...v.params],
    );
    return rows.map(summary).filter((n) => !opponent || n.opponents.includes(opponent));
  }

  async summaries(ids: readonly string[]): Promise<NodeSummary[]> {
    if (ids.length === 0) return [];
    const v = this.visible();
    const rows = await this.exec.all(
      `SELECT ${COLS} FROM nodes
        WHERE id IN (${ids.map(() => '?').join(',')}) AND ${v.sql}`,
      [...ids, ...v.params],
    );
    const byId = new Map(rows.map((r) => [str(r.id), summary(r)]));
    return ids.flatMap((id) => (byId.has(id) ? [byId.get(id) as NodeSummary] : []));
  }

  async node(id: string): Promise<NodeDetail | null> {
    const v = this.visible();
    const [r] = await this.exec.all(`SELECT * FROM nodes WHERE id = ? AND ${v.sql}`, [
      id,
      ...v.params,
    ]);
    if (!r) return null;
    const refs = await this.exec.all(
      'SELECT ref, role FROM node_dalail WHERE node_id = ? ORDER BY ord',
      [id],
    );
    const edges = await this.exec.all(
      "SELECT to_id FROM edges WHERE from_id = ? AND kind = 'follow_up' ORDER BY ord",
      [id],
    );
    const research =
      str(r.origin) === RESEARCH
        ? await this.researchInfo(id, json<Record<string, unknown>>(r.research_json, {}))
        : null;
    return {
      ...summary(r),
      research,
      shortAnswer: str(r.short_answer),
      shortAnswerOrigin:
        str(r.short_answer_origin) === 'scholar_review' ? 'scholar_review' : 'article',
      bodyMd: str(r.body_md),
      lang: str(r.lang) || 'en',
      madhhab: str(r.madhhab),
      responseSource: json<SourceRef>(r.response_source_json, {}),
      claimSource: json<SourceRef>(r.claim_source_json, {}),
      verifiedBy: strOrNull(r.verified_by),
      verifiedOn: strOrNull(r.verified_on),
      dalail: refs.filter((x) => x.role === 'supports').map((x) => str(x.ref)),
      theirEvidence: refs.filter((x) => x.role === 'opponent_cites').map((x) => str(x.ref)),
      followUps: await this.summaries(edges.map((e) => str(e.to_id))),
    };
  }

  /** Topics that have at least one visible node (Browse hides empty ones). */
  async topicsWithContent(): Promise<(Topic & { count: number })[]> {
    const v = this.visible('n.');
    const rows = await this.exec.all(
      `SELECT t.id, t.name_en, t.name_roman_urdu, COUNT(n.id) AS n FROM topics t
         JOIN nodes n ON n.topic = t.id AND n.node_type != 'counter-question' AND ${v.sql}
        GROUP BY t.id ORDER BY t.sort, t.id`,
      v.params,
    );
    return rows.map((r) => ({
      id: str(r.id),
      nameEn: str(r.name_en),
      nameRomanUrdu: str(r.name_roman_urdu),
      count: Number(r.n),
    }));
  }

  private async researchInfo(id: string, j: Record<string, unknown>): Promise<ResearchInfo> {
    const cqRows = await this.exec.all(
      `SELECT n.id, n.claim_en, n.research_json FROM edges e JOIN nodes n ON n.id = e.from_id
        WHERE e.to_id = ? AND e.kind = 'counters' ORDER BY n.id`,
      [id],
    );
    const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
    return {
      summaryEn: str(j.summary_en),
      moveType: str(j.move_type),
      suggestedName: strOrNull(j.suggested_name),
      occurrences: arr<Record<string, unknown>>(j.occurrences).map((o) => ({
        sourceId: str(o.source_id),
        title: str(o.title),
        quote: str(o.quote),
        at: str(o.at),
        deepLink: str(o.deep_link),
        coverage: Number(o.coverage ?? 0),
      })),
      candidateResponses: arr<Record<string, unknown>>(j.candidate_responses).map((c) => ({
        speaker: str(c.speaker),
        quote: str(c.quote),
        summaryEn: str(c.summary_en),
        evidenceAsSaid: arr<string>(c.evidence_as_said).map(str),
        at: str(c.at),
        deepLink: str(c.deep_link),
      })),
      counterQuestions: cqRows.map((c) => {
        const cj = json<Record<string, unknown>>(c.research_json, {});
        return {
          id: str(c.id),
          quote: str(c.claim_en),
          summaryEn: str(cj.summary_en),
          at: str(cj.at),
          deepLink: str(cj.deep_link),
        };
      }),
    };
  }

  async dalil(ref: string): Promise<Dalil> {
    const p = parseDalilRef(ref);
    if (!p) return { kind: 'missing', ref, missing: true };
    if (p.kind === 'quran') {
      const rows = await this.exec.all(
        'SELECT * FROM quran_ayah WHERE surah = ? AND ayah BETWEEN ? AND ? ORDER BY ayah',
        [p.surah, p.from, p.to],
      );
      const ayat: AyahText[] = rows.map((r) => ({
        surah: Number(r.surah),
        ayah: Number(r.ayah),
        textAr: str(r.text_ar),
        translationUr: strOrNull(r.translation_ur),
        translationEn: strOrNull(r.translation_en),
        translationEnSource: strOrNull(r.translation_en_source),
      }));
      return {
        kind: 'quran',
        ref,
        surah: p.surah,
        from: p.from,
        to: p.to,
        ayat,
        missing: ayat.length === 0,
      };
    }
    if (p.kind === 'hadith') {
      const [r] = await this.exec.all('SELECT * FROM hadith WHERE id = ?', [p.id]);
      if (!r) return { kind: 'missing', ref, missing: true };
      return {
        kind: 'hadith',
        ref,
        id: p.id,
        textAr: strOrNull(r.text_ar),
        translation: str(r.translation),
        reference: str(r.reference),
        grading: strOrNull(r.grading),
        source: json<SourceRef>(r.source_json, {}),
        status: str(r.status) as NodeStatus,
        missing: false,
      };
    }
    const hasFixtures = await this.exec.all(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'fixture_dalil'",
    );
    if (hasFixtures.length === 0) return { kind: 'missing', ref, missing: true };
    const [r] = await this.exec.all('SELECT * FROM fixture_dalil WHERE ref = ?', [ref]);
    if (!r) return { kind: 'missing', ref, missing: true };
    return {
      kind: 'fixture',
      ref,
      collection: p.collection,
      textAr: str(r.text_ar),
      translation: str(r.translation),
      reference: str(r.reference),
      grading: strOrNull(r.grading),
      missing: false,
    };
  }

  /** Nodes (visible ones) that cite a dalil ref, either side. */
  async citing(ref: string): Promise<NodeSummary[]> {
    const rows = await this.exec.all(
      'SELECT DISTINCT node_id FROM node_dalail WHERE ref = ? ORDER BY node_id',
      [ref],
    );
    return this.summaries(rows.map((r) => str(r.node_id)));
  }
}

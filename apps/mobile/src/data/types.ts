export type NodeStatus = 'draft' | 'under_review' | 'verified';

export interface Topic {
  id: string;
  nameEn: string;
  nameRomanUrdu: string;
}

export interface Opponent {
  id: string;
  nameEn: string;
  nameRomanUrdu: string;
}

export interface NodeSummary {
  id: string;
  topic: string;
  claimEn: string;
  status: NodeStatus;
  isFixture: boolean;
  opponents: string[];
  /** 'gemini-research' only in dev builds (ADR 0008). */
  origin: 'scholar-article' | 'gemini-research';
}

/** AI-extracted debate data (dev builds only). Never verified, never shareable. */
export interface ResearchInfo {
  summaryEn: string;
  moveType: string;
  suggestedName: string | null;
  occurrences: {
    sourceId: string;
    title: string;
    quote: string;
    at: string;
    deepLink: string;
    coverage: number;
  }[];
  candidateResponses: {
    speaker: string;
    quote: string;
    summaryEn: string;
    evidenceAsSaid: string[];
    at: string;
    deepLink: string;
  }[];
  counterQuestions: {
    id: string;
    quote: string;
    summaryEn: string;
    at: string;
    deepLink: string;
  }[];
}

export interface SourceRef {
  scholar?: string;
  work?: string;
  url?: string;
  page?: string;
  author?: string;
}

export interface NodeDetail extends NodeSummary {
  research: ResearchInfo | null;
  shortAnswer: string;
  shortAnswerOrigin: 'article' | 'scholar_review';
  bodyMd: string;
  lang: string;
  madhhab: string;
  responseSource: SourceRef;
  claimSource: SourceRef;
  verifiedBy: string | null;
  verifiedOn: string | null;
  /** Refs the scholar uses (dalail list + inline chips), in order. */
  dalail: string[];
  /** Refs the opponent cites. */
  theirEvidence: string[];
  followUps: NodeSummary[];
}

export interface AyahText {
  surah: number;
  ayah: number;
  textAr: string;
  translationUr: string | null;
  translationEn: string | null;
  translationEnSource: string | null;
}

export type Dalil =
  | {
      kind: 'quran';
      ref: string;
      surah: number;
      from: number;
      to: number;
      ayat: AyahText[];
      missing: boolean;
    }
  | {
      kind: 'hadith';
      ref: string;
      id: string;
      textAr: string | null;
      translation: string;
      reference: string;
      grading: string | null;
      source: SourceRef;
      status: NodeStatus;
      missing: false;
    }
  | {
      kind: 'fixture';
      ref: string;
      collection: 'quran' | 'hadith';
      textAr: string;
      translation: string;
      reference: string;
      grading: string | null;
      missing: false;
    }
  | { kind: 'missing'; ref: string; missing: true };

export interface CorpusMeta {
  corpusVersion: string;
  buildMode: 'dev' | 'prod';
  embedModel: string;
  builtAt: string;
  sha: string;
}

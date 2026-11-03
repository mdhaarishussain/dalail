import { parseInline, parseMarkdown, stripResponseHeading } from '../ui/markdown';
import { detectTier, effectiveTier, FULL_TIER_MIN_BYTES } from '../services/tier';
import { MAX_RECENTS, useUser } from '../state/userStore';
import { canShare, formatShareText } from '../share/shareText';
import type { NodeDetail } from '../data/types';
import { resetUser } from './helpers';

describe('markdown subset', () => {
  it('parses paragraphs, lists, emphasis and chips', () => {
    const blocks = parseMarkdown(
      '## Response\n\nA **b** *c* [[quran:5:35]].\n\n- one\n- two\n\n1. x\n2. y',
    );
    expect(blocks.map((b) => b.kind)).toEqual(['heading', 'paragraph', 'list', 'list']);
    expect(parseInline('A **b** [[hadith:h-0001]]')).toEqual([
      { kind: 'text', text: 'A ' },
      { kind: 'text', text: 'b', bold: true },
      { kind: 'text', text: ' ' },
      { kind: 'ref', ref: 'hadith:h-0001' },
    ]);
    expect(stripResponseHeading('## Response\n\nbody')).toBe('\nbody');
  });

  it('keeps text exactly (no rewriting) including Urdu script', () => {
    const urdu = 'یہ نمونہ ہے۔';
    expect(parseMarkdown(urdu)).toEqual([
      { kind: 'paragraph', inline: [{ kind: 'text', text: urdu }] },
    ]);
  });
});

describe('tier', () => {
  it('uses Full at >= 5 GiB and honours overrides', () => {
    expect(detectTier(FULL_TIER_MIN_BYTES)).toBe('full');
    expect(detectTier(4 * 1024 ** 3)).toBe('lite');
    expect(detectTier(null)).toBe('lite');
    expect(effectiveTier('lite', 'full')).toBe('full');
    expect(effectiveTier('full', 'auto')).toBe('full');
  });
});

describe('user store', () => {
  beforeEach(() => resetUser());

  it('keeps recents unique and capped', () => {
    for (let i = 0; i < MAX_RECENTS + 5; i += 1) useUser.getState().addRecent(`q${i}`);
    useUser.getState().addRecent('q3');
    const r = useUser.getState().recents;
    expect(r).toHaveLength(MAX_RECENTS);
    expect(r[0]?.q).toBe('q3');
  });

  it('tracks the debate path, jumps back and starts over', () => {
    const s = useUser.getState();
    s.visit('a');
    s.visit('b');
    s.visit('b');
    s.visit('c');
    expect(useUser.getState().debatePath).toEqual(['a', 'b', 'c']);
    useUser.getState().jumpTo('a');
    expect(useUser.getState().debatePath).toEqual(['a']);
    useUser.getState().newDebate();
    expect(useUser.getState().debatePath).toEqual([]);
  });

  it('saves a question once', () => {
    useUser.getState().saveQuestion(' x ');
    useUser.getState().saveQuestion('x');
    expect(useUser.getState().savedQuestions.map((q) => q.q)).toEqual(['x']);
  });
});

describe('share text', () => {
  const node = {
    id: 'n',
    topic: 't',
    claimEn: 'Claim',
    status: 'verified',
    isFixture: false,
    opponents: [],
    shortAnswer: 'Short',
    shortAnswerOrigin: 'article',
    bodyMd: '',
    lang: 'en',
    madhhab: 'all',
    responseSource: { scholar: 'S', work: 'W', page: '3' },
    claimSource: {},
    verifiedBy: 'V',
    verifiedOn: '2026-11-01',
    dalail: [],
    theirEvidence: [],
    followUps: [],
  } satisfies NodeDetail;

  it('formats verified answers for WhatsApp', () => {
    const text = formatShareText(node, [
      { kind: 'quran', ref: 'quran:5:35', surah: 5, from: 35, to: 35, ayat: [], missing: false },
    ]);
    expect(text).toBe('*Claim*\n\nShort\n\nDalail: Quran 5:35\n\n— S, W, p. 3');
  });

  it('refuses fixtures and unverified answers', () => {
    expect(canShare({ ...node, isFixture: true })).toBe(false);
    expect(formatShareText({ ...node, status: 'draft' }, [])).toBeNull();
  });
});

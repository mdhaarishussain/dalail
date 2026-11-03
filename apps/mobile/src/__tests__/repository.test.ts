import { CorpusRepository } from '../data/repository';
import { testExecutor } from './helpers';

const ALL = ['verified', 'under_review', 'draft'] as const;

describe('CorpusRepository (fixture dev DB)', () => {
  const exec = testExecutor();
  const repo = new CorpusRepository(exec, ALL);

  it('reads meta and topics', async () => {
    const meta = await repo.meta();
    expect(meta.buildMode).toBe('dev');
    expect((await repo.topics()).map((t) => t.id)).toEqual(['tawassul', 'istighatha']);
  });

  it('loads a node with refs and follow-ups in order', async () => {
    const n = await repo.node('fixture-tawassul-001');
    expect(n?.claimEn.startsWith('FIXTURE:')).toBe(true);
    expect(n?.dalail).toEqual(['fixture:quran:1', 'fixture:hadith:1']);
    expect(n?.theirEvidence).toEqual(['fixture:quran:2']);
    expect(n?.followUps.map((f) => f.id)).toEqual(['fixture-tawassul-002', 'fixture-tawassul-003']);
    expect(n?.isFixture).toBe(true);
  });

  it('hides non-verified nodes unless allowed', async () => {
    const verifiedOnly = new CorpusRepository(exec);
    expect(await verifiedOnly.node('fixture-tawassul-005')).toBeNull();
    expect(
      (await verifiedOnly.nodesByTopic('tawassul')).every((n) => n.status === 'verified'),
    ).toBe(true);
    expect(await repo.node('fixture-tawassul-005')).not.toBeNull();
  });

  it('resolves fixture dalil with and without grading', async () => {
    const h1 = await repo.dalil('fixture:hadith:1');
    const h2 = await repo.dalil('fixture:hadith:2');
    expect(h1.kind === 'fixture' && h1.grading).toBeTruthy();
    expect(h2.kind === 'fixture' && h2.grading).toBeNull();
    expect((await repo.dalil('quran:1:1')).missing).toBe(true); // no Quran data in fixtures
    expect((await repo.dalil('bogus')).kind).toBe('missing');
  });

  it('lists nodes citing a dalil and filters by opponent', async () => {
    expect((await repo.citing('fixture:quran:1')).map((n) => n.id)).toContain(
      'fixture-tawassul-001',
    );
    expect(await repo.nodesByTopic('tawassul', 'rawafidh')).toEqual([]);
    expect((await repo.nodesByTopic('tawassul', 'wahhabi')).length).toBe(6);
  });
});

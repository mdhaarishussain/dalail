import { ensureVerifiedModel, type ModelCopyIO } from '../services/modelCopy';

const GOOD = 'ab'.repeat(32);
const expected = { sha256: GOOD, sizeBytes: 100 };

function io(shas: (string | null)[], opts: { size?: number | null; copyFails?: boolean } = {}) {
  const calls = { copy: 0, remove: 0 };
  const queue = [...shas];
  const impl: ModelCopyIO = {
    copy: async () => {
      calls.copy += 1;
      if (opts.copyFails) throw new Error('no asset');
    },
    sha256: async () => (queue.length ? (queue.shift() as string | null) : GOOD),
    size: () => (opts.size === undefined ? 100 : opts.size),
    remove: () => {
      calls.remove += 1;
    },
  };
  return { impl, calls };
}

describe('ensureVerifiedModel', () => {
  it('copies and verifies on the first launch of a build', async () => {
    const { impl, calls } = io([GOOD]);
    expect(
      await ensureVerifiedModel(impl, expected, { fresh: true, verifiedForThisBuild: false }),
    ).toEqual({
      status: 'verified',
      attempts: 1,
    });
    expect(calls.copy).toBe(1);
  });

  it('deletes and retries once on a sha256 mismatch', async () => {
    const { impl, calls } = io(['00'.repeat(32), GOOD]);
    const r = await ensureVerifiedModel(impl, expected, {
      fresh: true,
      verifiedForThisBuild: false,
    });
    expect(r).toEqual({ status: 'verified', attempts: 2 });
    expect(calls.remove).toBe(1);
  });

  it('gives up after the retry and reports the mismatch (search falls back to keyword-only)', async () => {
    const { impl, calls } = io(['00'.repeat(32), '11'.repeat(32)]);
    expect(
      (await ensureVerifiedModel(impl, expected, { fresh: true, verifiedForThisBuild: false }))
        .status,
    ).toBe('sha_mismatch');
    expect(calls.remove).toBe(2);
  });

  it('skips hashing on later launches when the verified copy has the right size', async () => {
    const { impl, calls } = io([]);
    expect(
      await ensureVerifiedModel(impl, expected, { fresh: false, verifiedForThisBuild: true }),
    ).toEqual({
      status: 'verified',
      attempts: 0,
    });
    expect(calls.copy).toBe(0);
  });

  it('re-copies when a previously verified file was truncated', async () => {
    const { impl, calls } = io([GOOD], { size: 10 });
    expect(
      (await ensureVerifiedModel(impl, expected, { fresh: false, verifiedForThisBuild: true }))
        .status,
    ).toBe('verified');
    expect(calls.copy).toBe(1);
  });

  it('reports not_bundled when the APK has no model (keyword-only DB build)', async () => {
    const { impl } = io([], { copyFails: true });
    expect(
      (await ensureVerifiedModel(impl, expected, { fresh: true, verifiedForThisBuild: false }))
        .status,
    ).toBe('not_bundled');
  });
});

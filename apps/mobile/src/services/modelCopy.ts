/**
 * Copy-out of the bundled e5 GGUF with integrity check (ADR 0007).
 * Pure logic, so it can be unit-tested; device.ts wires in op-sqlite / expo-file-system.
 */
export type ModelStatus = 'verified' | 'missing' | 'sha_mismatch' | 'not_bundled';

export interface ModelCopyIO {
  /** Copy the asset to the destination; overwrite an existing copy when asked. */
  copy: (overwrite: boolean) => Promise<void>;
  /** Hex SHA-256 of the destination file, or null if it does not exist. */
  sha256: () => Promise<string | null>;
  /** Size in bytes of the destination, or null if missing. */
  size: () => number | null;
  remove: () => void;
}

export interface ModelCopyResult {
  status: ModelStatus;
  attempts: number;
}

/**
 * - First launch of a build (`fresh`): copy, hash, compare with the pinned sha256.
 *   On mismatch delete and copy again (up to `maxAttempts`); if it still fails, report it and
 *   let search run keyword-only.
 * - Later launches: the copy was verified for this build; a cheap size check catches truncation
 *   (e.g. storage cleared mid-copy), which triggers a full re-copy + re-hash.
 */
export async function ensureVerifiedModel(
  io: ModelCopyIO,
  expected: { sha256: string; sizeBytes: number },
  opts: { fresh: boolean; verifiedForThisBuild: boolean; maxAttempts?: number },
): Promise<ModelCopyResult> {
  const max = opts.maxAttempts ?? 2;
  if (!opts.fresh && opts.verifiedForThisBuild && io.size() === expected.sizeBytes) {
    return { status: 'verified', attempts: 0 };
  }
  for (let attempt = 1; attempt <= max; attempt += 1) {
    try {
      await io.copy(true);
    } catch {
      return { status: 'not_bundled', attempts: attempt };
    }
    const sha = await io.sha256().catch(() => null);
    if (sha === null) return { status: 'missing', attempts: attempt };
    if (sha.toLowerCase() === expected.sha256.toLowerCase())
      return { status: 'verified', attempts: attempt };
    io.remove();
  }
  return { status: 'sha_mismatch', attempts: max };
}

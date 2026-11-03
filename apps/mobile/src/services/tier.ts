import type { ModeOverride } from '../state/userStore';

export type Tier = 'full' | 'lite';

/**
 * Phones sold as "6 GB" report roughly 5.3–5.8 GiB of total memory, so the cut is at 5 GiB.
 * Phase 2 behaves as Lite either way; the label is shown so users know what to expect.
 */
export const FULL_TIER_MIN_BYTES = 5 * 1024 ** 3;

export function detectTier(totalMemoryBytes: number | null): Tier {
  return totalMemoryBytes !== null && totalMemoryBytes >= FULL_TIER_MIN_BYTES ? 'full' : 'lite';
}

export function effectiveTier(detected: Tier, override: ModeOverride): Tier {
  return override === 'auto' ? detected : override;
}

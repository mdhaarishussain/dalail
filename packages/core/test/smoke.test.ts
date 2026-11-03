import { describe, expect, it } from 'vitest';
import { CORE_VERSION, type RetrievalResult } from '../src/index';

describe('@dalail/core scaffold', () => {
  it('exports a version', () => {
    expect(CORE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('accepts a no_match result shape', () => {
    const result: RetrievalResult = { status: 'no_match', candidates: [] };
    expect(result.candidates).toHaveLength(0);
  });
});

import { describe, expect, it } from 'vitest';
import { describeRunner } from '../src/index';

describe('@dalail/eval scaffold', () => {
  it('links against @dalail/core', () => {
    expect(describeRunner()).toContain('core 0.0.0');
  });
});

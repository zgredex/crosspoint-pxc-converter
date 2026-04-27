import { describe, expect, it } from 'vitest';

import { ditherToIndexedGray } from '../../src/domain/dither';

describe('ditherToIndexedGray', () => {
  it('quantizes directly when dithering is disabled', () => {
    const result = ditherToIndexedGray(new Float32Array([0, 84, 170, 255]), 4, 1, false, 'fs');
    expect(Array.from(result)).toEqual([0, 1, 2, 3]);
  });

  it('produces a deterministic Bayer result', () => {
    const result = ditherToIndexedGray(new Float32Array([100]), 1, 1, true, 'bayer');
    expect(Array.from(result)).toEqual([2]);
  });

  it('produces a deterministic blue noise result', () => {
    const result = ditherToIndexedGray(new Float32Array([100, 100, 100, 100]), 2, 2, true, 'blue-noise');
    expect(Array.from(result)).toEqual([1, 1, 2, 1]);
  });

  it('keeps output values within the 0..3 palette range', () => {
    const result = ditherToIndexedGray(new Float32Array([10, 120, 180, 250]), 2, 2, true, 'fs');
    expect(Array.from(result).every(value => value >= 0 && value <= 3)).toBe(true);
  });
});

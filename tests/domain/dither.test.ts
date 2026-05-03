import { describe, expect, it } from 'vitest';

import { DITHER_FILENAME_SUFFIX, ditherToIndexedGray, type DitherMode } from '../../src/domain/dither';

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

describe('DITHER_FILENAME_SUFFIX', () => {
  it('has a non-empty lowercase suffix for every DitherMode', () => {
    const modes: DitherMode[] = ['fs', 'atk', 'jjn', 'stucki', 'burkes', 'bayer', 'zhou-fang', 'blue-noise'];
    for (const m of modes) expect(DITHER_FILENAME_SUFFIX[m]).toMatch(/^[a-z]+$/);
  });
});

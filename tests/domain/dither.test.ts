import { describe, expect, it } from 'vitest';

import { DITHER_FILENAME_SUFFIX, ditherToIndexedGray, type DitherMode } from '../../src/domain/dither';
import { getQuantProfile } from '../../src/domain/quantize';

const PR1614_PROFILE = getQuantProfile('pr1614');
const MASTER_PROFILE = getQuantProfile('master');

describe('ditherToIndexedGray', () => {
  it('quantizes directly when dithering is disabled', () => {
    const result = ditherToIndexedGray(new Float32Array([0, 84, 170, 255]), 4, 1, false, 'fs', PR1614_PROFILE);
    expect(Array.from(result)).toEqual([0, 1, 2, 3]);
  });

  it('quantizes against the given thresholds', () => {
    const result = ditherToIndexedGray(new Float32Array([44, 100, 200]), 3, 1, false, 'fs', MASTER_PROFILE);
    expect(Array.from(result)).toEqual([0, 2, 3]);
  });

  it('produces a deterministic Bayer result', () => {
    const result = ditherToIndexedGray(new Float32Array([100]), 1, 1, true, 'bayer', PR1614_PROFILE);
    expect(Array.from(result)).toEqual([2]);
  });

  it('produces a deterministic blue noise result', () => {
    const result = ditherToIndexedGray(new Float32Array([100, 100, 100, 100]), 2, 2, true, 'blue-noise', PR1614_PROFILE);
    expect(Array.from(result)).toEqual([1, 1, 2, 1]);
  });

  it('keeps output values within the 0..3 palette range', () => {
    const result = ditherToIndexedGray(new Float32Array([10, 120, 180, 250]), 2, 2, true, 'fs', PR1614_PROFILE);
    expect(Array.from(result).every(value => value >= 0 && value <= 3)).toBe(true);
  });

  it('FS single pixel 128 under master profile lands at level 2', () => {
    // ditherThresholds [30,50,140]: 128 < 140 → bin 2
    const result = ditherToIndexedGray(new Float32Array([128]), 1, 1, true, 'fs', MASTER_PROFILE);
    expect(result[0]).toBe(2);
  });

  it('FS 16×16 flat-128 field: master mean level > pr1614 mean level (brightening property)', () => {
    const size = 16 * 16;
    const input = new Float32Array(size).fill(128);

    const masterResult = ditherToIndexedGray(input, 16, 16, true, 'fs', MASTER_PROFILE);
    const pr1614Result = ditherToIndexedGray(input, 16, 16, true, 'fs', PR1614_PROFILE);

    const masterMean = masterResult.reduce((s, v) => s + v, 0) / size;
    const pr1614Mean = pr1614Result.reduce((s, v) => s + v, 0) / size;

    expect(masterMean).toBeGreaterThan(pr1614Mean);
  });

  it('Atkinson 16×16 flat-128 field: master mean level > pr1614 mean level (brightening property)', () => {
    const size = 16 * 16;
    const input = new Float32Array(size).fill(128);

    const masterResult = ditherToIndexedGray(input, 16, 16, true, 'atk', MASTER_PROFILE);
    const pr1614Result = ditherToIndexedGray(input, 16, 16, true, 'atk', PR1614_PROFILE);

    const masterMean = masterResult.reduce((s, v) => s + v, 0) / size;
    const pr1614Mean = pr1614Result.reduce((s, v) => s + v, 0) / size;

    expect(masterMean).toBeGreaterThan(pr1614Mean);
  });

  it('Bayer 1×1 input 128 under master profile: expect level 3', () => {
    // levels [15,30,80,210]: lo scan: 128 >= 80 → lo=2, hi=3
    // frac = (128 - 80) / (210 - 80) = 48/130 ≈ 0.369
    // bayer threshold at (0,0): ([...][0] + 0.5)/16 = (0+0.5)/16 ≈ 0.031
    // frac (0.369) > t (0.031) → hi → 3
    const result = ditherToIndexedGray(new Float32Array([128]), 1, 1, true, 'bayer', MASTER_PROFILE);
    expect(result[0]).toBe(3);
  });
});

describe('DITHER_FILENAME_SUFFIX', () => {
  it('has a non-empty lowercase suffix for every DitherMode', () => {
    const modes: DitherMode[] = ['fs', 'atk', 'jjn', 'stucki', 'burkes', 'bayer', 'zhou-fang', 'blue-noise'];
    for (const m of modes) expect(DITHER_FILENAME_SUFFIX[m]).toMatch(/^[a-z]+$/);
  });
});

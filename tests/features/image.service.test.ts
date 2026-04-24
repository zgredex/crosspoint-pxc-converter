import { describe, expect, it } from 'vitest';

import { buildGammaLut } from '../../src/domain/tone';
import { buildImageOutputs } from '../../src/features/image/service';

describe('image feature service', () => {
  it('builds histogram, indexed pixels, and encoded outputs from rgba input', () => {
    const rgba = new Uint8ClampedArray([
      0, 0, 0, 255,
      255, 255, 255, 255,
    ]);

    const result = buildImageOutputs(rgba, 2, 1, {
      blackPoint: 0,
      whitePoint: 255,
      gammaValue: 1,
      gammaLut: buildGammaLut(1),
      contrastValue: 0,
      invert: false,
      ditherEnabled: false,
      ditherMode: 'fs',
    });

    expect(result.histogram[0]).toBe(1);
    expect(result.histogram[255]).toBe(1);
    expect(Array.from(result.indexedPixels)).toEqual([0, 3]);
    expect(Array.from(result.pxcBytes)).toEqual([2, 0, 1, 0, 0x30]);
    expect(result.bmpBytes.length).toBeGreaterThan(0);
  });
});

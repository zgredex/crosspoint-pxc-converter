import { describe, expect, it } from 'vitest';

import { buildGammaLut, buildLuminanceBuffer } from '../../src/domain/tone';
import { ditherToIndexedGray } from '../../src/domain/dither';
import { buildHistogram } from '../../src/domain/histogram';
import { encodePxc } from '../../src/domain/formats/pxc';

describe('image processing pipeline', () => {
  it('builds luminance, dithers, histograms, and encodes pxc from rgba input', () => {
    const rgba = new Uint8ClampedArray([
      0, 0, 0, 255,
      255, 255, 255, 255,
    ]);

    const buffer = buildLuminanceBuffer(rgba);
    const histogram = buildHistogram(buffer);
    const indexedPixels = ditherToIndexedGray(buffer, 2, 1, false, 'fs');
    const pxcBytes = encodePxc(indexedPixels, 2, 1);

    expect(histogram[0]).toBe(1);
    expect(histogram[255]).toBe(1);
    expect(Array.from(indexedPixels)).toEqual([0, 3]);
    expect(Array.from(pxcBytes)).toEqual([2, 0, 1, 0, 0x30]);
  });
});

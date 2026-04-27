import { describe, expect, it } from 'vitest';

import {
  applyBlackWhitePoints,
  applyContrast,
  applyGamma,
  applyInvert,
  buildGammaLut,
  buildLuminanceBuffer,
  buildToneLut,
  computeAutoLevels,
  lum,
} from '../../src/domain/tone';

describe('tone', () => {
  it('computes BT.601 luminance', () => {
    expect(lum(255, 255, 255)).toBe(255);
    expect(lum(0, 0, 0)).toBe(0);
  });

  it('builds a gamma LUT with correct endpoints', () => {
    const lut = buildGammaLut(1);
    expect(lut[0]).toBe(0);
    expect(lut[255]).toBe(255);
    expect(lut[128]).toBeCloseTo(128, 4);
  });

  it('builds luminance values from rgba data', () => {
    const rgba = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 0, 255]);
    const values = buildLuminanceBuffer(rgba);
    expect(values.length).toBe(2);
    expect(values[0]).toBeCloseTo(76.245, 3);
    expect(values[1]).toBe(0);
  });

  it('applies black and white points', () => {
    const values = new Float32Array([50, 100, 150]);
    const mapped = applyBlackWhitePoints(values, 50, 150);
    expect(Array.from(mapped)).toEqual([0, 127.5, 255]);
  });

  it('applies gamma through the LUT', () => {
    const values = new Float32Array([128]);
    const mapped = applyGamma(values, buildGammaLut(2), 2);
    expect(mapped[0]).toBeGreaterThan(128);
  });

  it('applies contrast and inversion', () => {
    const contrasted = applyContrast(new Float32Array([100]), 50);
    expect(contrasted[0]).toBeLessThan(100);

    const inverted = applyInvert(new Float32Array([0, 255]));
    expect(Array.from(inverted)).toEqual([255, 0]);
  });

  it('buildToneLut matches the chained pipeline at integer luminance', () => {
    const cases = [
      { blackPoint: 30, whitePoint: 220, gammaValue: 2.2, contrastValue: 25, invert: false },
      { blackPoint: 0, whitePoint: 255, gammaValue: 1.0, contrastValue: 0, invert: true },
      { blackPoint: 10, whitePoint: 200, gammaValue: 0.5, contrastValue: -40, invert: true },
    ];
    for (const settings of cases) {
      const lut = buildToneLut(settings);
      const gammaLut = buildGammaLut(settings.gammaValue);
      for (let i = 0; i < 256; i++) {
        const v0 = new Float32Array([i]);
        applyBlackWhitePoints(v0, settings.blackPoint, settings.whitePoint);
        applyGamma(v0, gammaLut, settings.gammaValue);
        applyContrast(v0, settings.contrastValue);
        if (settings.invert) applyInvert(v0);
        expect(lut[i]).toBeCloseTo(v0[0], 3);
      }
    }
  });

  it('computes auto levels from a histogram', () => {
    const hist = new Uint32Array(256);
    hist[10] = 10;
    hist[240] = 10;
    const levels = computeAutoLevels(hist, 1000);
    expect(levels).toEqual({ blackPoint: 10, whitePoint: 240 });
  });
});

import { describe, expect, it } from 'vitest';

import {
  buildLuminanceBuffer,
  buildToneLut,
  computeAutoLevels,
  lum,
} from '../../src/domain/tone';

const defaultSettings = {
  blackPoint: 0,
  whitePoint: 255,
  gammaValue: 1.0,
  contrastValue: 0,
  invert: false,
};

describe('tone', () => {
  it('computes BT.601 luminance', () => {
    expect(lum(255, 255, 255)).toBe(255);
    expect(lum(0, 0, 0)).toBe(0);
  });

  it('builds luminance values from rgba data', () => {
    const rgba = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 0, 255]);
    const values = buildLuminanceBuffer(rgba);
    expect(values.length).toBe(2);
    expect(values[0]).toBeCloseTo(76.245, 3);
    expect(values[1]).toBe(0);
  });

  it('buildToneLut is identity at default settings', () => {
    const lut = buildToneLut(defaultSettings);
    for (let i = 0; i < 256; i++) {
      expect(lut[i]).toBeCloseTo(i, 5);
    }
  });

  it('buildToneLut remaps black and white points', () => {
    const lut = buildToneLut({ ...defaultSettings, blackPoint: 50, whitePoint: 150 });
    expect(lut[50]).toBeCloseTo(0, 5);
    expect(lut[100]).toBeCloseTo(127.5, 5);
    expect(lut[150]).toBeCloseTo(255, 5);
    expect(lut[40]).toBe(0);
    expect(lut[200]).toBe(255);
  });

  it('buildToneLut applies gamma', () => {
    const lut = buildToneLut({ ...defaultSettings, gammaValue: 2 });
    expect(lut[128]).toBeGreaterThan(128);
    expect(lut[0]).toBeCloseTo(0, 5);
    expect(lut[255]).toBeCloseTo(255, 5);
  });

  it('buildToneLut applies positive contrast', () => {
    const lut = buildToneLut({ ...defaultSettings, contrastValue: 50 });
    expect(lut[100]).toBeLessThan(100);
    expect(lut[200]).toBeGreaterThan(200);
  });

  it('buildToneLut inverts', () => {
    const lut = buildToneLut({ ...defaultSettings, invert: true });
    expect(lut[0]).toBe(255);
    expect(lut[255]).toBe(0);
    expect(lut[128]).toBe(127);
  });

  it('buildToneLut clamps to [0, 255] under aggressive contrast', () => {
    const lut = buildToneLut({ ...defaultSettings, contrastValue: 100 });
    expect(lut[0]).toBe(0);
    expect(lut[255]).toBe(255);
    for (let i = 0; i < 256; i++) {
      expect(lut[i]).toBeGreaterThanOrEqual(0);
      expect(lut[i]).toBeLessThanOrEqual(255);
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

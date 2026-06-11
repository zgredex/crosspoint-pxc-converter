import { describe, expect, it } from 'vitest';

import { DEFAULT_QUANT_PRESET, GRAY_DISP, getQuantThresholds, getQuantProfile, quantize } from '../../src/domain/quantize';

describe('quantize', () => {
  it('exports the display grayscale palette', () => {
    expect(GRAY_DISP).toEqual([0, 85, 170, 255]);
  });

  it('uses the expected threshold boundaries', () => {
    const t = getQuantThresholds('pr1614');
    expect(quantize(41, t)).toBe(0);
    expect(quantize(42, t)).toBe(1);
    expect(quantize(126, t)).toBe(1);
    expect(quantize(127, t)).toBe(2);
    expect(quantize(211, t)).toBe(2);
    expect(quantize(212, t)).toBe(3);
  });

  it('quantizes against the master preset thresholds', () => {
    const t = getQuantThresholds('master');
    expect(quantize(44, t)).toBe(0);
    expect(quantize(45, t)).toBe(1);
    expect(quantize(70, t)).toBe(2);
    expect(quantize(140, t)).toBe(3);
  });

  it('exposes per-preset thresholds', () => {
    expect(getQuantThresholds('pr1614')).toEqual([42, 127, 212]);
    expect(getQuantThresholds('master')).toEqual([45, 70, 140]);
    expect(DEFAULT_QUANT_PRESET).toBe('master');
  });

  it('getQuantProfile returns correct profiles', () => {
    const pr1614 = getQuantProfile('pr1614');
    expect(pr1614.ditherThresholds).toEqual(pr1614.thresholds);
    expect(pr1614.ditherLevels).toEqual([0, 85, 170, 255]);
    expect(Array.from(pr1614.ditherLevels)).toEqual(Array.from(GRAY_DISP));

    const master = getQuantProfile('master');
    expect(master).toEqual({
      thresholds: [45, 70, 140],
      ditherThresholds: [30, 50, 140],
      ditherLevels: [15, 30, 80, 210],
    });
  });
});

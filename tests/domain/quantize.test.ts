import { describe, expect, it } from 'vitest';

import { DEFAULT_QUANT_PRESET, GRAY_DISP, getQuantThresholds, quantize } from '../../src/domain/quantize';

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
    expect(DEFAULT_QUANT_PRESET).toBe('pr1614');
  });
});

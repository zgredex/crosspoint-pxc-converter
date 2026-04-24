import { describe, expect, it } from 'vitest';

import { GRAY_DISP, quantize } from '../../src/domain/quantize';

describe('quantize', () => {
  it('exports the display grayscale palette', () => {
    expect(GRAY_DISP).toEqual([0, 85, 170, 255]);
  });

  it('uses the expected threshold boundaries', () => {
    expect(quantize(41)).toBe(0);
    expect(quantize(42)).toBe(1);
    expect(quantize(126)).toBe(1);
    expect(quantize(127)).toBe(2);
    expect(quantize(211)).toBe(2);
    expect(quantize(212)).toBe(3);
  });
});

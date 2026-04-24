import { describe, expect, it } from 'vitest';

import { fitOffset } from '../../src/domain/geometry';

describe('fitOffset', () => {
  it('computes centered placement', () => {
    expect(fitOffset(100, 200, 480, 800, 'mc')).toEqual({ x: 190, y: 300 });
  });

  it('computes bottom-right placement', () => {
    expect(fitOffset(100, 200, 480, 800, 'br')).toEqual({ x: 380, y: 600 });
  });
});

import { describe, expect, it } from 'vitest';

import { rotatePixels } from '../../src/domain/gb/rotatePixels';

describe('rotatePixels', () => {
  it('rotates a pixel grid clockwise by 90 degrees', () => {
    const pixels = new Uint8Array([1, 2, 3, 4, 5, 6]);

    const result = rotatePixels(pixels, 3, 2, 90);

    expect(result.w).toBe(2);
    expect(result.h).toBe(3);
    expect(Array.from(result.pixels)).toEqual([4, 1, 5, 2, 6, 3]);
  });
});

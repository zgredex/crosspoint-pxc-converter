import { describe, expect, it } from 'vitest';

import { decode2bpp } from '../../src/domain/gb/decode2bpp';

describe('decode2bpp', () => {
  it('decodes a single tile row into indexed pixels', () => {
    const bytes = new Uint8Array(16);
    bytes[0] = 0b10000000;

    const result = decode2bpp(bytes, 1);

    expect(result.w).toBe(8);
    expect(result.h).toBe(8);
    expect(result.pixels[0]).toBe(1);
    expect(result.pixels[1]).toBe(0);
    expect(result.pixels[7]).toBe(0);
  });
});

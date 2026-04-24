import { describe, expect, it } from 'vitest';

import { encodePxc } from '../../src/domain/formats/pxc';

describe('encodePxc', () => {
  it('packs four 2bpp pixels into one byte', () => {
    const q = new Uint8Array([0, 1, 2, 3]);

    const bytes = encodePxc(q, 4, 1);

    expect(Array.from(bytes)).toEqual([4, 0, 1, 0, 0b00011011]);
  });
});

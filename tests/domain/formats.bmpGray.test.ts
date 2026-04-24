import { describe, expect, it } from 'vitest';

import { encodeGrayBmp } from '../../src/domain/formats/bmpGray';

describe('encodeGrayBmp', () => {
  it('writes a valid 4-color grayscale BMP header, palette, and pixel row', () => {
    const bytes = encodeGrayBmp(new Uint8Array([0, 3]), 2, 1);
    const view = new DataView(bytes.buffer);

    expect(bytes[0]).toBe(0x42);
    expect(bytes[1]).toBe(0x4d);
    expect(view.getInt32(18, true)).toBe(2);
    expect(view.getInt32(22, true)).toBe(-1);
    expect(view.getUint16(28, true)).toBe(4);

    expect(Array.from(bytes.slice(54, 58))).toEqual([0, 0, 0, 0]);
    expect(Array.from(bytes.slice(66, 70))).toEqual([255, 255, 255, 0]);
    expect(Array.from(bytes.slice(70, 74))).toEqual([0x03, 0x00, 0x00, 0x00]);
  });
});

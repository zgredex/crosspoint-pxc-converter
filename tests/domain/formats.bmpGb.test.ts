import { describe, expect, it } from 'vitest';

import { encodeGbBmp } from '../../src/domain/formats/bmpGb';

describe('encodeGbBmp', () => {
  it('writes a valid GB palette BMP', () => {
    const bytes = encodeGbBmp(new Uint8Array([3, 0]), 2, 1, 'dmg');
    const view = new DataView(bytes.buffer);

    expect(bytes[0]).toBe(0x42);
    expect(bytes[1]).toBe(0x4d);
    expect(view.getInt32(18, true)).toBe(2);
    expect(view.getInt32(22, true)).toBe(-1);
    expect(view.getUint16(28, true)).toBe(4);

    expect(Array.from(bytes.slice(54, 58))).toEqual([15, 188, 155, 0]);
    expect(Array.from(bytes.slice(70, 74))).toEqual([0x03, 0x00, 0x00, 0x00]);
  });
});

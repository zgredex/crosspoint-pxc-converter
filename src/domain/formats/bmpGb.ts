export type GbPaletteKey = 'dmg' | 'pocket' | 'bw' | 'sgb';

export const GB_PALETTES: Record<GbPaletteKey, readonly (readonly [number, number, number])[]> = {
  dmg: [[155, 188, 15], [139, 172, 15], [48, 98, 48], [15, 56, 15]],
  pocket: [[196, 207, 161], [139, 149, 109], [77, 83, 60], [31, 31, 15]],
  bw: [[255, 255, 255], [170, 170, 170], [85, 85, 85], [0, 0, 0]],
  sgb: [[247, 231, 198], [214, 142, 73], [166, 55, 37], [51, 30, 80]],
};

export function encodeGbBmp(
  q: Uint8Array,
  w: number,
  h: number,
  paletteKey: GbPaletteKey,
): Uint8Array {
  const pal = GB_PALETTES[paletteKey];
  const rowStride = Math.ceil(w / 2 + 3) & ~3;
  const palBytes = 4 * 4;
  const hdrBytes = 14 + 40;
  const pixOff = hdrBytes + palBytes;
  const pixBytes = rowStride * h;
  const fileSize = pixOff + pixBytes;

  const buf = new Uint8Array(fileSize);
  const view = new DataView(buf.buffer);

  buf[0] = 0x42;
  buf[1] = 0x4d;
  view.setUint32(2, fileSize, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, 0, true);
  view.setUint32(10, pixOff, true);
  view.setUint32(14, 40, true);
  view.setInt32(18, w, true);
  view.setInt32(22, -h, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, 4, true);
  view.setUint32(30, 0, true);
  view.setUint32(34, pixBytes, true);
  view.setInt32(38, 3780, true);
  view.setInt32(42, 3780, true);
  view.setUint32(46, 4, true);
  view.setUint32(50, 4, true);

  for (let ci = 0; ci < 4; ci++) {
    buf[54 + ci * 4 + 0] = pal[ci][2];
    buf[54 + ci * 4 + 1] = pal[ci][1];
    buf[54 + ci * 4 + 2] = pal[ci][0];
    buf[54 + ci * 4 + 3] = 0;
  }

  for (let row = 0; row < h; row++) {
    const rowBase = pixOff + row * rowStride;
    for (let col = 0; col < w; col++) {
      const gbColor = 3 - q[row * w + col];
      const bIdx = rowBase + (col >> 1);
      if ((col & 1) === 0) buf[bIdx] = gbColor << 4;
      else buf[bIdx] |= gbColor;
    }
  }

  return buf;
}

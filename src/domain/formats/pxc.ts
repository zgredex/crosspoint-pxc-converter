export function encodePxc(q: Uint8Array, w: number, h: number): Uint8Array {
  const bpr = Math.ceil(w / 4);
  const buf = new Uint8Array(4 + bpr * h);
  buf[0] = w & 0xff;
  buf[1] = (w >> 8) & 0xff;
  buf[2] = h & 0xff;
  buf[3] = (h >> 8) & 0xff;

  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const pv = q[row * w + col] & 0x03;
      buf[4 + row * bpr + (col >> 2)] |= pv << (6 - (col & 3) * 2);
    }
  }

  return buf;
}

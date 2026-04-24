export function decode2bpp(bytes: Uint8Array, tw: number): { pixels: Uint8Array; w: number; h: number } {
  const totalTiles = Math.floor(bytes.length / 16);
  const th = Math.ceil(totalTiles / tw);
  const w = tw * 8;
  const h = th * 8;
  const pixels = new Uint8Array(w * h);

  for (let t = 0; t < totalTiles; t++) {
    const tileOff = t * 16;
    const tx = (t % tw) * 8;
    const ty = Math.floor(t / tw) * 8;
    for (let row = 0; row < 8; row++) {
      const lo = bytes[tileOff + row * 2];
      const hi = bytes[tileOff + row * 2 + 1];
      for (let col = 0; col < 8; col++) {
        const loBit = (lo >> (7 - col)) & 1;
        const hiBit = (hi >> (7 - col)) & 1;
        pixels[(ty + row) * w + (tx + col)] = (hiBit << 1) | loBit;
      }
    }
  }

  return { pixels, w, h };
}

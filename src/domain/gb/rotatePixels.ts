export function rotatePixels(
  pixels: Uint8Array,
  w: number,
  h: number,
  deg: 0 | 90 | 180 | 270,
): { pixels: Uint8Array; w: number; h: number } {
  if (deg === 0) return { pixels, w, h };

  const rw = deg % 180 === 0 ? w : h;
  const rh = deg % 180 === 0 ? h : w;
  const out = new Uint8Array(rw * rh);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let rx: number;
      let ry: number;
      if (deg === 90) {
        rx = h - 1 - y;
        ry = x;
      } else if (deg === 180) {
        rx = w - 1 - x;
        ry = h - 1 - y;
      } else {
        rx = y;
        ry = w - 1 - x;
      }
      out[ry * rw + rx] = pixels[y * w + x];
    }
  }

  return { pixels: out, w: rw, h: rh };
}

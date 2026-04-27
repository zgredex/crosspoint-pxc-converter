import { GRAY_DISP, quantize } from './quantize';
import { BLUE_NOISE_64 } from './blueNoise';

export type DitherMode = 'fs' | 'atk' | 'jjn' | 'stucki' | 'burkes' | 'bayer' | 'zhou-fang' | 'blue-noise';

export function ditherToIndexedGray(
  source: Float32Array,
  width: number,
  height: number,
  enabled: boolean,
  mode: DitherMode,
): Uint8Array {
  const q = new Uint8Array(width * height);
  const buf = new Float32Array(source);

  if (!enabled) {
    for (let i = 0; i < width * height; i++) {
      q[i] = quantize(Math.max(0, Math.min(255, buf[i])));
    }
    return q;
  }

  if (mode === 'bayer' || mode === 'blue-noise') {
    const threshold =
      mode === 'bayer'
        ? (_x: number, y: number, x: number) => [0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5][(y & 3) * 4 + (x & 3)] / 16
        : (_x: number, y: number, x: number) => (BLUE_NOISE_64[((y & 63) << 6) | (x & 63)] + 0.5) / 256;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const v = Math.max(0, Math.min(255, buf[i]));
        const t = threshold(i, y, x);
        let lo = 0;
        for (let k = 2; k >= 0; k--) {
          if (v >= GRAY_DISP[k]) {
            lo = k;
            break;
          }
        }
        const hi = Math.min(lo + 1, 3);
        const frac = lo === hi ? 1 : (v - GRAY_DISP[lo]) / (GRAY_DISP[hi] - GRAY_DISP[lo]);
        q[i] = frac > t ? hi : lo;
      }
    }
    return q;
  }

  if (mode === 'zhou-fang') {
    for (let y = 0; y < height; y++) {
      const ltr = (y & 1) === 0;
      for (let xi = 0; xi < width; xi++) {
        const x = ltr ? xi : width - 1 - xi;
        const i = y * width + x;
        const v = Math.max(0, Math.min(255, buf[i]));
        const qv = quantize(v);
        q[i] = qv;
        const e = v - GRAY_DISP[qv];
        const d = ltr ? 1 : -1;
        const k = e / 48;

        if (x + d >= 0 && x + d < width) buf[i + d] += 7 * k;
        if (x + d * 2 >= 0 && x + d * 2 < width) buf[i + d * 2] += 5 * k;

        if (y + 1 < height) {
          if (x > 1) buf[i + width - 2] += 3 * k;
          if (x > 0) buf[i + width - 1] += 5 * k;
          buf[i + width] += 7 * k;
          if (x + 1 < width) buf[i + width + 1] += 5 * k;
          if (x + 2 < width) buf[i + width + 2] += 3 * k;
        }

        if (y + 2 < height) {
          if (x > 1) buf[i + width * 2 - 2] += 1 * k;
          if (x > 0) buf[i + width * 2 - 1] += 3 * k;
          buf[i + width * 2] += 5 * k;
          if (x + 1 < width) buf[i + width * 2 + 1] += 3 * k;
          if (x + 2 < width) buf[i + width * 2 + 2] += 1 * k;
        }
      }
    }
    return q;
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const v = Math.max(0, Math.min(255, buf[i]));
      const qv = quantize(v);
      q[i] = qv;
      const e = v - GRAY_DISP[qv];

      switch (mode) {
        case 'atk': {
          const k = e / 8;
          if (x + 1 < width) buf[i + 1] += k;
          if (x + 2 < width) buf[i + 2] += k;
          if (y + 1 < height) {
            if (x > 0) buf[i + width - 1] += k;
            buf[i + width] += k;
            if (x + 1 < width) buf[i + width + 1] += k;
          }
          if (y + 2 < height) buf[i + width * 2] += k;
          break;
        }
        case 'jjn': {
          const k = e / 48;
          if (x + 1 < width) buf[i + 1] += 7 * k;
          if (x + 2 < width) buf[i + 2] += 5 * k;
          if (y + 1 < height) {
            if (x > 1) buf[i + width - 2] += 3 * k;
            if (x > 0) buf[i + width - 1] += 5 * k;
            buf[i + width] += 7 * k;
            if (x + 1 < width) buf[i + width + 1] += 5 * k;
            if (x + 2 < width) buf[i + width + 2] += 3 * k;
          }
          if (y + 2 < height) {
            if (x > 1) buf[i + width * 2 - 2] += k;
            if (x > 0) buf[i + width * 2 - 1] += 3 * k;
            buf[i + width * 2] += 5 * k;
            if (x + 1 < width) buf[i + width * 2 + 1] += 3 * k;
            if (x + 2 < width) buf[i + width * 2 + 2] += k;
          }
          break;
        }
        case 'stucki': {
          const k = e / 42;
          if (x + 1 < width) buf[i + 1] += 8 * k;
          if (x + 2 < width) buf[i + 2] += 4 * k;
          if (y + 1 < height) {
            if (x > 1) buf[i + width - 2] += 2 * k;
            if (x > 0) buf[i + width - 1] += 4 * k;
            buf[i + width] += 8 * k;
            if (x + 1 < width) buf[i + width + 1] += 4 * k;
            if (x + 2 < width) buf[i + width + 2] += 2 * k;
          }
          if (y + 2 < height) {
            if (x > 1) buf[i + width * 2 - 2] += k;
            if (x > 0) buf[i + width * 2 - 1] += 2 * k;
            buf[i + width * 2] += 4 * k;
            if (x + 1 < width) buf[i + width * 2 + 1] += 2 * k;
            if (x + 2 < width) buf[i + width * 2 + 2] += k;
          }
          break;
        }
        case 'burkes': {
          const k = e / 32;
          if (x + 1 < width) buf[i + 1] += 8 * k;
          if (x + 2 < width) buf[i + 2] += 4 * k;
          if (y + 1 < height) {
            if (x > 1) buf[i + width - 2] += 2 * k;
            if (x > 0) buf[i + width - 1] += 4 * k;
            buf[i + width] += 8 * k;
            if (x + 1 < width) buf[i + width + 1] += 4 * k;
            if (x + 2 < width) buf[i + width + 2] += 2 * k;
          }
          break;
        }
        default:
          if (x + 1 < width) buf[i + 1] += e * 7 / 16;
          if (y + 1 < height) {
            if (x > 0) buf[i + width - 1] += e * 3 / 16;
            buf[i + width] += e * 5 / 16;
            if (x + 1 < width) buf[i + width + 1] += e * 1 / 16;
          }
          break;
      }
    }
  }

  return q;
}

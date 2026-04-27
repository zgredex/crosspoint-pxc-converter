export function lum(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export function buildGammaLut(gamma: number): Float32Array {
  const lut = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    lut[i] = Math.pow(i / 255, 1 / gamma) * 255;
  }
  return lut;
}

export function buildLuminanceBuffer(rgba: Uint8ClampedArray): Float32Array {
  const totalPixels = rgba.length / 4;
  const buffer = new Float32Array(totalPixels);
  for (let i = 0; i < totalPixels; i++) {
    buffer[i] = lum(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
  }
  return buffer;
}

export function applyBlackWhitePoints(values: Float32Array, blackPoint: number, whitePoint: number): Float32Array {
  if (blackPoint <= 0 && whitePoint >= 255) return values;

  const range = whitePoint - blackPoint;
  if (range <= 0) return values;

  for (let i = 0; i < values.length; i++) {
    values[i] = Math.max(0, Math.min(255, (values[i] - blackPoint) / range * 255));
  }

  return values;
}

export function applyGamma(values: Float32Array, gammaLut: Float32Array | null, gammaValue: number): Float32Array {
  if (gammaValue === 1.0 || !gammaLut) return values;

  for (let i = 0; i < values.length; i++) {
    values[i] = gammaLut[Math.min(255, Math.max(0, Math.round(values[i])))];
  }
  return values;
}

export function applyContrast(values: Float32Array, contrastValue: number): Float32Array {
  if (contrastValue === 0) return values;

  const factor = contrastValue >= 0 ? 1 + contrastValue * 2 / 100 : 1 + contrastValue / 100;
  for (let i = 0; i < values.length; i++) {
    values[i] = Math.max(0, Math.min(255, (values[i] - 127.5) * factor + 127.5));
  }
  return values;
}

export function applyInvert(values: Float32Array): Float32Array {
  for (let i = 0; i < values.length; i++) {
    values[i] = 255 - values[i];
  }
  return values;
}

export function computeAutoLevels(hist: Uint32Array, totalPixels: number): { blackPoint: number; whitePoint: number } {
  const clip = Math.max(1, Math.round(totalPixels * 0.005));
  let lo = 0;
  let loCount = 0;
  while (lo < 255 && (loCount += hist[lo]) < clip) lo++;

  let hi = 255;
  let hiCount = 0;
  while (hi > 0 && (hiCount += hist[hi]) < clip) hi--;

  if (hi - lo < 20) {
    const mid = (lo + hi) / 2;
    lo = Math.max(0, Math.round(mid - 10));
    hi = Math.min(255, Math.round(mid + 10));
  }

  return { blackPoint: lo, whitePoint: hi };
}

import type { QuantThresholds } from './quantize';

export type HistogramZone = {
  lo: number;
  hi: number;
  xLo: number;
  xHi: number;
  fill: string;
  pctColor: string;
  palette: string;
  count: number;
  pct: number;
};

const ZONE_STYLES: Pick<HistogramZone, 'fill' | 'pctColor' | 'palette'>[] = [
  { fill: 'rgba(0,0,0,0.5)', pctColor: 'rgba(90,90,100,0.9)', palette: 'rgb(0,0,0)' },
  { fill: 'rgba(85,85,85,0.28)', pctColor: 'rgba(140,140,152,0.9)', palette: 'rgb(85,85,85)' },
  { fill: 'rgba(170,170,170,0.18)', pctColor: 'rgba(185,185,195,0.9)', palette: 'rgb(170,170,170)' },
  { fill: 'rgba(232,232,234,0.12)', pctColor: 'rgba(255,255,255,1)', palette: 'rgb(255,255,255)' },
];

export function buildHistogram(values: Float32Array): Float32Array {
  const hist = new Float32Array(256);
  for (let i = 0; i < values.length; i++) {
    hist[Math.min(255, Math.max(0, Math.round(values[i])))]++;
  }
  return hist;
}

export function buildUintHistogram(values: Float32Array): Uint32Array {
  const hist = new Uint32Array(256);
  for (let i = 0; i < values.length; i++) {
    hist[Math.min(255, Math.max(0, Math.round(values[i])))]++;
  }
  return hist;
}

export function computeHistogramZones(
  hist: ArrayLike<number>,
  totalPixels: number,
  thresholds: QuantThresholds,
): HistogramZone[] {
  const bounds = [0, thresholds[0], thresholds[1], thresholds[2], 256];
  return ZONE_STYLES.map((style, z) => {
    const lo = bounds[z];
    const hi = bounds[z + 1] - 1;
    let count = 0;
    for (let i = lo; i <= hi; i++) count += hist[i];
    return {
      ...style,
      lo,
      hi,
      xLo: lo,
      xHi: Math.min(bounds[z + 1], 255),
      count,
      pct: totalPixels ? Math.round(count / totalPixels * 100) : 0,
    };
  });
}

export function buildBinnedHistogram(hist: ArrayLike<number>, binWidth = 8): { binned: Float32Array; binnedMax: number } {
  const numBins = 256 / binWidth;
  const binned = new Float32Array(numBins);
  let binnedMax = 0;

  for (let b = 0; b < numBins; b++) {
    let sum = 0;
    for (let i = 0; i < binWidth; i++) sum += hist[b * binWidth + i];
    binned[b] = sum;
    if (sum > binnedMax) binnedMax = sum;
  }

  return { binned, binnedMax };
}

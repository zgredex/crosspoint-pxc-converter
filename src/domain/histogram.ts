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

const ZONE_TEMPLATE: Omit<HistogramZone, 'count' | 'pct'>[] = [
  { lo: 0, hi: 41, xLo: 0, xHi: 42, fill: 'rgba(0,0,0,0.5)', pctColor: 'rgba(90,90,100,0.9)', palette: 'rgb(0,0,0)' },
  { lo: 42, hi: 126, xLo: 42, xHi: 127, fill: 'rgba(85,85,85,0.28)', pctColor: 'rgba(140,140,152,0.9)', palette: 'rgb(85,85,85)' },
  { lo: 127, hi: 211, xLo: 127, xHi: 212, fill: 'rgba(170,170,170,0.18)', pctColor: 'rgba(185,185,195,0.9)', palette: 'rgb(170,170,170)' },
  { lo: 212, hi: 255, xLo: 212, xHi: 255, fill: 'rgba(232,232,234,0.12)', pctColor: 'rgba(255,255,255,1)', palette: 'rgb(255,255,255)' },
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

export function computeHistogramZones(hist: ArrayLike<number>, totalPixels: number): HistogramZone[] {
  return ZONE_TEMPLATE.map(zone => {
    let count = 0;
    for (let i = zone.lo; i <= zone.hi; i++) count += hist[i];
    return {
      ...zone,
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

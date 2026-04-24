import { describe, expect, it } from 'vitest';

import { buildBinnedHistogram, buildHistogram, buildUintHistogram, computeHistogramZones } from '../../src/domain/histogram';

describe('histogram', () => {
  it('builds float and uint histograms', () => {
    const values = new Float32Array([0, 1, 1, 255]);
    const floatHist = buildHistogram(values);
    const uintHist = buildUintHistogram(values);

    expect(floatHist[0]).toBe(1);
    expect(floatHist[1]).toBe(2);
    expect(floatHist[255]).toBe(1);
    expect(uintHist[1]).toBe(2);
  });

  it('computes zone percentages', () => {
    const hist = new Float32Array(256);
    hist[0] = 50;
    hist[100] = 25;
    hist[200] = 25;
    const zones = computeHistogramZones(hist, 100);

    expect(zones.map(zone => zone.pct)).toEqual([50, 25, 25, 0]);
  });

  it('bins histogram data', () => {
    const hist = new Float32Array(256);
    hist[0] = 1;
    hist[7] = 2;
    hist[8] = 3;
    const { binned, binnedMax } = buildBinnedHistogram(hist, 8);

    expect(binned[0]).toBe(3);
    expect(binned[1]).toBe(3);
    expect(binnedMax).toBe(3);
  });
});

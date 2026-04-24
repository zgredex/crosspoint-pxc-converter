import { describe, expect, it } from 'vitest';

import { buildImageRenderPlan, fitOffset, getImageAnalysisRegion } from '../../src/domain/geometry';

describe('fitOffset', () => {
  it('computes centered placement', () => {
    expect(fitOffset(100, 200, 480, 800, 'mc')).toEqual({ x: 190, y: 300 });
  });

  it('computes bottom-right placement', () => {
    expect(fitOffset(100, 200, 480, 800, 'br')).toEqual({ x: 380, y: 600 });
  });
});

describe('buildImageRenderPlan', () => {
  it('builds a fit plan using rounded output dimensions', () => {
    expect(buildImageRenderPlan({
      mode: 'fit',
      sourceW: 1200,
      sourceH: 801,
      targetW: 480,
      targetH: 800,
      fitAlign: 'mc',
      displayScale: 1,
      workScale: 1,
      boxX: 0,
      boxY: 0,
    })).toEqual({
      kind: 'fit',
      fittedWidth: 480,
      fittedHeight: 320,
      offsetX: 0,
      offsetY: 240,
    });
  });

  it('builds a crop plan from the current crop box and scales', () => {
    expect(buildImageRenderPlan({
      mode: 'crop',
      sourceW: 1000,
      sourceH: 800,
      targetW: 480,
      targetH: 800,
      fitAlign: 'mc',
      displayScale: 0.5,
      workScale: 2,
      boxX: 10,
      boxY: 20,
    })).toEqual({
      kind: 'crop',
      srcX: 20,
      srcY: 40,
      cropW: 240,
      cropH: 400,
    });
  });
});

describe('getImageAnalysisRegion', () => {
  it('uses only the fitted image area for fit mode analysis', () => {
    expect(getImageAnalysisRegion({
      kind: 'fit',
      fittedWidth: 300,
      fittedHeight: 500,
      offsetX: 90,
      offsetY: 150,
    }, 480, 800)).toEqual({
      x: 90,
      y: 150,
      width: 300,
      height: 500,
      pixelCount: 150000,
    });
  });

  it('uses the full target area for crop mode analysis', () => {
    expect(getImageAnalysisRegion({
      kind: 'crop',
      srcX: 10,
      srcY: 20,
      cropW: 300,
      cropH: 400,
    }, 480, 800)).toEqual({
      x: 0,
      y: 0,
      width: 480,
      height: 800,
      pixelCount: 384000,
    });
  });
});

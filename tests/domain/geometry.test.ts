import { describe, expect, it } from 'vitest';

import { buildImageRenderPlan, clampCropBox, fitOffset, getImageAnalysisRegion } from '../../src/domain/geometry';

describe('fitOffset', () => {
  it('computes centered placement', () => {
    expect(fitOffset(100, 200, 480, 800, 'mc')).toEqual({ x: 190, y: 300 });
  });

  it('computes bottom-right placement', () => {
    expect(fitOffset(100, 200, 480, 800, 'br')).toEqual({ x: 380, y: 600 });
  });
});

describe('buildImageRenderPlan', () => {
  it('builds a fit plan that letterboxes the whole source onto the device', () => {
    expect(buildImageRenderPlan({
      mode: 'fit',
      sourceW: 1200,
      sourceH: 801,
      targetW: 480,
      targetH: 800,
      fitAlign: 'mc',
      displayScale: 1,
      boxX: 0,
      boxY: 0,
      boxW: 0,
      boxH: 0,
    })).toEqual({
      srcX: 0,
      srcY: 0,
      srcW: 1200,
      srcH: 801,
      fittedWidth: 480,
      fittedHeight: 320,
      offsetX: 0,
      offsetY: 240,
    });
  });

  it('builds a crop plan that fills the device when the crop box matches device AR', () => {
    expect(buildImageRenderPlan({
      mode: 'crop',
      sourceW: 1000,
      sourceH: 800,
      targetW: 480,
      targetH: 800,
      fitAlign: 'mc',
      displayScale: 0.5,
      boxX: 10,
      boxY: 20,
      boxW: 120,
      boxH: 200,
    })).toEqual({
      srcX: 20,
      srcY: 40,
      srcW: 240,
      srcH: 400,
      fittedWidth: 480,
      fittedHeight: 800,
      offsetX: 0,
      offsetY: 0,
    });
  });

  it('letterboxes the output when an unlocked crop box does not match device AR', () => {
    const plan = buildImageRenderPlan({
      mode: 'crop',
      sourceW: 2000,
      sourceH: 2000,
      targetW: 480,
      targetH: 800,
      fitAlign: 'mc',
      displayScale: 1,
      boxX: 0,
      boxY: 0,
      boxW: 600,
      boxH: 400,
    });
    expect(plan).toMatchObject({
      srcX: 0,
      srcY: 0,
      srcW: 600,
      srcH: 400,
      fittedWidth: 480,
      fittedHeight: 320,
    });
    expect(plan.offsetY).toBeCloseTo(240, 5);
    expect(plan.offsetX).toBeCloseTo(0, 5);
  });
});

describe('getImageAnalysisRegion', () => {
  it('reads offset and fitted dimensions from the unified plan', () => {
    expect(getImageAnalysisRegion({
      srcX: 0,
      srcY: 0,
      srcW: 1200,
      srcH: 800,
      fittedWidth: 300,
      fittedHeight: 500,
      offsetX: 90,
      offsetY: 150,
    })).toEqual({
      x: 90,
      y: 150,
      width: 300,
      height: 500,
      pixelCount: 150000,
    });
  });
});

describe('clampCropBox', () => {
  const SOURCE = { sourceW: 2000, sourceH: 1500, targetW: 480, targetH: 800 };

  it('passes through a box that already satisfies all constraints', () => {
    expect(clampCropBox({ ...SOURCE, srcW: 600, srcH: 1000, driving: 'both' })).toEqual({ srcW: 600, srcH: 1000 });
  });

  it('clamps to source bounds', () => {
    expect(clampCropBox({ ...SOURCE, srcW: 5000, srcH: 5000, driving: 'both' })).toEqual({ srcW: 2000, srcH: 1500 });
  });

  it('rejects a sub-target shrink on the driving width axis', () => {
    // user is dragging width to 200; height is 200 too — both below target. With driving='w',
    // pin width at targetW so the drag stops at the no-upscale boundary.
    expect(clampCropBox({ ...SOURCE, srcW: 200, srcH: 200, driving: 'w' })).toEqual({ srcW: 480, srcH: 200 });
  });

  it('rejects a sub-target shrink on the driving height axis', () => {
    expect(clampCropBox({ ...SOURCE, srcW: 200, srcH: 200, driving: 'h' })).toEqual({ srcW: 200, srcH: 800 });
  });

  it('pins both axes for corner-driven shrink past the boundary', () => {
    expect(clampCropBox({ ...SOURCE, srcW: 200, srcH: 200, driving: 'both' })).toEqual({ srcW: 480, srcH: 800 });
  });

  it('rounds and floors at 1 px when the candidate is non-integer / zero', () => {
    // srcH=801 already satisfies no-upscale (>= targetH), so srcW is left at the floored 1.
    expect(clampCropBox({ ...SOURCE, srcW: 0.4, srcH: 800.6, driving: 'both' })).toEqual({ srcW: 1, srcH: 801 });
  });

  it('caps target minimum to source size when source is smaller than device target', () => {
    // sourceW=300 < targetW=480; the no-upscale rule can't be enforced on W (source can't reach targetW).
    // minTW = min(targetW, sourceW) = 300, so the rule effectively becomes srcW >= sourceW.
    expect(clampCropBox({ sourceW: 300, sourceH: 1500, targetW: 480, targetH: 800, srcW: 100, srcH: 100, driving: 'w' }))
      .toEqual({ srcW: 300, srcH: 100 });
  });
});

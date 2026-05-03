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
      aspectRatioLocked: true,
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
      aspectRatioLocked: true,
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
      aspectRatioLocked: false,
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

  it('unlocked-AR crop absorbs a 1-px rounding drift on the loser axis', () => {
    // srcW=1000, srcH=1665 => ratio 0.6006 vs target 0.6; height-driven cropFitScale = 0.48.
    // rawFittedHeight = round(1665 * 0.48) = 799 (1 px short of targetH=800).
    // Without the snap-up, fitAlign='mc' would render a 1-px fit-bg line on top of the preview.
    const plan = buildImageRenderPlan({
      mode: 'crop',
      sourceW: 4000,
      sourceH: 4000,
      targetW: 480,
      targetH: 800,
      fitAlign: 'mc',
      displayScale: 1,
      boxX: 0,
      boxY: 0,
      boxW: 1000,
      boxH: 1665,
      aspectRatioLocked: false,
    });
    expect(plan.fittedWidth).toBe(480);
    expect(plan.fittedHeight).toBe(800);
    expect(plan.offsetX).toBe(0);
    expect(plan.offsetY).toBe(0);
  });

  it('locked-AR crop fills the device exactly even when box/displayScale rounds the source ratio off-target', () => {
    // displayScale chosen so round(boxW/displayScale)/round(boxH/displayScale) drifts from 480/800.
    // Without the locked-AR fill guarantee, fittedWidth would land at 479 and leave a 1-px sliver.
    const plan = buildImageRenderPlan({
      mode: 'crop',
      sourceW: 2000,
      sourceH: 3000,
      targetW: 480,
      targetH: 800,
      fitAlign: 'mc',
      displayScale: 480.5 / 999,
      boxX: 0,
      boxY: 0,
      boxW: 480.5,
      boxH: 480.5 * (800 / 480),
      aspectRatioLocked: true,
    });
    expect(plan.fittedWidth).toBe(480);
    expect(plan.fittedHeight).toBe(800);
    expect(plan.offsetX).toBe(0);
    expect(plan.offsetY).toBe(0);
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
    expect(clampCropBox({ ...SOURCE, srcW: 600, srcH: 1000 })).toEqual({ srcW: 600, srcH: 1000 });
  });

  it('clamps to source bounds', () => {
    expect(clampCropBox({ ...SOURCE, srcW: 5000, srcH: 5000 })).toEqual({ srcW: 2000, srcH: 1500 });
  });

  it('rejects a sub-target shrink on the width axis even when height is at target', () => {
    // The OR-rule predecessor allowed this case (srcH==targetH satisfies one-axis-≥-target),
    // producing a 200px-wide sliver inside the 480x800 device — empty/all-bg preview. The
    // strict rule pins width at target.
    expect(clampCropBox({ ...SOURCE, srcW: 200, srcH: 800 })).toEqual({ srcW: 480, srcH: 800 });
  });

  it('rejects a sub-target shrink on the height axis even when width is at target', () => {
    expect(clampCropBox({ ...SOURCE, srcW: 480, srcH: 300 })).toEqual({ srcW: 480, srcH: 800 });
  });

  it('pins both axes for corner-driven shrink past the boundary', () => {
    expect(clampCropBox({ ...SOURCE, srcW: 200, srcH: 200 })).toEqual({ srcW: 480, srcH: 800 });
  });

  it('rounds candidates and floors at the target minimum, not at 1', () => {
    expect(clampCropBox({ ...SOURCE, srcW: 0.4, srcH: 800.6 })).toEqual({ srcW: 480, srcH: 801 });
  });

  it('caps target minimum to source size when source is smaller than device target', () => {
    // sourceW=300 < targetW=480; the no-upscale rule can't be enforced on W (source can't reach targetW).
    // The rule degrades to srcW >= sourceW: the user must keep the full source on that axis.
    expect(clampCropBox({ sourceW: 300, sourceH: 1500, targetW: 480, targetH: 800, srcW: 100, srcH: 100 }))
      .toEqual({ srcW: 300, srcH: 800 });
  });
});

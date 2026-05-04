import { describe, expect, it } from 'vitest';

import {
  buildImageRenderPlan,
  clampBoxToDevice,
  clampBoxToSource,
  fitOffset,
  getImageAnalysisRegion,
} from '../../src/domain/geometry';

describe('fitOffset', () => {
  it('computes centered placement', () => {
    expect(fitOffset(100, 200, 480, 800, 'mc')).toEqual({ x: 190, y: 300 });
  });

  it('computes bottom-right placement', () => {
    expect(fitOffset(100, 200, 480, 800, 'br')).toEqual({ x: 380, y: 600 });
  });
});

describe('buildImageRenderPlan', () => {
  it('builds a fit plan that letterboxes the whole source onto the device when the box covers the full image', () => {
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
      boxW: 1200,
      boxH: 801,
      fitSizePct: 100,
      fitNoUpscale: true,
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

  it('fit + sub-region with top-right align AR-fits the cropped region', () => {
    const plan = buildImageRenderPlan({
      mode: 'fit',
      sourceW: 2000,
      sourceH: 2000,
      targetW: 480,
      targetH: 800,
      fitAlign: 'tr',
      displayScale: 1,
      boxX: 100,
      boxY: 200,
      boxW: 250,
      boxH: 250,
      fitSizePct: 100,
      fitNoUpscale: false, // allow upscaling so 250→480
    });
    expect(plan).toMatchObject({ srcX: 100, srcY: 200, srcW: 250, srcH: 250 });
    expect(plan.fittedWidth).toBe(480);
    expect(plan.fittedHeight).toBe(480);
    expect(plan.offsetX).toBe(0);
    expect(plan.offsetY).toBe(0);
  });

  it('fit + 50% size scales the AR-fit output to half its max-fit dims', () => {
    const plan = buildImageRenderPlan({
      mode: 'fit',
      sourceW: 1000,
      sourceH: 1000,
      targetW: 480,
      targetH: 800,
      fitAlign: 'mc',
      displayScale: 1,
      boxX: 0,
      boxY: 0,
      boxW: 1000,
      boxH: 1000,
      fitSizePct: 50,
      fitNoUpscale: true,
    });
    // max-fit at 100%: scale = min(480/1000, 800/1000) = 0.48 → fitted 480×480.
    // At 50%: scale = 0.24 → fitted 240×240. No upscaling involved.
    expect(plan.fittedWidth).toBe(240);
    expect(plan.fittedHeight).toBe(240);
    expect(plan.offsetX).toBe(120);
    expect(plan.offsetY).toBe(280);
  });

  it('fit with no-upscale guard caps small-source output at native size', () => {
    const plan = buildImageRenderPlan({
      mode: 'fit',
      sourceW: 200,
      sourceH: 200,
      targetW: 480,
      targetH: 800,
      fitAlign: 'mc',
      displayScale: 1,
      boxX: 0,
      boxY: 0,
      boxW: 200,
      boxH: 200,
      fitSizePct: 100,
      fitNoUpscale: true,
    });
    // maxFit = min(480/200, 800/200) = 2.4 (would upscale). Guard caps at 1×.
    expect(plan.fittedWidth).toBe(200);
    expect(plan.fittedHeight).toBe(200);
    expect(plan.offsetX).toBe(140);
    expect(plan.offsetY).toBe(300);
  });

  it('fit without no-upscale guard still upscales small sources to fill', () => {
    const plan = buildImageRenderPlan({
      mode: 'fit',
      sourceW: 200,
      sourceH: 200,
      targetW: 480,
      targetH: 800,
      fitAlign: 'mc',
      displayScale: 1,
      boxX: 0,
      boxY: 0,
      boxW: 200,
      boxH: 200,
      fitSizePct: 100,
      fitNoUpscale: false,
    });
    // maxFit = 2.4 → fitted 480×480.
    expect(plan.fittedWidth).toBe(480);
    expect(plan.fittedHeight).toBe(480);
  });

  it('1:1 + sub-region centers the native-resolution region with letterbox', () => {
    const plan = buildImageRenderPlan({
      mode: 'one-to-one',
      sourceW: 2000,
      sourceH: 2000,
      targetW: 480,
      targetH: 800,
      fitAlign: 'mc',
      displayScale: 1,
      boxX: 100,
      boxY: 200,
      boxW: 250,
      boxH: 250,
      fitSizePct: 100,
      fitNoUpscale: true,
    });
    expect(plan.srcW).toBe(250);
    expect(plan.srcH).toBe(250);
    expect(plan.fittedWidth).toBe(250);
    expect(plan.fittedHeight).toBe(250);
    expect(plan.offsetX).toBe(115);
    expect(plan.offsetY).toBe(275);
  });

  it('1:1 + sub-region pinned top-right keeps native pixels', () => {
    const plan = buildImageRenderPlan({
      mode: 'one-to-one',
      sourceW: 2000,
      sourceH: 2000,
      targetW: 480,
      targetH: 800,
      fitAlign: 'tr',
      displayScale: 1,
      boxX: 0,
      boxY: 0,
      boxW: 250,
      boxH: 250,
      fitSizePct: 100,
      fitNoUpscale: true,
    });
    expect(plan.fittedWidth).toBe(250);
    expect(plan.fittedHeight).toBe(250);
    expect(plan.offsetX).toBe(230);
    expect(plan.offsetY).toBe(0);
  });

  it('crop fills the device exactly; box srcW/srcH are derived from box ÷ displayScale', () => {
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
      fitSizePct: 100,
      fitNoUpscale: true,
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

  it('crop fills the device exactly even when box/displayScale rounds source ratio off-target', () => {
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
      fitSizePct: 100,
      fitNoUpscale: true,
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

describe('clampBoxToSource', () => {
  const SOURCE = { sourceW: 2000, sourceH: 1500 };

  it('passes through a sub-source box that satisfies bounds', () => {
    expect(clampBoxToSource({ ...SOURCE, srcW: 250, srcH: 250 })).toEqual({ srcW: 250, srcH: 250 });
  });

  it('clamps to source bounds without enforcing a target floor', () => {
    expect(clampBoxToSource({ ...SOURCE, srcW: 5000, srcH: 5000 })).toEqual({ srcW: 2000, srcH: 1500 });
  });

  it('floors at the usability minimum (8 px)', () => {
    expect(clampBoxToSource({ ...SOURCE, srcW: 1, srcH: 1 })).toEqual({ srcW: 8, srcH: 8 });
  });

  it('caps the floor to source size when source is tiny', () => {
    expect(clampBoxToSource({ sourceW: 4, sourceH: 4, srcW: 1, srcH: 1 })).toEqual({ srcW: 4, srcH: 4 });
  });

  it('rounds candidates to integer pixels', () => {
    expect(clampBoxToSource({ ...SOURCE, srcW: 250.4, srcH: 100.6 })).toEqual({ srcW: 250, srcH: 101 });
  });
});

describe('clampBoxToDevice', () => {
  const PARAMS = { sourceW: 2000, sourceH: 1500, targetW: 480, targetH: 800 };

  it('passes through a box within device dims', () => {
    expect(clampBoxToDevice({ ...PARAMS, srcW: 250, srcH: 250 })).toEqual({ srcW: 250, srcH: 250 });
  });

  it('caps oversize boxes to device dims', () => {
    expect(clampBoxToDevice({ ...PARAMS, srcW: 600, srcH: 1000 })).toEqual({ srcW: 480, srcH: 800 });
  });

  it('caps to source dims when source is smaller than device', () => {
    expect(clampBoxToDevice({ sourceW: 200, sourceH: 300, targetW: 480, targetH: 800, srcW: 999, srcH: 999 }))
      .toEqual({ srcW: 200, srcH: 300 });
  });

  it('floors at the usability minimum', () => {
    expect(clampBoxToDevice({ ...PARAMS, srcW: 1, srcH: 1 })).toEqual({ srcW: 8, srcH: 8 });
  });
});

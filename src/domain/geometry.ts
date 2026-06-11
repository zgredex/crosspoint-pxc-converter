export type FitAlign = 'tl' | 'tc' | 'tr' | 'ml' | 'mc' | 'mr' | 'bl' | 'bc' | 'br';

export type ImageRenderPlan = {
  srcX: number;
  srcY: number;
  srcW: number;
  srcH: number;
  fittedWidth: number;
  fittedHeight: number;
  offsetX: number;
  offsetY: number;
};

export type ImageAnalysisRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
  pixelCount: number;
};

export type EditorGeometry = {
  maxZoom: number;
  clampedZoom: number;
  displayScale: number;
  workScale: number;
  dispImgW: number;
  dispImgH: number;
};

export function computeEditorGeometry(params: {
  mode: 'crop' | 'fit';
  sourceW: number;
  sourceH: number;
  targetW: number;
  targetH: number;
  frameMaxW: number;
  frameMaxH: number;
  editorZoom: number;
}): EditorGeometry {
  const baseDisplayScale = Math.min(params.frameMaxW / params.sourceW, params.frameMaxH / params.sourceH);
  const baseCropScale = Math.max(params.targetW / params.sourceW, params.targetH / params.sourceH);
  const fitScale = Math.min(params.targetW / params.sourceW, params.targetH / params.sourceH);
  // Crop maxZoom: zoom until the source pixel-grid fills the device on the larger axis.
  // Fit (incl. fit-locked-native) maxZoom: zoom until 1 source pixel = 1 screen pixel (displayScale = 1).
  const maxZoom = params.mode === 'crop'
    ? Math.max(1, 1 / baseCropScale)
    : Math.max(1, 1 / baseDisplayScale);
  const clampedZoom = Math.min(Math.max(1, params.editorZoom), maxZoom);
  const displayScale = baseDisplayScale * clampedZoom;
  const workScale = params.mode === 'crop' ? baseCropScale * clampedZoom : fitScale;
  return {
    maxZoom,
    clampedZoom,
    displayScale,
    workScale,
    dispImgW: Math.round(params.sourceW * displayScale),
    dispImgH: Math.round(params.sourceH * displayScale),
  };
}

// Source dims as the editor sees them after rotation: 90/270 swap the axes.
export function rotatedSourceDims(width: number, height: number, rotation: number): { w: number; h: number } {
  return rotation % 180 === 0 ? { w: width, h: height } : { w: height, h: width };
}

// Transform a crop-box rect through a rotation delta, in editor display coords.
// dispW/dispH are the pre-rotation displayed image dims. Display scale is uniform on
// both axes, so the transformed rect divided by the old scale yields the correct
// source-space placement in the rotated frame.
export function rotateBoxRect(
  box: { x: number; y: number; w: number; h: number },
  dispW: number,
  dispH: number,
  deltaDeg: number,
): { x: number; y: number; w: number; h: number } {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  if (deltaDeg === 90) return { x: (dispH - cy) - box.h / 2, y: cx - box.w / 2, w: box.h, h: box.w };
  if (deltaDeg === 180) return { x: (dispW - cx) - box.w / 2, y: (dispH - cy) - box.h / 2, w: box.w, h: box.h };
  if (deltaDeg === 270) return { x: cy - box.h / 2, y: (dispW - cx) - box.w / 2, w: box.h, h: box.w };
  return { ...box };
}

// Largest fit-size percent that doesn't upscale the source. When the source already fills (or
// overflows) the device on some axis, full fit is a downscale and the slider's whole 10–100%
// range applies. The 10% floor matches the reducer's fitSizePct clamp.
export function computeMaxFitSizePct(params: {
  sourceW: number;
  sourceH: number;
  targetW: number;
  targetH: number;
}): number {
  const maxFit = Math.min(params.targetW / params.sourceW, params.targetH / params.sourceH);
  if (maxFit <= 1) return 100;
  return Math.max(10, Math.floor(100 / maxFit));
}

export function fitOffset(fw: number, fh: number, targetW: number, targetH: number, pos: FitAlign): { x: number; y: number } {
  // Center offsets must round to whole pixels: drawImage at a sub-pixel offset blends the
  // resized canvas's rim with the fit-bg fillRect underneath, producing a faint colored line
  // visible at the edge of the preview. Side-pinned offsets are already integer.
  const x = pos[1] === 'l' ? 0 : pos[1] === 'c' ? Math.round((targetW - fw) / 2) : targetW - fw;
  const y = pos[0] === 't' ? 0 : pos[0] === 'm' ? Math.round((targetH - fh) / 2) : targetH - fh;
  return { x, y };
}

// Clamp a candidate crop box (in source pixels) to satisfy:
//   - source bounds: 1 ≤ srcW ≤ sourceW, 1 ≤ srcH ≤ sourceH
//   - no upscale: cropFitScale = min(targetW/srcW, targetH/srcH) ≤ 1.
// `min(a,b) ≤ 1` requires *both* a ≤ 1 and b ≤ 1 in this codebase's invariant: an OR rule
// (one axis ≥ target) lets the user shrink the other axis to a 1-pixel sliver, producing a
// fittedWidth/Height of 1 inside a `fillRect` device canvas — i.e. an empty/all-bg preview.
// So both axes must be ≥ target, capped at source. When `sourceX < targetX`, upscale on that
// axis is unavoidable; the rule degrades to `srcX ≥ sourceX` (i.e. you must keep the full
// source on that axis), which is the closest we can get to "no upscale" given the source.
const FIT_MIN_BOX = 8;

// Fit-mode box clamp: source bounds + a usability minimum so the box can't shrink below
// FIT_MIN_BOX × FIT_MIN_BOX source pixels (or the source itself, when smaller). No no-upscale
// rule — fit mode lets the user pick a region smaller than the device on purpose.
export function clampBoxToSource(params: {
  srcW: number;
  srcH: number;
  sourceW: number;
  sourceH: number;
}): { srcW: number; srcH: number } {
  const minW = Math.min(FIT_MIN_BOX, params.sourceW);
  const minH = Math.min(FIT_MIN_BOX, params.sourceH);
  const srcW = Math.max(minW, Math.min(params.sourceW, Math.round(params.srcW)));
  const srcH = Math.max(minH, Math.min(params.sourceH, Math.round(params.srcH)));
  return { srcW, srcH };
}

// 1:1-mode box clamp: same as clampBoxToSource, but additionally caps each axis to the device
// dim. 1:1 places source pixels at native resolution; if the box exceeds the device, drawImage
// would silently clip — pixel preservation is the whole point of 1:1, so forbid oversize at the
// box level instead.
export function clampBoxToDevice(params: {
  srcW: number;
  srcH: number;
  sourceW: number;
  sourceH: number;
  targetW: number;
  targetH: number;
}): { srcW: number; srcH: number } {
  const maxW = Math.min(params.sourceW, params.targetW);
  const maxH = Math.min(params.sourceH, params.targetH);
  const minW = Math.min(FIT_MIN_BOX, maxW);
  const minH = Math.min(FIT_MIN_BOX, maxH);
  const srcW = Math.max(minW, Math.min(maxW, Math.round(params.srcW)));
  const srcH = Math.max(minH, Math.min(maxH, Math.round(params.srcH)));
  return { srcW, srcH };
}

// Mode-aware box clamp dispatcher: routes to the single-invariant clamp helper for the active
// configuration. `fitLockNative=true` requires the box to fit inside the device (no resample
// allowed); fit-with-free-scale uses the source-bound clamp. Crop mode bypasses both — its box
// is fully recomputed from device AR in `applyGeometry`.
export function clampBoxForMode(
  mode: 'crop' | 'fit',
  fitLockNative: boolean,
  params: { srcW: number; srcH: number; sourceW: number; sourceH: number; targetW: number; targetH: number },
): { srcW: number; srcH: number } {
  if (mode === 'fit' && fitLockNative) return clampBoxToDevice(params);
  // 'crop' mode never reaches here in practice — its box is recomputed, not preserved across changes.
  return clampBoxToSource(params);
}

export function buildImageRenderPlan(params: {
  mode: 'crop' | 'fit';
  sourceW: number;
  sourceH: number;
  targetW: number;
  targetH: number;
  fitAlign: FitAlign;
  displayScale: number;
  boxX: number;
  boxY: number;
  boxW: number;
  boxH: number;
  fitSizePct: number;
  fitNoUpscale: boolean;
  fitLockNative: boolean;
}): ImageRenderPlan {
  const srcX = Math.max(0, Math.round(params.boxX / params.displayScale));
  const srcY = Math.max(0, Math.round(params.boxY / params.displayScale));
  const srcW = Math.max(1, Math.min(params.sourceW - srcX, Math.round(params.boxW / params.displayScale)));
  const srcH = Math.max(1, Math.min(params.sourceH - srcY, Math.round(params.boxH / params.displayScale)));

  if (params.mode === 'fit') {
    // Contain branch — covers both regular fit and fit-locked-native (1:1).
    // - fitLockNative: scale forced to 1; box clamp upstream guarantees srcW ≤ targetW, srcH ≤ targetH,
    //   so fittedW=srcW lands ≤ device and fitOffset is ≥ 0 (no clipping).
    // - regular fit: scale = baseScale × (fitSizePct/100), with optional no-upscale cap and a 1-px
    //   snap-up at full fit to absorb rounding drift from box-÷-displayScale.
    const baseScale = Math.min(params.targetW / srcW, params.targetH / srcH);
    let scale: number;
    if (params.fitLockNative) {
      scale = 1;
    } else {
      const factor = Math.max(0.01, Math.min(1, params.fitSizePct / 100));
      scale = baseScale * factor;
      if (params.fitNoUpscale && scale > 1) scale = 1;
    }
    let fittedWidth = Math.max(1, Math.round(srcW * scale));
    let fittedHeight = Math.max(1, Math.round(srcH * scale));
    // 1-px snap-up applies only at full fit; sub-fit factors are deliberate undersize. Skipped under
    // fitLockNative because fittedW=srcW exactly there (no rounding drift to snap).
    if (!params.fitLockNative && scale === baseScale) {
      if (params.targetW - fittedWidth === 1) fittedWidth = params.targetW;
      if (params.targetH - fittedHeight === 1) fittedHeight = params.targetH;
    }
    const offset = fitOffset(fittedWidth, fittedHeight, params.targetW, params.targetH, params.fitAlign);
    return { srcX, srcY, srcW, srcH, fittedWidth, fittedHeight, offsetX: offset.x, offsetY: offset.y };
  }

  // Crop mode: box AR is always locked to device AR (the box machinery in `applyGeometry` enforces
  // it). Output fills the device exactly; rounding drift from box-÷-displayScale is absorbed by the
  // fixed fittedWidth=targetW / fittedHeight=targetH.
  return {
    srcX,
    srcY,
    srcW,
    srcH,
    fittedWidth: params.targetW,
    fittedHeight: params.targetH,
    offsetX: 0,
    offsetY: 0,
  };
}

export function getImageAnalysisRegion(plan: ImageRenderPlan): ImageAnalysisRegion {
  return {
    x: Math.round(plan.offsetX),
    y: Math.round(plan.offsetY),
    width: plan.fittedWidth,
    height: plan.fittedHeight,
    pixelCount: plan.fittedWidth * plan.fittedHeight,
  };
}

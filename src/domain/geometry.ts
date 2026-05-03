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
  const maxZoom = params.mode === 'crop' ? Math.max(1, 1 / baseCropScale) : 1;
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
export function clampCropBox(params: {
  srcW: number;
  srcH: number;
  sourceW: number;
  sourceH: number;
  targetW: number;
  targetH: number;
}): { srcW: number; srcH: number } {
  let srcW = Math.max(1, Math.min(params.sourceW, Math.round(params.srcW)));
  let srcH = Math.max(1, Math.min(params.sourceH, Math.round(params.srcH)));
  srcW = Math.max(srcW, Math.min(params.targetW, params.sourceW));
  srcH = Math.max(srcH, Math.min(params.targetH, params.sourceH));
  return { srcW, srcH };
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
  aspectRatioLocked: boolean;
}): ImageRenderPlan {
  if (params.mode === 'fit') {
    const fitScale = Math.min(params.targetW / params.sourceW, params.targetH / params.sourceH);
    const fittedWidth = Math.max(1, Math.round(params.sourceW * fitScale));
    const fittedHeight = Math.max(1, Math.round(params.sourceH * fitScale));
    const offset = fitOffset(fittedWidth, fittedHeight, params.targetW, params.targetH, params.fitAlign);
    return {
      srcX: 0,
      srcY: 0,
      srcW: params.sourceW,
      srcH: params.sourceH,
      fittedWidth,
      fittedHeight,
      offsetX: offset.x,
      offsetY: offset.y,
    };
  }

  const srcX = Math.max(0, Math.round(params.boxX / params.displayScale));
  const srcY = Math.max(0, Math.round(params.boxY / params.displayScale));
  const srcW = Math.max(1, Math.min(params.sourceW - srcX, Math.round(params.boxW / params.displayScale)));
  const srcH = Math.max(1, Math.min(params.sourceH - srcY, Math.round(params.boxH / params.displayScale)));

  // Locked-AR crop is a contract: the box matches the device aspect ratio, so the output must
  // fill the device exactly. Rounding `boxW/H ÷ displayScale` to integer source pixels can drift
  // the srcW/srcH ratio by a fraction, which would otherwise leave a 1-px fit-bg sliver on one rim.
  if (params.aspectRatioLocked) {
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

  const cropFitScale = Math.min(params.targetW / srcW, params.targetH / srcH);
  const rawFittedWidth = Math.max(1, Math.round(srcW * cropFitScale));
  const rawFittedHeight = Math.max(1, Math.round(srcH * cropFitScale));
  // cropFitScale's min branch lands one axis exactly on its target; the other can round 1 px
  // short due to integer srcW/srcH from box-÷-displayScale rounding. Snap that 1-px deficit up
  // so we don't render a 1-px fit-bg sliver at the rim. Real letterboxes are far larger.
  const fittedWidth = params.targetW - rawFittedWidth === 1 ? params.targetW : rawFittedWidth;
  const fittedHeight = params.targetH - rawFittedHeight === 1 ? params.targetH : rawFittedHeight;
  const offset = fitOffset(fittedWidth, fittedHeight, params.targetW, params.targetH, params.fitAlign);

  return {
    srcX,
    srcY,
    srcW,
    srcH,
    fittedWidth,
    fittedHeight,
    offsetX: offset.x,
    offsetY: offset.y,
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

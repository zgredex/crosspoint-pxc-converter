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
  const x = pos[1] === 'l' ? 0 : pos[1] === 'c' ? (targetW - fw) / 2 : targetW - fw;
  const y = pos[0] === 't' ? 0 : pos[0] === 'm' ? (targetH - fh) / 2 : targetH - fh;
  return { x, y };
}

// Clamp a candidate crop box (in source pixels) to satisfy:
//   - source bounds: 1 ≤ srcW ≤ sourceW, 1 ≤ srcH ≤ sourceH
//   - no upscale: min(targetW/srcW, targetH/srcH) ≤ 1, i.e. srcW ≥ targetW OR srcH ≥ targetH
// `driving` says which axis the user is actively changing — when the candidate
// violates no-upscale, the *other* axis is forced to its target minimum.
export function clampCropBox(params: {
  srcW: number;
  srcH: number;
  sourceW: number;
  sourceH: number;
  targetW: number;
  targetH: number;
  driving: 'w' | 'h' | 'both';
}): { srcW: number; srcH: number } {
  let srcW = Math.max(1, Math.min(params.sourceW, Math.round(params.srcW)));
  let srcH = Math.max(1, Math.min(params.sourceH, Math.round(params.srcH)));
  const minTW = Math.min(params.targetW, params.sourceW);
  const minTH = Math.min(params.targetH, params.sourceH);

  if (srcW < minTW && srcH < minTH) {
    if (params.driving === 'w') srcW = minTW;
    else if (params.driving === 'h') srcH = minTH;
    else { srcW = minTW; srcH = minTH; }
  }
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
  const cropFitScale = Math.min(params.targetW / srcW, params.targetH / srcH);
  const fittedWidth = Math.max(1, Math.round(srcW * cropFitScale));
  const fittedHeight = Math.max(1, Math.round(srcH * cropFitScale));
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

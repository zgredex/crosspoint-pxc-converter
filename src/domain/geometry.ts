export type FitAlign = 'tl' | 'tc' | 'tr' | 'ml' | 'mc' | 'mr' | 'bl' | 'bc' | 'br';

export type ImageRenderPlan =
  | {
      kind: 'fit';
      fittedWidth: number;
      fittedHeight: number;
      offsetX: number;
      offsetY: number;
    }
  | {
      kind: 'crop';
      srcX: number;
      srcY: number;
      cropW: number;
      cropH: number;
    };

export type ImageAnalysisRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
  pixelCount: number;
};

export function fitOffset(fw: number, fh: number, targetW: number, targetH: number, pos: FitAlign): { x: number; y: number } {
  const x = pos[1] === 'l' ? 0 : pos[1] === 'c' ? (targetW - fw) / 2 : targetW - fw;
  const y = pos[0] === 't' ? 0 : pos[0] === 'm' ? (targetH - fh) / 2 : targetH - fh;
  return { x, y };
}

export function buildImageRenderPlan(params: {
  mode: 'crop' | 'fit';
  sourceW: number;
  sourceH: number;
  targetW: number;
  targetH: number;
  fitAlign: FitAlign;
  displayScale: number;
  workScale: number;
  boxX: number;
  boxY: number;
}): ImageRenderPlan {
  if (params.mode === 'fit') {
    const fitScale = Math.min(params.targetW / params.sourceW, params.targetH / params.sourceH);
    const fittedWidth = Math.max(1, Math.round(params.sourceW * fitScale));
    const fittedHeight = Math.max(1, Math.round(params.sourceH * fitScale));
    const offset = fitOffset(fittedWidth, fittedHeight, params.targetW, params.targetH, params.fitAlign);

    return {
      kind: 'fit',
      fittedWidth,
      fittedHeight,
      offsetX: offset.x,
      offsetY: offset.y,
    };
  }

  const srcX = Math.max(0, Math.round(params.boxX / params.displayScale));
  const srcY = Math.max(0, Math.round(params.boxY / params.displayScale));
  const cropW = Math.max(1, Math.min(params.sourceW - srcX, Math.round(params.targetW / params.workScale)));
  const cropH = Math.max(1, Math.min(params.sourceH - srcY, Math.round(params.targetH / params.workScale)));

  return {
    kind: 'crop',
    srcX,
    srcY,
    cropW,
    cropH,
  };
}

export function getImageAnalysisRegion(
  plan: ImageRenderPlan,
  targetW: number,
  targetH: number,
): ImageAnalysisRegion {
  if (plan.kind === 'fit') {
    return {
      x: Math.round(plan.offsetX),
      y: Math.round(plan.offsetY),
      width: plan.fittedWidth,
      height: plan.fittedHeight,
      pixelCount: plan.fittedWidth * plan.fittedHeight,
    };
  }

  return {
    x: 0,
    y: 0,
    width: targetW,
    height: targetH,
    pixelCount: targetW * targetH,
  };
}

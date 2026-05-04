import type { FitBackground } from '../../app/state';
import type { ImageRenderPlan } from '../../domain/geometry';
import { createCanvas, getContext2d } from '../../infra/canvas/context';
import { stepDownscaleAndResize, type PicaResizer } from '../../infra/canvas/picaResize';
import type { SourceImage } from './source';

function sourceDims(src: SourceImage): { w: number; h: number } {
  return src instanceof HTMLImageElement
    ? { w: src.naturalWidth, h: src.naturalHeight }
    : { w: src.width, h: src.height };
}

export async function renderImageBaseRaster(params: {
  src: SourceImage;
  targetCanvas: HTMLCanvasElement;
  plan: ImageRenderPlan;
  fitBg: FitBackground;
  pica: PicaResizer;
}): Promise<void> {
  const context = getContext2d(params.targetCanvas);
  context.fillStyle = params.fitBg === 'black' ? '#000000' : '#ffffff';
  context.fillRect(0, 0, params.targetCanvas.width, params.targetCanvas.height);

  const { w: srcFullW, h: srcFullH } = sourceDims(params.src);
  const isFullSource =
    params.plan.srcX === 0 &&
    params.plan.srcY === 0 &&
    params.plan.srcW === srcFullW &&
    params.plan.srcH === srcFullH;

  let extract: SourceImage = params.src;
  if (!isFullSource) {
    const extractCanvas = createCanvas(params.plan.srcW, params.plan.srcH);
    getContext2d(extractCanvas).drawImage(
      params.src,
      params.plan.srcX,
      params.plan.srcY,
      params.plan.srcW,
      params.plan.srcH,
      0,
      0,
      params.plan.srcW,
      params.plan.srcH,
    );
    extract = extractCanvas;
  }

  // 1:1 placement (fittedW/H equal source dims) skips pica entirely — source pixels go straight
  // to the target at native resolution, no resampling.
  if (
    params.plan.fittedWidth === params.plan.srcW &&
    params.plan.fittedHeight === params.plan.srcH &&
    params.plan.srcW > 0 &&
    params.plan.srcH > 0
  ) {
    context.drawImage(extract, params.plan.offsetX, params.plan.offsetY);
    return;
  }

  const fittedCanvas = createCanvas(params.plan.fittedWidth, params.plan.fittedHeight);
  await stepDownscaleAndResize(params.pica, extract, fittedCanvas);
  context.drawImage(fittedCanvas, params.plan.offsetX, params.plan.offsetY);
}

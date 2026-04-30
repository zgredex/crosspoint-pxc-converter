import type { FitBackground } from '../../app/state';
import type { ImageRenderPlan } from '../../domain/geometry';
import { createCanvas, getContext2d } from '../../infra/canvas/context';
import { stepDownscaleAndResize, type PicaResizer } from '../../infra/canvas/picaResize';
import type { SourceImage } from './source';

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

  if (params.plan.kind === 'fit') {
    const fitCanvas = createCanvas(params.plan.fittedWidth, params.plan.fittedHeight);
    await stepDownscaleAndResize(params.pica, params.src, fitCanvas);
    context.drawImage(fitCanvas, params.plan.offsetX, params.plan.offsetY);
    return;
  }

  const cropCanvas = createCanvas(params.plan.cropW, params.plan.cropH);
  getContext2d(cropCanvas).drawImage(
    params.src,
    params.plan.srcX,
    params.plan.srcY,
    params.plan.cropW,
    params.plan.cropH,
    0,
    0,
    params.plan.cropW,
    params.plan.cropH,
  );
  await stepDownscaleAndResize(params.pica, cropCanvas, params.targetCanvas);
}

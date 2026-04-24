import type { FitBackground } from '../../app/state';
import type { DitherMode } from '../../domain/dither';
import { ditherToIndexedGray } from '../../domain/dither';
import { encodeGrayBmp } from '../../domain/formats/bmpGray';
import { encodePxc } from '../../domain/formats/pxc';
import type { ImageRenderPlan } from '../../domain/geometry';
import { buildHistogram } from '../../domain/histogram';
import {
  applyBlackWhitePoints,
  applyContrast,
  applyGamma,
  applyInvert,
  buildLuminanceBuffer,
} from '../../domain/tone';
import { resizeWithPica, type PicaResizer } from '../../infra/canvas/picaResize';

type SourceImage = HTMLImageElement | HTMLCanvasElement;

function getContext2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D canvas context is unavailable');
  return context;
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export type ImageProcessingSettings = {
  blackPoint: number;
  whitePoint: number;
  gammaValue: number;
  gammaLut: Float32Array | null;
  contrastValue: number;
  invert: boolean;
  ditherEnabled: boolean;
  ditherMode: DitherMode;
};

export type ImageProcessingResult = {
  histogram: Float32Array;
  indexedPixels: Uint8Array;
  pxcBytes: Uint8Array;
  bmpBytes: Uint8Array;
};

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
    await resizeWithPica(params.pica, params.src, fitCanvas);
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
  await resizeWithPica(params.pica, cropCanvas, params.targetCanvas);
}

export function buildImageOutputs(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  settings: ImageProcessingSettings,
): ImageProcessingResult {
  let buffer = buildLuminanceBuffer(rgba);
  buffer = applyBlackWhitePoints(buffer, settings.blackPoint, settings.whitePoint);
  buffer = applyGamma(buffer, settings.gammaLut, settings.gammaValue);
  buffer = applyContrast(buffer, settings.contrastValue);
  if (settings.invert) buffer = applyInvert(buffer);

  const histogram = buildHistogram(buffer);
  const indexedPixels = ditherToIndexedGray(buffer, width, height, settings.ditherEnabled, settings.ditherMode);

  return {
    histogram,
    indexedPixels,
    pxcBytes: encodePxc(indexedPixels, width, height),
    bmpBytes: encodeGrayBmp(indexedPixels, width, height),
  };
}

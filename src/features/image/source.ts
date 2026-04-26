import type { Rotation } from '../../app/state';
import type { ImageRuntime } from '../../app/runtime/imageRuntime';
import { createCanvas, getContext2d } from '../../infra/canvas/context';

export type SourceImage = HTMLImageElement | HTMLCanvasElement;

export function buildRotatedSource(
  runtime: ImageRuntime,
  rotation: Rotation,
  mirrorH: boolean,
  mirrorV: boolean,
): void {
  if (!runtime.loadedImg) return;

  const sourceWidth = runtime.loadedImg.naturalWidth;
  const sourceHeight = runtime.loadedImg.naturalHeight;
  const rotatedWidth = rotation % 180 === 0 ? sourceWidth : sourceHeight;
  const rotatedHeight = rotation % 180 === 0 ? sourceHeight : sourceWidth;

  if (!runtime.rotatedSrc) runtime.rotatedSrc = createCanvas(rotatedWidth, rotatedHeight);
  runtime.rotatedSrc.width = rotatedWidth;
  runtime.rotatedSrc.height = rotatedHeight;

  const context = getContext2d(runtime.rotatedSrc);
  context.clearRect(0, 0, rotatedWidth, rotatedHeight);
  context.save();
  context.translate(rotatedWidth / 2, rotatedHeight / 2);
  context.rotate(rotation * Math.PI / 180);
  if (mirrorH) context.scale(-1, 1);
  if (mirrorV) context.scale(1, -1);
  context.drawImage(runtime.loadedImg, -sourceWidth / 2, -sourceHeight / 2);
  context.restore();
}

export function getSourceImage(
  runtime: ImageRuntime,
  rotation: Rotation,
  mirrorH: boolean,
  mirrorV: boolean,
): SourceImage {
  if (!runtime.loadedImg) throw new Error('Source image is not loaded');
  if (rotation === 0 && !mirrorH && !mirrorV) return runtime.loadedImg;
  if (!runtime.rotatedSrc) throw new Error('Rotated source is not available');
  return runtime.rotatedSrc;
}

export function srcW(source: SourceImage): number {
  return source instanceof HTMLImageElement ? source.naturalWidth : source.width;
}

export function srcH(source: SourceImage): number {
  return source instanceof HTMLImageElement ? source.naturalHeight : source.height;
}

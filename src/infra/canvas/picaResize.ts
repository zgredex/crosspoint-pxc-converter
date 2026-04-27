import picaFactory from 'pica';
import { createCanvas, getContext2d } from './context';

export type PicaResizer = {
  resize(source: CanvasImageSource, destination: HTMLCanvasElement, options: object): Promise<void>;
};

type SteppableSource = HTMLImageElement | HTMLCanvasElement;

export const PICA_OPTS = { filter: 'lanczos3', unsharpAmount: 0 };

export function createPicaResizer(): PicaResizer {
  return picaFactory() as PicaResizer;
}

export async function resizeWithPica(
  pica: PicaResizer,
  source: CanvasImageSource,
  destination: HTMLCanvasElement,
): Promise<void> {
  await pica.resize(source, destination, PICA_OPTS);
}

function sourceWidth(source: SteppableSource): number {
  return source instanceof HTMLImageElement ? source.naturalWidth : source.width;
}

function sourceHeight(source: SteppableSource): number {
  return source instanceof HTMLImageElement ? source.naturalHeight : source.height;
}

export async function stepDownscaleAndResize(
  pica: PicaResizer,
  source: SteppableSource,
  destination: HTMLCanvasElement,
): Promise<void> {
  let current: SteppableSource = source;
  let currentWidth = sourceWidth(source);
  let currentHeight = sourceHeight(source);

  while (currentWidth > destination.width * 2 || currentHeight > destination.height * 2) {
    const nextWidth = Math.max(destination.width, currentWidth >> 1);
    const nextHeight = Math.max(destination.height, currentHeight >> 1);
    const next = createCanvas(nextWidth, nextHeight);
    const context = getContext2d(next);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(current, 0, 0, nextWidth, nextHeight);
    current = next;
    currentWidth = nextWidth;
    currentHeight = nextHeight;
  }

  await resizeWithPica(pica, current, destination);
}

import picaFactory from 'pica';

export type PicaResizer = {
  resize(source: CanvasImageSource, destination: HTMLCanvasElement, options: object): Promise<void>;
};

export const PICA_OPTS = { filter: 'lanczos3', unsharpAmount: 80, unsharpRadius: 0.6, unsharpThreshold: 2 };

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

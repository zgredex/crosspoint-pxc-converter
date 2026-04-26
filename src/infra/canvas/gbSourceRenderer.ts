import type { GbPaletteKey } from '../../domain/formats/bmpGb';
import { GB_PALETTES } from '../../domain/formats/bmpGb';
import { getContext2d } from './context';

export function renderGbSourceCanvas(
  canvas: HTMLCanvasElement,
  pixels: Uint8Array,
  width: number,
  height: number,
  paletteKey: GbPaletteKey,
  scale: number,
  paletteRemap: number[] | null,
  invert: boolean,
): void {
  const palette = GB_PALETTES[paletteKey];
  const temp = document.createElement('canvas');
  temp.width = width;
  temp.height = height;
  const tempContext = getContext2d(temp);
  const imageData = tempContext.createImageData(width, height);

  for (let i = 0; i < width * height; i++) {
    let color = pixels[i];
    if (paletteRemap) color = paletteRemap[color];
    if (invert) color = 3 - color;
    imageData.data[i * 4] = palette[color][0];
    imageData.data[i * 4 + 1] = palette[color][1];
    imageData.data[i * 4 + 2] = palette[color][2];
    imageData.data[i * 4 + 3] = 255;
  }

  tempContext.putImageData(imageData, 0, 0);

  canvas.width = width * scale;
  canvas.height = height * scale;
  const context = getContext2d(canvas);
  context.imageSmoothingEnabled = false;
  context.drawImage(temp, 0, 0, canvas.width, canvas.height);
}

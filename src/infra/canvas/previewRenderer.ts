import { GRAY_DISP } from '../../domain/quantize';

function getContext2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D canvas context is unavailable');
  return context;
}

export function renderIndexedPreview(canvas: HTMLCanvasElement, q: Uint8Array, width: number, height: number): void {
  const context = getContext2d(canvas);
  const imageData = context.createImageData(width, height);

  for (let i = 0; i < width * height; i++) {
    const gray = GRAY_DISP[q[i]];
    imageData.data[i * 4] = gray;
    imageData.data[i * 4 + 1] = gray;
    imageData.data[i * 4 + 2] = gray;
    imageData.data[i * 4 + 3] = 255;
  }

  context.putImageData(imageData, 0, 0);
}

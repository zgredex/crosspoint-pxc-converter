import { ditherToIndexedGray, type DitherMode } from '../../domain/dither';
import { buildHistogram } from '../../domain/histogram';
import { buildToneLut } from '../../domain/tone';

export type WorkerSettings = {
  blackPoint: number;
  whitePoint: number;
  gammaValue: number;
  contrastValue: number;
  invert: boolean;
  ditherEnabled: boolean;
  ditherMode: DitherMode;
};

export type WorkerInMessage =
  | { type: 'set-base-raster'; buffer: SharedArrayBuffer; width: number; height: number; version: number }
  | { type: 'process'; settings: WorkerSettings; version: number };

export type WorkerOutMessage =
  | { type: 'ready' }
  | { type: 'result'; indexedPixels: ArrayBuffer; histogram: ArrayBuffer; version: number };

let baseRaster: Uint8ClampedArray | null = null;
let baseWidth = 0;
let baseHeight = 0;
let baseVersion = 0;

function processMessage(e: MessageEvent<WorkerInMessage>): void {
  const msg = e.data;

  if (msg.type === 'set-base-raster') {
    baseRaster = new Uint8ClampedArray(msg.buffer);
    baseWidth = msg.width;
    baseHeight = msg.height;
    baseVersion = msg.version;
    return;
  }

  if (msg.type === 'process') {
    if (!baseRaster) return;

    const { settings, version } = msg;
    const toneLut = buildToneLut(settings);
    const totalPixels = baseRaster.length / 4;
    const buffer = new Float32Array(totalPixels);
    for (let i = 0; i < totalPixels; i++) {
      const offset = i * 4;
      const luminance = 0.299 * baseRaster[offset] + 0.587 * baseRaster[offset + 1] + 0.114 * baseRaster[offset + 2];
      const idx = luminance < 0 ? 0 : luminance > 255 ? 255 : Math.round(luminance);
      buffer[i] = toneLut[idx];
    }

    const histogram = buildHistogram(buffer);
    const indexedPixels = ditherToIndexedGray(buffer, baseWidth, baseHeight, settings.ditherEnabled, settings.ditherMode);

    const response: WorkerOutMessage = {
      type: 'result',
      indexedPixels: indexedPixels.buffer.slice(0) as ArrayBuffer,
      histogram: histogram.buffer.slice(0) as ArrayBuffer,
      version,
    };
    self.postMessage(response);
  }
}

self.addEventListener('message', processMessage);
self.postMessage({ type: 'ready' });

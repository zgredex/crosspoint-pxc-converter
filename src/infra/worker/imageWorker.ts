import { ditherToIndexedGray } from '../../domain/dither';
import { buildHistogram } from '../../domain/histogram';
import {
  buildLuminanceBuffer,
  applyBlackWhitePoints,
  applyGamma,
  applyContrast,
  applyInvert,
} from '../../domain/tone';

export type DitherMode = 'fs' | 'atk' | 'jjn' | 'stucki' | 'burkes' | 'bayer' | 'zhou-fang' | 'blue-noise';

export type WorkerSettings = {
  blackPoint: number;
  whitePoint: number;
  gammaValue: number;
  gammaLut: Float32Array | null;
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
    let buffer = buildLuminanceBuffer(baseRaster);
    buffer = applyBlackWhitePoints(buffer, settings.blackPoint, settings.whitePoint);
    buffer = applyGamma(buffer, settings.gammaLut, settings.gammaValue);
    buffer = applyContrast(buffer, settings.contrastValue);
    if (settings.invert) buffer = applyInvert(buffer);

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

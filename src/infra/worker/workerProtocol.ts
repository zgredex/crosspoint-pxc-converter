import type { DitherMode } from '../../domain/dither';

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

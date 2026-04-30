import { DEFAULT_XT, DEVICES, type DeviceKey } from '../domain/devices';
import type { DitherMode } from '../domain/dither';
import type { FitAlign } from '../domain/geometry';
import type { GbPaletteKey } from '../domain/formats/bmpGb';

export type LoadedType = 'image' | 'gb' | null;
export type FitBackground = 'white' | 'black';
export type Rotation = 0 | 90 | 180 | 270;
export type UiTone = 'error' | 'info' | null;

export type OutputState = {
  pxcReady: boolean;
  bmpReady: boolean;
  baseName: string;
};

export type GbDims = {
  width: number;
  height: number;
};

export type GbFileInfo = {
  name: string;
  sizeText: string;
  tilesText: string;
  dimsText: string;
  warningText: string | null;
  paletteInfoText: string | null;
};

export type DeviceState = {
  key: DeviceKey;
  targetW: number;
  targetH: number;
  totalPixels: number;
};

export type ImageDims = {
  width: number;
  height: number;
};

export type ImageState = {
  mode: 'crop' | 'fit';
  fitAlign: FitAlign;
  contrastValue: number;
  blackPoint: number;
  whitePoint: number;
  gammaValue: number;
  invert: boolean;
  ditherEnabled: boolean;
  ditherMode: DitherMode;
  rotation: Rotation;
  mirrorH: boolean;
  mirrorV: boolean;
  editorZoom: number;
  editorMaxZoom: number;
  sourceDims: ImageDims | null;
};

export type GbState = {
  paletteKey: GbPaletteKey;
  invert: boolean;
  rotation: Rotation;
  zoom: number;
  outputScale: number;
  dims: GbDims | null;
  fileInfo: GbFileInfo | null;
};

export type AppState = {
  loadedType: LoadedType;
  device: DeviceState;
  background: FitBackground;
  image: ImageState;
  gb: GbState;
  output: OutputState;
  ui: {
    tone: UiTone;
    message: string | null;
  };
};

function createDeviceState(key: DeviceKey): DeviceState {
  const spec = DEVICES[key];
  return {
    key,
    targetW: spec.w,
    targetH: spec.h,
    totalPixels: spec.w * spec.h,
  };
}

export const initialImageState: ImageState = {
  mode: 'crop',
  fitAlign: 'mc',
  contrastValue: 0,
  blackPoint: 0,
  whitePoint: 255,
  gammaValue: 1.0,
  invert: false,
  ditherEnabled: true,
  ditherMode: 'fs',
  rotation: 0,
  mirrorH: false,
  mirrorV: false,
  editorZoom: 1.0,
  editorMaxZoom: 1.0,
  sourceDims: null,
};

export const initialGbState: GbState = {
  paletteKey: 'dmg',
  invert: false,
  rotation: 0,
  zoom: 0,
  outputScale: 1,
  dims: null,
  fileInfo: null,
};

export const initialOutputState: OutputState = {
  pxcReady: false,
  bmpReady: false,
  baseName: 'sleep',
};

export const initialAppState: AppState = {
  loadedType: null,
  device: createDeviceState(DEFAULT_XT),
  background: 'white',
  image: initialImageState,
  gb: initialGbState,
  output: initialOutputState,
  ui: {
    tone: null,
    message: null,
  },
};

export function getDeviceState(key: DeviceKey): DeviceState {
  return createDeviceState(key);
}

export type ImageRuntime = {
  loadedImg: HTMLImageElement | null;
  rotatedSrc: HTMLCanvasElement | null;
  readonly sessionVersion: number;
  readonly displayScale: number;
  readonly workScale: number;
  readonly dispImgW: number;
  readonly dispImgH: number;
  readonly boxW: number;
  readonly boxH: number;
  readonly boxX: number;
  readonly boxY: number;
  lastHistogram: Float32Array | null;
  lastIndexedPixels: Uint8Array | null;
  readonly cachedBaseRaster: Uint8ClampedArray | null;
  readonly sharedBufferVersion: number;
  processVersion: number;
  convertTimer: number | null;
  autoLevelsGen: number;
};

type MutableImageRuntime = {
  -readonly [K in keyof ImageRuntime]: ImageRuntime[K];
};

export type GeometryCommit = {
  displayScale: number;
  workScale: number;
  dispImgW: number;
  dispImgH: number;
  boxW: number;
  boxH: number;
  boxX: number;
  boxY: number;
};

function asMutableRuntime(runtime: ImageRuntime): MutableImageRuntime {
  return runtime as MutableImageRuntime;
}

export function commitGeometry(runtime: ImageRuntime, next: GeometryCommit): void {
  const mutable = asMutableRuntime(runtime);
  mutable.displayScale = next.displayScale;
  mutable.workScale = next.workScale;
  mutable.dispImgW = next.dispImgW;
  mutable.dispImgH = next.dispImgH;
  mutable.boxW = next.boxW;
  mutable.boxH = next.boxH;
  mutable.boxX = next.boxX;
  mutable.boxY = next.boxY;
}

export function clearGeometry(runtime: ImageRuntime): void {
  const mutable = asMutableRuntime(runtime);
  mutable.displayScale = 1;
  mutable.workScale = 1;
  mutable.dispImgW = 0;
  mutable.dispImgH = 0;
  mutable.boxW = 0;
  mutable.boxH = 0;
  mutable.boxX = 0;
  mutable.boxY = 0;
}

export function setBoxPosition(runtime: ImageRuntime, x: number, y: number): void {
  const mutable = asMutableRuntime(runtime);
  mutable.boxX = x;
  mutable.boxY = y;
}

export function setBoxSize(runtime: ImageRuntime, w: number, h: number): void {
  const mutable = asMutableRuntime(runtime);
  mutable.boxW = w;
  mutable.boxH = h;
}

export function commitBaseRaster(runtime: ImageRuntime, raster: Uint8ClampedArray): void {
  asMutableRuntime(runtime).cachedBaseRaster = raster;
}

export function clearBaseRaster(runtime: ImageRuntime): void {
  const mutable = asMutableRuntime(runtime);
  mutable.cachedBaseRaster = null;
  mutable.sharedBufferVersion = 0;
}

export function bumpSharedBufferVersion(runtime: ImageRuntime): number {
  const mutable = asMutableRuntime(runtime);
  mutable.sharedBufferVersion += 1;
  return mutable.sharedBufferVersion;
}

export function bumpImageSession(runtime: ImageRuntime): number {
  const mutable = asMutableRuntime(runtime);
  mutable.sessionVersion += 1;
  return mutable.sessionVersion;
}

export function createImageRuntime(): ImageRuntime {
  return {
    loadedImg: null,
    rotatedSrc: null,
    sessionVersion: 0,
    displayScale: 1,
    workScale: 1,
    dispImgW: 0,
    dispImgH: 0,
    boxW: 0,
    boxH: 0,
    boxX: 0,
    boxY: 0,
    lastHistogram: null,
    lastIndexedPixels: null,
    cachedBaseRaster: null,
    sharedBufferVersion: 0,
    processVersion: 0,
    convertTimer: null,
    autoLevelsGen: 0,
  };
}

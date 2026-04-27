export type ImageRuntime = {
  loadedImg: HTMLImageElement | null;
  rotatedSrc: HTMLCanvasElement | null;
  displayScale: number;
  workScale: number;
  dispImgW: number;
  dispImgH: number;
  boxW: number;
  boxH: number;
  boxX: number;
  boxY: number;
  lastHistogram: Float32Array | null;
  lastIndexedPixels: Uint8Array | null;
  cachedBaseRaster: Uint8ClampedArray | null;
  sharedBufferVersion: number;
  processVersion: number;
  convertTimer: number | null;
  autoLevelsGen: number;
};

export function createImageRuntime(): ImageRuntime {
  return {
    loadedImg: null,
    rotatedSrc: null,
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

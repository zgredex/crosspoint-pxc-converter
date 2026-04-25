export type ImageRuntime = {
  loadedImg: HTMLImageElement | null;
  rotatedSrc: HTMLCanvasElement | null;
  gammaLut: Float32Array | null;
  displayScale: number;
  workScale: number;
  dispImgW: number;
  dispImgH: number;
  boxW: number;
  boxH: number;
  boxX: number;
  boxY: number;
  lastHistogram: Float32Array | null;
  convertTimer: ReturnType<typeof setTimeout> | null;
  convertGen: number;
  autoLevelsGen: number;
};

export function createImageRuntime(): ImageRuntime {
  return {
    loadedImg: null,
    rotatedSrc: null,
    gammaLut: null,
    displayScale: 1,
    workScale: 1,
    dispImgW: 0,
    dispImgH: 0,
    boxW: 0,
    boxH: 0,
    boxX: 0,
    boxY: 0,
    lastHistogram: null,
    convertTimer: null,
    convertGen: 0,
    autoLevelsGen: 0,
  };
}

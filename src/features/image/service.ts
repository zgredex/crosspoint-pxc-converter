import type { DitherMode } from '../../domain/dither';
import { ditherToIndexedGray } from '../../domain/dither';
import { encodeGrayBmp } from '../../domain/formats/bmpGray';
import { encodePxc } from '../../domain/formats/pxc';
import { buildHistogram } from '../../domain/histogram';
import {
  applyBlackWhitePoints,
  applyContrast,
  applyGamma,
  applyInvert,
  buildLuminanceBuffer,
} from '../../domain/tone';

export type ImageProcessingSettings = {
  blackPoint: number;
  whitePoint: number;
  gammaValue: number;
  gammaLut: Float32Array | null;
  contrastValue: number;
  invert: boolean;
  ditherEnabled: boolean;
  ditherMode: DitherMode;
};

export type ImageProcessingResult = {
  histogram: Float32Array;
  indexedPixels: Uint8Array;
  pxcBytes: Uint8Array;
  bmpBytes: Uint8Array;
};

export function buildImageOutputs(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  settings: ImageProcessingSettings,
): ImageProcessingResult {
  let buffer = buildLuminanceBuffer(rgba);
  buffer = applyBlackWhitePoints(buffer, settings.blackPoint, settings.whitePoint);
  buffer = applyGamma(buffer, settings.gammaLut, settings.gammaValue);
  buffer = applyContrast(buffer, settings.contrastValue);
  if (settings.invert) buffer = applyInvert(buffer);

  const histogram = buildHistogram(buffer);
  const indexedPixels = ditherToIndexedGray(buffer, width, height, settings.ditherEnabled, settings.ditherMode);

  return {
    histogram,
    indexedPixels,
    pxcBytes: encodePxc(indexedPixels, width, height),
    bmpBytes: encodeGrayBmp(indexedPixels, width, height),
  };
}

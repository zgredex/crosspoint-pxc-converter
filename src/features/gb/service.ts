import type { AppState, FitBackground, GbFileInfo } from '../../app/state';
import type { GbPaletteKey } from '../../domain/formats/bmpGb';
import { encodeGbBmp } from '../../domain/formats/bmpGb';
import { GB_SHADE_NAMES } from '../../domain/gb/constants';
import { encodePxc } from '../../domain/formats/pxc';
import { rotatePixels } from '../../domain/gb/rotatePixels';

const GB_TO_PXC = [3, 2, 1, 0] as const;

export type GbSourceView = {
  pixels: Uint8Array;
  width: number;
  height: number;
  displayScale: number;
};

export type GbOutputArtifacts = {
  indexedPixels: Uint8Array;
  pxcBytes: Uint8Array;
  bmpBytes: Uint8Array;
};

export type { GbFileInfo };

export function getRotatedDims(
  width: number,
  height: number,
  rotation: 0 | 90 | 180 | 270,
): { w: number; h: number } {
  return rotation === 90 || rotation === 270
    ? { w: height, h: width }
    : { w: width, h: height };
}

export function computeGbDisplayScale(
  width: number,
  height: number,
  rotation: 0 | 90 | 180 | 270,
  zoom: number,
): number {
  if (zoom > 0) return zoom;
  const { w } = getRotatedDims(width, height, rotation);
  return Math.max(1, Math.min(6, Math.floor(400 / w)));
}

export function selectGbDisplayScale(state: AppState): number {
  if (!state.gb.dims) return 1;
  return computeGbDisplayScale(state.gb.dims.width, state.gb.dims.height, state.gb.rotation, state.gb.zoom);
}

export function buildGbSourceView(
  pixels: Uint8Array,
  width: number,
  height: number,
  rotation: 0 | 90 | 180 | 270,
  zoom: number,
): GbSourceView {
  const rotated = rotatePixels(pixels, width, height, rotation);
  return {
    pixels: rotated.pixels,
    width: rotated.w,
    height: rotated.h,
    displayScale: computeGbDisplayScale(width, height, rotation, zoom),
  };
}

export function buildGbOutputArtifacts(params: {
  pixels: Uint8Array;
  width: number;
  height: number;
  rotation: 0 | 90 | 180 | 270;
  outputScale: number;
  targetW: number;
  targetH: number;
  background: FitBackground;
  paletteRemap: number[] | null;
  invert: boolean;
  paletteKey: GbPaletteKey;
}): GbOutputArtifacts {
  const rotated = rotatePixels(params.pixels, params.width, params.height, params.rotation);
  const scaledW = Math.min(rotated.w * params.outputScale, params.targetW);
  const scaledH = Math.min(rotated.h * params.outputScale, params.targetH);
  const offsetX = Math.round((params.targetW - scaledW) / 2);
  const offsetY = Math.round((params.targetH - scaledH) / 2);
  const backgroundLevel = params.background === 'black' ? 0 : 3;
  const indexedPixels = new Uint8Array(params.targetW * params.targetH).fill(backgroundLevel);

  for (let y = 0; y < scaledH; y++) {
    const srcY = Math.floor(y / params.outputScale);
    for (let x = 0; x < scaledW; x++) {
      const srcX = Math.floor(x / params.outputScale);
      let color = rotated.pixels[srcY * rotated.w + srcX];
      if (params.paletteRemap) color = params.paletteRemap[color];
      if (params.invert) color = 3 - color;
      indexedPixels[(offsetY + y) * params.targetW + (offsetX + x)] = GB_TO_PXC[color];
    }
  }

  return {
    indexedPixels,
    pxcBytes: encodePxc(indexedPixels, params.targetW, params.targetH),
    bmpBytes: encodeGbBmp(indexedPixels, params.targetW, params.targetH, params.paletteKey),
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function buildGbFileInfo(params: {
  name: string;
  rawByteLength: number;
  tilesWide: number;
  paletteRemap: number[] | null;
}): GbFileInfo {
  const totalTiles = Math.floor(params.rawByteLength / 16);
  const trailingBytes = params.rawByteLength % 16;
  const tilesHigh = Math.ceil(totalTiles / params.tilesWide);

  let paletteInfoText: string | null = null;
  if (params.paletteRemap) {
    const register = params.paletteRemap.reduce((acc, shade, index) => acc | (shade << (index * 2)), 0);
    const mapping = params.paletteRemap.map((shade, index) => `${GB_SHADE_NAMES[index]}→${GB_SHADE_NAMES[shade]}`).join(' ');
    paletteInfoText = `0x${register.toString(16).toUpperCase().padStart(2, '0')} (${mapping})`;
  }

  return {
    name: params.name,
    sizeText: formatBytes(params.rawByteLength),
    tilesText: `${totalTiles} (${params.tilesWide}×${tilesHigh})`,
    dimsText: `${params.tilesWide * 8} × ${tilesHigh * 8} px`,
    warningText: trailingBytes ? `⚠ ${trailingBytes} trailing byte${trailingBytes > 1 ? 's' : ''} ignored` : null,
    paletteInfoText,
  };
}

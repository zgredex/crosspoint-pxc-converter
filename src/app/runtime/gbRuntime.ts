export type GbRuntime = {
  rawBytes: Uint8Array | null;
  pixels: Uint8Array | null;
  width: number;
  height: number;
  paletteRemap: number[] | null;
  renderedScale: number;
};

export function createGbRuntime(): GbRuntime {
  return {
    rawBytes: null,
    pixels: null,
    width: 0,
    height: 0,
    paletteRemap: null,
    renderedScale: 1,
  };
}

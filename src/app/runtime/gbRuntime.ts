export type GbRuntime = {
  rawBytes: Uint8Array | null;
  pixels: Uint8Array | null;
  paletteRemap: number[] | null;
};

export function createGbRuntime(): GbRuntime {
  return {
    rawBytes: null,
    pixels: null,
    paletteRemap: null,
  };
}

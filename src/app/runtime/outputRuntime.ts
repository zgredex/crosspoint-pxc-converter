export type OutputRuntime = {
  pxcBytes: Uint8Array | null;
  bmpBytes: Uint8Array | null;
  outputBaseName: string;
};

export function createOutputRuntime(): OutputRuntime {
  return {
    pxcBytes: null,
    bmpBytes: null,
    outputBaseName: 'sleep',
  };
}

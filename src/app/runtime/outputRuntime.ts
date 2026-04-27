export type OutputRuntime = {
  pxcBytes: Uint8Array | null;
  bmpBytes: Uint8Array | null;
};

export function createOutputRuntime(): OutputRuntime {
  return {
    pxcBytes: null,
    bmpBytes: null,
  };
}

export function hasOutput(output: OutputRuntime): output is OutputRuntime & { pxcBytes: Uint8Array; bmpBytes: Uint8Array } {
  return output.pxcBytes !== null && output.bmpBytes !== null;
}

export function setOutputBytes(output: OutputRuntime, pxcBytes: Uint8Array, bmpBytes: Uint8Array): void {
  output.pxcBytes = pxcBytes;
  output.bmpBytes = bmpBytes;
}

export function clearOutputBytes(output: OutputRuntime): void {
  output.pxcBytes = null;
  output.bmpBytes = null;
}

export function validateGbBytes(bytes: Uint8Array, sourceLabel: string): void {
  if (bytes.length === 0) {
    throw new Error(`${sourceLabel} did not contain any GB tile bytes.`);
  }
  if (bytes.length < 16) {
    throw new Error(`${sourceLabel} must contain at least one 16-byte tile.`);
  }
}

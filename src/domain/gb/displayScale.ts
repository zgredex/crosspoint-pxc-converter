import { rotatedSourceDims } from '../geometry';

export function computeGbDisplayScale(
  width: number,
  height: number,
  rotation: 0 | 90 | 180 | 270,
  zoom: number,
): number {
  if (zoom > 0) return zoom;
  const { w } = rotatedSourceDims(width, height, rotation);
  return Math.max(1, Math.min(6, Math.floor(400 / w)));
}

// Largest integer output scale that keeps the rotated tile art inside the device.
// Floors at 1: art larger than the device renders at 1× (clipped), matching adjustOutputScale's lower bound.
export function computeMaxGbOutputScale(
  width: number,
  height: number,
  rotation: 0 | 90 | 180 | 270,
  targetW: number,
  targetH: number,
): number {
  const { w, h } = rotatedSourceDims(width, height, rotation);
  return Math.max(1, Math.min(Math.floor(targetW / w), Math.floor(targetH / h)));
}

function getRotatedDims(
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

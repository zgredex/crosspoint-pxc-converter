export const GRAY_DISP = [0, 85, 170, 255] as const;

export function quantize(v: number): 0 | 1 | 2 | 3 {
  if (v < 42) return 0;
  if (v < 127) return 1;
  if (v < 212) return 2;
  return 3;
}

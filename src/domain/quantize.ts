export const GRAY_DISP = [0, 85, 170, 255] as const;

export type QuantPreset = 'pr1614' | 'master';

const THRESHOLDS: Record<QuantPreset, readonly [number, number, number]> = {
  pr1614: [42, 127, 212],
  master: [45, 70, 140],
};

let activePreset: QuantPreset = 'pr1614';

export function setQuantPreset(p: QuantPreset): void {
  activePreset = p;
}

export function getQuantPreset(): QuantPreset {
  return activePreset;
}

export function quantize(v: number): 0 | 1 | 2 | 3 {
  const t = THRESHOLDS[activePreset];
  if (v < t[0]) return 0;
  if (v < t[1]) return 1;
  if (v < t[2]) return 2;
  return 3;
}

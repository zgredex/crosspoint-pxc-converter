export const GRAY_DISP = [0, 85, 170, 255] as const;

export type QuantPreset = 'pr1614' | 'master';

export type QuantThresholds = readonly [number, number, number];

export const DEFAULT_QUANT_PRESET: QuantPreset = 'pr1614';

export const QUANT_PRESET_LABELS: Record<QuantPreset, string> = {
  pr1614: 'PR1614 (current)',
  master: 'crosspoint master',
};

const THRESHOLDS: Record<QuantPreset, QuantThresholds> = {
  pr1614: [42, 127, 212],
  master: [45, 70, 140],
};

export function getQuantThresholds(p: QuantPreset): QuantThresholds {
  return THRESHOLDS[p];
}

export function quantize(v: number, t: QuantThresholds): 0 | 1 | 2 | 3 {
  if (v < t[0]) return 0;
  if (v < t[1]) return 1;
  if (v < t[2]) return 2;
  return 3;
}

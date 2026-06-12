export const GRAY_DISP = [0, 85, 170, 255] as const;

export type QuantPreset = 'pr1614' | 'master';

export type QuantThresholds = readonly [number, number, number];

export const DEFAULT_QUANT_PRESET: QuantPreset = 'master';

export const QUANT_PRESET_LABELS: Record<QuantPreset, string> = {
  pr1614: 'PR1614',
  master: 'crosspoint master (default)',
};

// Per-preset quantization profile.
// - `thresholds`: hard quantize with dither off — mirrors firmware BitmapHelpers.cpp:quantizeSimple.
// - `ditherThresholds`/`ditherLevels`: error-diffusion bin selection and reconstruction values.
//   For `master` these mirror the firmware's Atkinson/Floyd-Steinberg "fine-tuned to X4 eink
//   display" branch (BitmapHelpers.h): the panel's four states perceive as ≈15/30/80/210, far
//   darker than the nominal 0/85/170/255 — diffusing error against the real values is what
//   brightens the pattern so it reads correctly on the physical panel.
export type QuantLevels = readonly [number, number, number, number];

export type QuantProfile = {
  thresholds: QuantThresholds;
  ditherThresholds: QuantThresholds;
  ditherLevels: QuantLevels;
};

const PROFILES: Record<QuantPreset, QuantProfile> = {
  pr1614: { thresholds: [42, 127, 212], ditherThresholds: [42, 127, 212], ditherLevels: GRAY_DISP },
  master: { thresholds: [45, 70, 140], ditherThresholds: [30, 50, 140], ditherLevels: [15, 30, 80, 210] },
};

export function getQuantProfile(p: QuantPreset): QuantProfile {
  return PROFILES[p];
}

export function getQuantThresholds(p: QuantPreset): QuantThresholds {
  return PROFILES[p].thresholds;
}

// Threshold triple the conversion actually bins with: error diffusion (and, approximately, the
// ordered modes) selects bins via ditherThresholds; with dithering off, quantize() uses the hard
// triple. The histogram zones/markers must match whichever path is active.
export function getActiveQuantThresholds(p: QuantPreset, ditherEnabled: boolean): QuantThresholds {
  const profile = PROFILES[p];
  return ditherEnabled ? profile.ditherThresholds : profile.thresholds;
}

export function quantize(v: number, t: QuantThresholds): 0 | 1 | 2 | 3 {
  if (v < t[0]) return 0;
  if (v < t[1]) return 1;
  if (v < t[2]) return 2;
  return 3;
}

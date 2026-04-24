export type DeviceKey = 'x3' | 'x4';

export type DeviceSpec = {
  w: number;
  h: number;
};

export const DEVICES: Record<DeviceKey, DeviceSpec> = {
  x3: { w: 528, h: 792 },
  x4: { w: 480, h: 800 },
};

export const DEFAULT_XT: DeviceKey = 'x4';

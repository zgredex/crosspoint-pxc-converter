import { describe, expect, it } from 'vitest';

import { DEFAULT_XT, DEVICES } from '../../src/domain/devices';

describe('devices', () => {
  it('exports the supported device table', () => {
    expect(DEFAULT_XT).toBe('x4');
    expect(DEVICES.x3).toEqual({ w: 528, h: 792 });
    expect(DEVICES.x4).toEqual({ w: 480, h: 800 });
  });
});

import { describe, expect, it } from 'vitest';

import { computeGbDisplayScale, computeMaxGbOutputScale } from '../../src/domain/gb/displayScale';

describe('computeMaxGbOutputScale', () => {
  it('returns floor of the tightest axis for basic case (160×144 on 480×800 → 3)', () => {
    // 480/160=3, 800/144=5 → min=3
    expect(computeMaxGbOutputScale(160, 144, 0, 480, 800)).toBe(3);
  });

  it('swaps axes on 90° rotation', () => {
    // rotated: w=144, h=160 → 480/144=3, 800/160=5 → min=3
    // same result but via swapped dims
    expect(computeMaxGbOutputScale(160, 144, 90, 480, 800)).toBe(3);
  });

  it('swaps axes on 270° rotation', () => {
    // rotated: w=144, h=160 → same as 90°
    expect(computeMaxGbOutputScale(160, 144, 270, 480, 800)).toBe(3);
  });

  it('does not swap axes on 180° rotation', () => {
    // same as 0° — 480/160=3, 800/144=5 → 3
    expect(computeMaxGbOutputScale(160, 144, 180, 480, 800)).toBe(3);
  });

  it('floors at 1 when art exceeds the device', () => {
    // 600×400 art on 480×800 → 480/600=0 floored → max(1, min(0, 2)) = 1
    expect(computeMaxGbOutputScale(600, 400, 0, 480, 800)).toBe(1);
  });

  it('is height-limited when height is the tighter axis (160×400 on 480×800 → 2)', () => {
    // 480/160=3, 800/400=2 → min=2
    expect(computeMaxGbOutputScale(160, 400, 0, 480, 800)).toBe(2);
  });
});

describe('computeGbDisplayScale', () => {
  it('returns zoom directly when zoom > 0', () => {
    expect(computeGbDisplayScale(160, 144, 0, 4)).toBe(4);
  });

  it('returns clamped floor(400/rotatedW) within 1..6 when zoom=0', () => {
    // rotatedW=160 → floor(400/160)=2
    expect(computeGbDisplayScale(160, 144, 0, 0)).toBe(2);
  });

  it('uses rotated width when rotation is 90°', () => {
    // rotated: w=144 → floor(400/144)=2
    expect(computeGbDisplayScale(160, 144, 90, 0)).toBe(2);
  });

  it('clamps to 6 for very small art', () => {
    // w=40 → floor(400/40)=10, clamped to 6
    expect(computeGbDisplayScale(40, 40, 0, 0)).toBe(6);
  });

  it('clamps to 1 for very large art', () => {
    // w=800 → floor(400/800)=0, clamped to 1
    expect(computeGbDisplayScale(800, 600, 0, 0)).toBe(1);
  });
});

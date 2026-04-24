import { describe, expect, it } from 'vitest';

import { buildGbFileInfo, buildGbOutputArtifacts, buildGbSourceView } from '../../src/features/gb/service';

describe('gb feature service', () => {
  it('builds a rotated source view with auto scale', () => {
    const result = buildGbSourceView(new Uint8Array([1, 2, 3, 0]), 2, 2, 90, 0);

    expect(result.width).toBe(2);
    expect(result.height).toBe(2);
    expect(result.displayScale).toBe(6);
    expect(Array.from(result.pixels)).toEqual([3, 1, 0, 2]);
  });

  it('builds centered GB output artifacts', () => {
    const result = buildGbOutputArtifacts({
      pixels: new Uint8Array([3]),
      width: 1,
      height: 1,
      rotation: 0,
      outputScale: 1,
      targetW: 2,
      targetH: 2,
      background: 'white',
      paletteRemap: null,
      invert: false,
      paletteKey: 'dmg',
    });

    expect(Array.from(result.indexedPixels)).toEqual([3, 3, 3, 0]);
    expect(result.pxcBytes.length).toBeGreaterThan(0);
    expect(result.bmpBytes.length).toBeGreaterThan(0);
  });

  it('builds GB file metadata including palette and warning text', () => {
    const info = buildGbFileInfo({
      name: 'printer',
      rawByteLength: 20,
      tilesWide: 20,
      paletteRemap: [0, 1, 2, 3],
    });

    expect(info.name).toBe('printer');
    expect(info.sizeText).toBe('20 B');
    expect(info.tilesText).toBe('1 (20×1)');
    expect(info.dimsText).toBe('160 × 8 px');
    expect(info.warningText).toBe('⚠ 4 trailing bytes ignored');
    expect(info.paletteInfoText).toBe('0xE4 (W→W LG→LG DG→DG B→B)');
  });
});

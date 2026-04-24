import { describe, expect, it } from 'vitest';

import { parsePrinterTxt } from '../../src/domain/gb/parsePrinterTxt';

describe('parsePrinterTxt', () => {
  it('extracts bytes and the printer pallet register mapping', () => {
    const text = [
      '{"command":"PRNT","pallet":228}',
      '0A ff zz 1b',
      '{bad json}',
    ].join('\n');

    const result = parsePrinterTxt(text);

    expect(Array.from(result.bytes)).toEqual([0x0a, 0xff, 0x1b]);
    expect(result.palletShades).toEqual([0, 1, 2, 3]);
  });
});

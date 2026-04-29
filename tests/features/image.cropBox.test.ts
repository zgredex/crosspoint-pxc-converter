import { describe, expect, it } from 'vitest';

import type { ImageRuntime } from '../../src/app/runtime/imageRuntime';
import { applyCropBoxToDom, nudgeCropBoxIntoView } from '../../src/features/image/cropBox';

describe('applyCropBoxToDom', () => {
  it('clamps the crop box to the displayed image bounds and scrolls it into view', () => {
    const runtime: Pick<ImageRuntime, 'dispImgW' | 'dispImgH' | 'boxW' | 'boxH' | 'boxX' | 'boxY'> = {
      dispImgW: 200,
      dispImgH: 150,
      boxW: 80,
      boxH: 60,
      boxX: 170,
      boxY: -15,
    };
    const cropBox = { style: {} } as HTMLDivElement;
    const sourceFrame = {
      scrollLeft: 0,
      scrollTop: 0,
      clientWidth: 100,
      clientHeight: 100,
    } as HTMLDivElement;

    applyCropBoxToDom({ runtime: runtime as ImageRuntime, cropBox, sourceFrame, margin: 10 });

    expect(runtime.boxX).toBe(120);
    expect(runtime.boxY).toBe(0);
    expect(cropBox.style.left).toBe('120px');
    expect(cropBox.style.top).toBe('0px');
    expect(sourceFrame.scrollLeft).toBe(110);
    expect(sourceFrame.scrollTop).toBe(0);
  });

  it('nudges scroll minimally when the crop box leaves view', () => {
    const runtime: Pick<ImageRuntime, 'boxX' | 'boxY' | 'boxW' | 'boxH'> = {
      boxX: 185,
      boxY: 95,
      boxW: 20,
      boxH: 20,
    };
    const sourceFrame = {
      scrollLeft: 100,
      scrollTop: 20,
      clientWidth: 100,
      clientHeight: 80,
    } as HTMLDivElement;

    nudgeCropBoxIntoView({ runtime, sourceFrame, margin: 0 });

    expect(sourceFrame.scrollLeft).toBe(105);
    expect(sourceFrame.scrollTop).toBe(35);
  });

  it('pins oversized crop box to the nearest visible edge on each axis', () => {
    const runtime: Pick<ImageRuntime, 'boxX' | 'boxY' | 'boxW' | 'boxH'> = {
      boxX: 20,
      boxY: 30,
      boxW: 140,
      boxH: 40,
    };
    const sourceFrame = {
      scrollLeft: 30,
      scrollTop: 0,
      clientWidth: 100,
      clientHeight: 60,
    } as HTMLDivElement;

    nudgeCropBoxIntoView({ runtime, sourceFrame, margin: 0 });

    expect(sourceFrame.scrollLeft).toBe(20);
    expect(sourceFrame.scrollTop).toBe(10);
  });

  it('pins oversized crop box to right and bottom edge when they are closer', () => {
    const runtime: Pick<ImageRuntime, 'boxX' | 'boxY' | 'boxW' | 'boxH'> = {
      boxX: 120,
      boxY: 170,
      boxW: 150,
      boxH: 120,
    };
    const sourceFrame = {
      scrollLeft: 200,
      scrollTop: 220,
      clientWidth: 100,
      clientHeight: 80,
    } as HTMLDivElement;

    nudgeCropBoxIntoView({ runtime, sourceFrame, margin: 0 });

    expect(sourceFrame.scrollLeft).toBe(170);
    expect(sourceFrame.scrollTop).toBe(210);
  });
});

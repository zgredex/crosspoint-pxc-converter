import { describe, expect, it } from 'vitest';

import type { ImageRuntime } from '../../src/app/runtime/imageRuntime';
import { applyCropBoxToDom } from '../../src/features/image/cropBox';

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
});

import type { ImageRuntime } from '../../app/runtime/imageRuntime';

type CropBoxGeometry = Pick<ImageRuntime, 'boxX' | 'boxY' | 'boxW' | 'boxH'>;

export function nudgeCropBoxIntoView(params: {
  runtime: CropBoxGeometry;
  sourceFrame: HTMLDivElement;
  margin?: number;
}): void {
  const { runtime, sourceFrame } = params;
  const margin = params.margin ?? 0;

  const visibleLeft = sourceFrame.scrollLeft;
  const visibleTop = sourceFrame.scrollTop;
  const visibleRight = visibleLeft + sourceFrame.clientWidth;
  const visibleBottom = visibleTop + sourceFrame.clientHeight;

  let nextScrollLeft = visibleLeft;
  let nextScrollTop = visibleTop;

  if (runtime.boxW <= sourceFrame.clientWidth) {
    if (runtime.boxX < visibleLeft + margin) nextScrollLeft = runtime.boxX - margin;
    if (runtime.boxX + runtime.boxW > visibleRight - margin) {
      nextScrollLeft = runtime.boxX + runtime.boxW - sourceFrame.clientWidth + margin;
    }
  } else {
    const distToLeft = Math.abs(runtime.boxX - visibleLeft);
    const distToRight = Math.abs((runtime.boxX + runtime.boxW) - visibleRight);
    nextScrollLeft = distToLeft <= distToRight
      ? runtime.boxX - margin
      : runtime.boxX + runtime.boxW - sourceFrame.clientWidth + margin;
  }

  if (runtime.boxH <= sourceFrame.clientHeight) {
    if (runtime.boxY < visibleTop + margin) nextScrollTop = runtime.boxY - margin;
    if (runtime.boxY + runtime.boxH > visibleBottom - margin) {
      nextScrollTop = runtime.boxY + runtime.boxH - sourceFrame.clientHeight + margin;
    }
  } else {
    const distToTop = Math.abs(runtime.boxY - visibleTop);
    const distToBottom = Math.abs((runtime.boxY + runtime.boxH) - visibleBottom);
    nextScrollTop = distToTop <= distToBottom
      ? runtime.boxY - margin
      : runtime.boxY + runtime.boxH - sourceFrame.clientHeight + margin;
  }

  sourceFrame.scrollLeft = Math.max(0, nextScrollLeft);
  sourceFrame.scrollTop = Math.max(0, nextScrollTop);
}

export function applyCropBoxToDom(params: {
  runtime: ImageRuntime;
  cropBox: HTMLDivElement;
  sourceFrame: HTMLDivElement;
  margin?: number;
  scrollIntoView?: boolean;
}): void {
  const { runtime, cropBox, sourceFrame } = params;
  const margin = params.margin ?? 20;

  runtime.boxX = Math.max(0, Math.min(runtime.dispImgW - runtime.boxW, runtime.boxX));
  runtime.boxY = Math.max(0, Math.min(runtime.dispImgH - runtime.boxH, runtime.boxY));

  cropBox.style.left = `${runtime.boxX}px`;
  cropBox.style.top = `${runtime.boxY}px`;
  cropBox.style.width = `${runtime.boxW}px`;
  cropBox.style.height = `${runtime.boxH}px`;

  if (params.scrollIntoView === false) return;

  nudgeCropBoxIntoView({ runtime, sourceFrame, margin });
}

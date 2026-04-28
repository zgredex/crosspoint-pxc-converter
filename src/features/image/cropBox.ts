import type { ImageRuntime } from '../../app/runtime/imageRuntime';

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

  const visibleLeft = sourceFrame.scrollLeft;
  const visibleTop = sourceFrame.scrollTop;
  const visibleRight = visibleLeft + sourceFrame.clientWidth;
  const visibleBottom = visibleTop + sourceFrame.clientHeight;

  let nextScrollLeft = visibleLeft;
  let nextScrollTop = visibleTop;
  if (runtime.boxX < visibleLeft + margin) nextScrollLeft = runtime.boxX - margin;
  if (runtime.boxX + runtime.boxW > visibleRight - margin) {
    nextScrollLeft = runtime.boxX + runtime.boxW - sourceFrame.clientWidth + margin;
  }
  if (runtime.boxY < visibleTop + margin) nextScrollTop = runtime.boxY - margin;
  if (runtime.boxY + runtime.boxH > visibleBottom - margin) {
    nextScrollTop = runtime.boxY + runtime.boxH - sourceFrame.clientHeight + margin;
  }

  sourceFrame.scrollLeft = Math.max(0, nextScrollLeft);
  sourceFrame.scrollTop = Math.max(0, nextScrollTop);
}

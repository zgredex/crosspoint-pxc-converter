type BoxState = {
  dispImgW: number;
  dispImgH: number;
  boxW: number;
  boxH: number;
  boxX: number;
  boxY: number;
};

type CropInteractionDeps = {
  cropBox: HTMLDivElement;
  sourceCanvas: HTMLCanvasElement;
  sourceFrame: HTMLDivElement;
  snapGuideH: HTMLDivElement;
  snapGuideV: HTMLDivElement;
  snapThreshold: number;
  wheelZoomK: number;
  isImageLoaded: () => boolean;
  getEditorZoom: () => number;
  applyEditorZoom: (targetZoom: number, anchorClientX?: number, anchorClientY?: number) => void;
  getMode: () => 'crop' | 'fit';
  getBoxState: () => BoxState;
  setBoxPosition: (x: number, y: number) => void;
  applyCropBox: (scrollIntoView?: boolean) => void;
  nudgeCropBoxIntoView: (margin?: number) => void;
  scheduleConvert: () => void;
};

export function setupCropInteraction(deps: CropInteractionDeps): { clearSnap: () => void } {
  let isDragging = false;
  let didDrag = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartBX = 0;
  let dragStartBY = 0;
  let dragStartScrollLeft = 0;
  let dragStartScrollTop = 0;

  function clearSnap(): void {
    deps.snapGuideH.classList.remove('active');
    deps.snapGuideV.classList.remove('active');
    deps.cropBox.classList.remove('snapped');
    deps.snapGuideH.style.top = '';
    deps.snapGuideH.style.width = '';
    deps.snapGuideV.style.left = '';
    deps.snapGuideV.style.height = '';
  }

  function clientXY(event: MouseEvent | TouchEvent): { x: number; y: number } {
    return 'touches' in event
      ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
      : { x: event.clientX, y: event.clientY };
  }

  function onDragKeydown(event: KeyboardEvent): void {
    if (!isDragging) return;
    if (event.code !== 'Space' && event.key !== ' ' && event.key !== 'Spacebar') return;
    event.preventDefault();
  }

  function onDragStart(event: MouseEvent | TouchEvent): void {
    if (isDragging) return;
    if (deps.getMode() !== 'crop') return;
    event.preventDefault();
    isDragging = true;
    didDrag = false;

    const point = clientXY(event);
    const { boxX, boxY } = deps.getBoxState();
    dragStartX = point.x;
    dragStartY = point.y;
    dragStartBX = boxX;
    dragStartBY = boxY;
    dragStartScrollLeft = deps.sourceFrame.scrollLeft;
    dragStartScrollTop = deps.sourceFrame.scrollTop;

    window.addEventListener('keydown', onDragKeydown, { capture: true });
  }

  function onDragMove(event: MouseEvent | TouchEvent): void {
    if (!isDragging) return;
    event.preventDefault();
    didDrag = true;

    const point = clientXY(event);
    const { dispImgW, dispImgH, boxW, boxH } = deps.getBoxState();
    const scrollDx = deps.sourceFrame.scrollLeft - dragStartScrollLeft;
    const scrollDy = deps.sourceFrame.scrollTop - dragStartScrollTop;
    const rawX = dragStartBX + (point.x - dragStartX) + scrollDx;
    const rawY = dragStartBY + (point.y - dragStartY) + scrollDy;
    const centerX = (dispImgW - boxW) / 2;
    const centerY = (dispImgH - boxH) / 2;
    const snapH = Math.abs(rawX - centerX) < deps.snapThreshold;
    const snapV = Math.abs(rawY - centerY) < deps.snapThreshold;

    deps.setBoxPosition(snapH ? centerX : rawX, snapV ? centerY : rawY);
    deps.applyCropBox(false);
    deps.nudgeCropBoxIntoView(0);
    deps.snapGuideH.style.top = `${dispImgH / 2}px`;
    deps.snapGuideH.style.width = `${dispImgW}px`;
    deps.snapGuideV.style.left = `${dispImgW / 2}px`;
    deps.snapGuideV.style.height = `${dispImgH}px`;
    deps.snapGuideV.classList.toggle('active', snapH);
    deps.snapGuideH.classList.toggle('active', snapV);
    deps.cropBox.classList.toggle('snapped', snapH || snapV);
    deps.scheduleConvert();
  }

  function onDragEnd(): void {
    if (!isDragging) return;
    isDragging = false;
    window.removeEventListener('keydown', onDragKeydown, { capture: true });
    window.setTimeout(clearSnap, 600);
    deps.scheduleConvert();
  }

  deps.sourceFrame.addEventListener('wheel', event => {
    if (!deps.isImageLoaded()) return;
    event.preventDefault();
    const factor = Math.exp(-event.deltaY * deps.wheelZoomK);
    deps.applyEditorZoom(deps.getEditorZoom() * factor, event.clientX, event.clientY);
  }, { passive: false });

  deps.cropBox.addEventListener('mousedown', onDragStart);
  deps.cropBox.addEventListener('touchstart', onDragStart, { passive: false });
  window.addEventListener('mousemove', onDragMove);
  window.addEventListener('touchmove', onDragMove, { passive: false });
  window.addEventListener('mouseup', onDragEnd);
  window.addEventListener('touchend', onDragEnd);
  window.addEventListener('touchcancel', onDragEnd);

  deps.sourceCanvas.addEventListener('click', event => {
    if (deps.getMode() !== 'crop') return;
    if (didDrag) {
      didDrag = false;
      return;
    }

    const { boxW, boxH } = deps.getBoxState();
    const rect = deps.sourceCanvas.getBoundingClientRect();
    deps.setBoxPosition((event.clientX - rect.left) - boxW / 2, (event.clientY - rect.top) - boxH / 2);
    deps.applyCropBox();
    deps.scheduleConvert();
  });

  return { clearSnap };
}

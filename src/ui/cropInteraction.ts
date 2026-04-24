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
  snapGuideH: HTMLDivElement;
  snapGuideV: HTMLDivElement;
  snapThreshold: number;
  getMode: () => 'crop' | 'fit';
  getBoxState: () => BoxState;
  setBoxPosition: (x: number, y: number) => void;
  applyCropBox: () => void;
  scheduleConvert: (delay: number) => void;
};

export function setupCropInteraction(deps: CropInteractionDeps): { clearSnap: () => void } {
  let isDragging = false;
  let didDrag = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartBX = 0;
  let dragStartBY = 0;

  function clearSnap(): void {
    deps.snapGuideH.classList.remove('active');
    deps.snapGuideV.classList.remove('active');
    deps.cropBox.classList.remove('snapped');
  }

  function clientXY(event: MouseEvent | TouchEvent): { x: number; y: number } {
    return 'touches' in event
      ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
      : { x: event.clientX, y: event.clientY };
  }

  function onDragStart(event: MouseEvent | TouchEvent): void {
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
  }

  function onDragMove(event: MouseEvent | TouchEvent): void {
    if (!isDragging) return;
    event.preventDefault();
    didDrag = true;

    const point = clientXY(event);
    const { dispImgW, dispImgH, boxW, boxH } = deps.getBoxState();
    const rawX = dragStartBX + (point.x - dragStartX);
    const rawY = dragStartBY + (point.y - dragStartY);
    const centerX = (dispImgW - boxW) / 2;
    const centerY = (dispImgH - boxH) / 2;
    const snapH = Math.abs(rawX - centerX) < deps.snapThreshold;
    const snapV = Math.abs(rawY - centerY) < deps.snapThreshold;

    deps.setBoxPosition(snapH ? centerX : rawX, snapV ? centerY : rawY);
    deps.applyCropBox();
    deps.snapGuideV.classList.toggle('active', snapH);
    deps.snapGuideH.classList.toggle('active', snapV);
    deps.cropBox.classList.toggle('snapped', snapH || snapV);
    deps.scheduleConvert(100);
  }

  function onDragEnd(): void {
    if (!isDragging) return;
    isDragging = false;
    window.setTimeout(clearSnap, 600);
    deps.scheduleConvert(0);
  }

  deps.cropBox.addEventListener('mousedown', onDragStart);
  deps.cropBox.addEventListener('touchstart', onDragStart, { passive: false });
  window.addEventListener('mousemove', onDragMove);
  window.addEventListener('touchmove', onDragMove, { passive: false });
  window.addEventListener('mouseup', onDragEnd);
  window.addEventListener('touchend', onDragEnd);

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
    deps.scheduleConvert(100);
  });

  return { clearSnap };
}

import { hasOutput, type OutputRuntime } from '../app/runtime/outputRuntime';
import type { AppStore } from '../app/store';
import { getContext2d } from '../infra/canvas/context';

type PreviewZoomDeps = {
  store: AppStore;
  output: OutputRuntime;
  previewCanvas: HTMLCanvasElement;
  zoomBox: HTMLDivElement;
  zoomCanvas: HTMLCanvasElement;
};

const ZOOM_BOX_SIZE = 260;
const ZOOM_SOURCE_SIZE = 72;

export function setupPreviewZoom(deps: PreviewZoomDeps): void {
  deps.previewCanvas.addEventListener('mouseenter', () => {
    if (hasOutput(deps.output)) deps.zoomBox.style.display = 'block';
  });

  deps.previewCanvas.addEventListener('mouseleave', () => {
    deps.zoomBox.style.display = 'none';
  });

  deps.previewCanvas.addEventListener('mousemove', event => {
    if (!hasOutput(deps.output)) return;

    const { targetW: width, targetH: height } = deps.store.getState().device;
    const rect = deps.previewCanvas.getBoundingClientRect();
    const centerX = Math.round((event.clientX - rect.left) / rect.width * width);
    const centerY = Math.round((event.clientY - rect.top) / rect.height * height);

    const half = ZOOM_SOURCE_SIZE / 2;
    const sourceX = Math.max(0, Math.min(width - ZOOM_SOURCE_SIZE, centerX - half));
    const sourceY = Math.max(0, Math.min(height - ZOOM_SOURCE_SIZE, centerY - half));

    const context = getContext2d(deps.zoomCanvas);
    context.imageSmoothingEnabled = false;
    context.drawImage(
        deps.previewCanvas,
        sourceX,
        sourceY,
        ZOOM_SOURCE_SIZE,
        ZOOM_SOURCE_SIZE,
        0,
        0,
        ZOOM_BOX_SIZE,
        ZOOM_BOX_SIZE,
      );

    let boxX = event.clientX - ZOOM_BOX_SIZE - 20;
    let boxY = event.clientY - ZOOM_BOX_SIZE / 2;
    if (boxX < 8) boxX = event.clientX + 20;
    boxY = Math.max(8, Math.min(window.innerHeight - ZOOM_BOX_SIZE - 8, boxY));

    deps.zoomBox.style.left = `${boxX}px`;
    deps.zoomBox.style.top = `${boxY}px`;
  });
}

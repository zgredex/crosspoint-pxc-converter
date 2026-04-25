import type { AppDom } from './dom';

type ZoomControlsDeps = {
  dom: AppDom;
  getLoadedType: () => 'image' | 'gb' | null;
  getEditorZoom: () => number;
  zoomSteps: number[];
  getGbRenderedScale: () => number;
  onImageZoom: (zoom: number) => void;
  onGbZoom: (zoom: number) => void;
};

export function bindZoomControls(deps: ZoomControlsDeps): void {
  deps.dom.zoomInBtn.addEventListener('click', () => {
    if (deps.getLoadedType() === 'gb') {
      deps.onGbZoom(Math.min(6, deps.getGbRenderedScale() + 1));
      return;
    }

    const idx = deps.zoomSteps.indexOf(deps.getEditorZoom());
    if (idx < deps.zoomSteps.length - 1) deps.onImageZoom(deps.zoomSteps[idx + 1]);
  });

  deps.dom.zoomOutBtn.addEventListener('click', () => {
    if (deps.getLoadedType() === 'gb') {
      deps.onGbZoom(Math.max(1, deps.getGbRenderedScale() - 1));
      return;
    }

    const idx = deps.zoomSteps.indexOf(deps.getEditorZoom());
    if (idx > 0) deps.onImageZoom(deps.zoomSteps[idx - 1]);
  });
}

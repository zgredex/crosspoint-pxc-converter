import type { AppDom } from './dom';

type ZoomControlsDeps = {
  dom: AppDom;
  onZoomChange: (zoom: number) => void;
};

export function bindZoomControls(deps: ZoomControlsDeps): void {
  deps.dom.zoomSlider.addEventListener('input', () => {
    const zoom = parseFloat(deps.dom.zoomSlider.value);
    if (!Number.isFinite(zoom)) return;
    deps.onZoomChange(zoom);
  });
}

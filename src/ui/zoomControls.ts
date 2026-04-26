import type { AppDom } from './dom';

type ZoomControlsDeps = {
  dom: AppDom;
  onZoom: (direction: 'in' | 'out') => void;
};

export function bindZoomControls(deps: ZoomControlsDeps): void {
  deps.dom.zoomInBtn.addEventListener('click', () => deps.onZoom('in'));
  deps.dom.zoomOutBtn.addEventListener('click', () => deps.onZoom('out'));
}

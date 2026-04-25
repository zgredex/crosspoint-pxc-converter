import type { AppDom } from './dom';

type GbControlsDeps = {
  dom: AppDom;
  onScaleUp: () => void;
  onScaleDown: () => void;
};

export function bindGbScaleControls(deps: GbControlsDeps): void {
  deps.dom.gbScaleUpBtn.addEventListener('click', deps.onScaleUp);
  deps.dom.gbScaleDownBtn.addEventListener('click', deps.onScaleDown);
}

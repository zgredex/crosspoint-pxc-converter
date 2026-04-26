import type { AppDom } from './dom';

type RotationControlsDeps = {
  dom: AppDom;
  onRotate: (direction: 'cw' | 'ccw') => void;
};

export function bindRotationControls(deps: RotationControlsDeps): void {
  deps.dom.rotateCWBtn.addEventListener('click', () => deps.onRotate('cw'));
  deps.dom.rotateCCWBtn.addEventListener('click', () => deps.onRotate('ccw'));
}

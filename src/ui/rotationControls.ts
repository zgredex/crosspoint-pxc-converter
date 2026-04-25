import type { Rotation } from '../app/state';
import type { AppDom } from './dom';

type RotationControlsDeps = {
  dom: AppDom;
  getLoadedType: () => 'image' | 'gb' | null;
  getImageRotation: () => Rotation;
  getGbRotation: () => Rotation;
  onRotateImage: (rotation: Rotation) => void;
  onRotateGb: (rotation: Rotation) => void;
};

export function bindRotationControls(deps: RotationControlsDeps): void {
  deps.dom.rotateCWBtn.addEventListener('click', () => {
    if (deps.getLoadedType() === 'gb') {
      deps.onRotateGb(((deps.getGbRotation() + 90) % 360) as Rotation);
      return;
    }
    deps.onRotateImage(((deps.getImageRotation() + 90) % 360) as Rotation);
  });

  deps.dom.rotateCCWBtn.addEventListener('click', () => {
    if (deps.getLoadedType() === 'gb') {
      deps.onRotateGb(((deps.getGbRotation() + 270) % 360) as Rotation);
      return;
    }
    deps.onRotateImage(((deps.getImageRotation() + 270) % 360) as Rotation);
  });
}

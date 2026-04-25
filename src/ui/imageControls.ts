import type { AppDom } from './dom';

type ImageControlsDeps = {
  dom: AppDom;
  getLoadedType: () => 'image' | 'gb' | null;
  onUnloadImage: () => void;
  onUnloadGb: () => void;
  onToggleMirrorH: () => void;
  onToggleMirrorV: () => void;
};

export function bindImageControls(deps: ImageControlsDeps): void {
  deps.dom.changeBtn.addEventListener('click', () => {
    if (deps.getLoadedType() === 'gb') deps.onUnloadGb();
    else deps.onUnloadImage();
  });

  deps.dom.mirrorHBtn.addEventListener('click', deps.onToggleMirrorH);
  deps.dom.mirrorVBtn.addEventListener('click', deps.onToggleMirrorV);
}

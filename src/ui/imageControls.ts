import type { AppDom } from './dom';

type ImageControlsDeps = {
  dom: AppDom;
  onUnloadActive: () => void;
  onToggleMirrorH: () => void;
  onToggleMirrorV: () => void;
};

export function bindImageControls(deps: ImageControlsDeps): void {
  deps.dom.changeBtn.addEventListener('click', deps.onUnloadActive);

  deps.dom.mirrorHBtn.addEventListener('click', deps.onToggleMirrorH);
  deps.dom.mirrorVBtn.addEventListener('click', deps.onToggleMirrorV);
}

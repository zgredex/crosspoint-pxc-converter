import type { AppDom } from './dom';

type DownloadButtonDeps = {
  dom: AppDom;
  onDownloadPxc: () => void;
  onDownloadBmp: () => void;
};

export function bindDownloadButtons(deps: DownloadButtonDeps): void {
  deps.dom.downloadPxcBtn.addEventListener('click', deps.onDownloadPxc);
  deps.dom.downloadBmpBtn.addEventListener('click', deps.onDownloadBmp);
}

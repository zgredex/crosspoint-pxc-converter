import { getPastedImageFile, getPastedText } from '../infra/browser/clipboard';
import type { AppDom } from './dom';

type FileInputDeps = {
  dom: AppDom;
  loadFile: (file: File) => Promise<void>;
  loadPrinterText: (text: string) => Promise<void>;
};

export function bindFileInput(deps: FileInputDeps): void {
  const { dom, loadFile, loadPrinterText } = deps;

  dom.dropZone.addEventListener('dragover', event => {
    event.preventDefault();
    dom.dropZone.classList.add('over');
  });
  dom.dropZone.addEventListener('dragleave', () => {
    dom.dropZone.classList.remove('over');
  });
  dom.dropZone.addEventListener('drop', event => {
    event.preventDefault();
    dom.dropZone.classList.remove('over');
    const file = event.dataTransfer?.files[0];
    if (file) void loadFile(file);
  });
  dom.fileInput.addEventListener('change', () => {
    const file = dom.fileInput.files?.[0];
    if (file) void loadFile(file);
  });

  // Without a document-level guard, dropping a file outside the drop zone (which is hidden
  // whenever something is loaded) navigates the tab to the file, destroying the session.
  // The drop-zone handlers run first and call preventDefault, so `defaultPrevented` marks
  // drops already consumed there.
  document.addEventListener('dragover', event => {
    event.preventDefault();
  });
  document.addEventListener('drop', event => {
    if (event.defaultPrevented) return;
    event.preventDefault();
    const file = event.dataTransfer?.files[0];
    if (file) void loadFile(file);
  });

  document.addEventListener('paste', event => {
    const file = getPastedImageFile(event);
    if (file) {
      event.preventDefault();
      void loadFile(file);
      return;
    }

    const text = getPastedText(event);
    if (text) {
      event.preventDefault();
      void loadPrinterText(text);
    }
  });
}

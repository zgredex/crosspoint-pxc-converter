import { readFileAsText } from '../infra/browser/imageLoader';
import type { LoadedType } from './state';
import type { GbController } from '../features/gb/controller';
import type { ImageController } from '../features/image/controller';

type LoaderRouterDeps = {
  imageController: ImageController;
  gbController: GbController;
  getLoadedType: () => LoadedType;
};

export function createLoaderRouter(deps: LoaderRouterDeps) {
  // Each controller's load path only unloads its *own* previous session. Without tearing down
  // the other feature first, a still-live image session keeps its worker in flight and the late
  // result repaints the preview over the freshly built GB output (and a stale GB runtime would
  // linger under a new image session).
  function unloadOpposite(target: 'image' | 'gb'): void {
    const loaded = deps.getLoadedType();
    if (target === 'gb' && loaded === 'image') deps.imageController.unloadImage();
    if (target === 'image' && loaded === 'gb') deps.gbController.unloadGb();
  }

  async function loadPrinterText(text: string, outputBaseName?: string): Promise<void> {
    unloadOpposite('gb');
    await deps.gbController.loadPrinterText(text, outputBaseName);
  }

  return {
    loadPrinterText,
    async loadFile(file: File): Promise<void> {
      const extension = /\.([^.]+)$/i.exec(file.name)?.[1]?.toLowerCase();

      switch (extension) {
        case 'txt':
          await loadPrinterText(await readFileAsText(file), file.name.replace(/\.[^.]+$/, ''));
          return;
        case '2bpp':
        case 'bin':
        case 'gb':
          unloadOpposite('gb');
          await deps.gbController.loadBinaryFile(file);
          return;
        default:
          unloadOpposite('image');
          await deps.imageController.loadImageFile(file);
      }
    },
  };
}

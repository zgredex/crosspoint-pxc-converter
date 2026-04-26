import { readFileAsText } from '../infra/browser/imageLoader';
import type { GbController } from '../features/gb/controller';
import type { ImageController } from '../features/image/controller';

type LoaderRouterDeps = {
  imageController: ImageController;
  gbController: GbController;
};

export function createLoaderRouter(deps: LoaderRouterDeps) {
  return {
    async loadFile(file: File): Promise<void> {
      const extension = /\.([^.]+)$/i.exec(file.name)?.[1]?.toLowerCase();

      switch (extension) {
        case 'txt':
          await deps.gbController.loadPrinterText(await readFileAsText(file), file.name.replace(/\.[^.]+$/, ''));
          return;
        case '2bpp':
        case 'bin':
        case 'gb':
          await deps.gbController.loadBinaryFile(file);
          return;
        default:
          await deps.imageController.loadImageFile(file);
      }
    },
  };
}

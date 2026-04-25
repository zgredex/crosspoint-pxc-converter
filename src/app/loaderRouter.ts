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
      const name = file.name.toLowerCase();
      const isGb = /\.(2bpp|bin|gb|txt)$/i.test(name);

      if (isGb) {
        if (/\.txt$/i.test(name)) {
          await deps.gbController.loadPrinterText(await readFileAsText(file), file.name.replace(/\.[^.]+$/, ''));
          return;
        }

        await deps.gbController.loadBinaryFile(file);
        return;
      }

      await deps.imageController.loadImageFile(file);
    },
  };
}

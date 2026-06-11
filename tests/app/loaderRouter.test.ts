import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/infra/browser/imageLoader', () => ({
  readFileAsText: vi.fn(async () => 'AA BB'),
}));

import { createLoaderRouter } from '../../src/app/loaderRouter';
import type { LoadedType } from '../../src/app/state';

function createRouter(loadedType: LoadedType) {
  const imageController = {
    loadImageFile: vi.fn(async () => {}),
    unloadImage: vi.fn(),
  };
  const gbController = {
    loadBinaryFile: vi.fn(async () => {}),
    loadPrinterText: vi.fn(async () => {}),
    unloadGb: vi.fn(),
  };
  const router = createLoaderRouter({
    imageController: imageController as never,
    gbController: gbController as never,
    getLoadedType: () => loadedType,
  });
  return { router, imageController, gbController };
}

describe('loaderRouter', () => {
  it('routes by extension', async () => {
    const { router, imageController, gbController } = createRouter(null);

    await router.loadFile(new File([], 'photo.png'));
    expect(imageController.loadImageFile).toHaveBeenCalledOnce();

    await router.loadFile(new File([], 'tiles.2bpp'));
    await router.loadFile(new File([], 'dump.bin'));
    await router.loadFile(new File([], 'game.gb'));
    expect(gbController.loadBinaryFile).toHaveBeenCalledTimes(3);

    await router.loadFile(new File([], 'log.txt'));
    expect(gbController.loadPrinterText).toHaveBeenCalledWith('AA BB', 'log');
  });

  it('unloads a live image session before a GB load so its in-flight worker result is dropped', async () => {
    const { router, imageController } = createRouter('image');

    await router.loadFile(new File([], 'game.gb'));
    expect(imageController.unloadImage).toHaveBeenCalledOnce();

    await router.loadPrinterText('AA BB');
    expect(imageController.unloadImage).toHaveBeenCalledTimes(2);
  });

  it('unloads a live GB session before an image load', async () => {
    const { router, gbController } = createRouter('gb');

    await router.loadFile(new File([], 'photo.png'));
    expect(gbController.unloadGb).toHaveBeenCalledOnce();
  });

  it('does not cross-unload when nothing is loaded', async () => {
    const { router, imageController, gbController } = createRouter(null);

    await router.loadFile(new File([], 'photo.png'));
    await router.loadFile(new File([], 'game.gb'));

    expect(imageController.unloadImage).not.toHaveBeenCalled();
    expect(gbController.unloadGb).not.toHaveBeenCalled();
  });
});

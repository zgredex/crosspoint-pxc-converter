import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/infra/browser/downloads', () => ({
  triggerDownload: vi.fn(),
}));

import { createAppController } from '../../src/app/appController';
import { triggerDownload } from '../../src/infra/browser/downloads';
import { initialAppState } from '../../src/app/state';
import type { AppStore } from '../../src/app/store';

function createMockStore(state = initialAppState): AppStore {
  return {
    getState: () => state,
    dispatch: vi.fn(),
    subscribe: vi.fn(() => () => {}),
  };
}

function createController(state = initialAppState) {
  const store = createMockStore(state);
  const imageController = {
    resetEditor: vi.fn(),
    requestConvert: vi.fn(),
    setRotation: vi.fn(),
    setZoom: vi.fn(),
    unloadImage: vi.fn(),
  };
  const gbController = {
    buildOutput: vi.fn(),
    refreshVisuals: vi.fn(),
    setRotation: vi.fn(),
    setZoom: vi.fn(),
    unloadGb: vi.fn(),
  };
  const output = {
    pxcBytes: null as Uint8Array | null,
    bmpBytes: null as Uint8Array | null,
    outputBaseName: 'sleep',
  };
  const syncUi = vi.fn();

  const controller = createAppController({
    store,
    dom: {
      workCanvas: { width: 0, height: 0 },
      previewCanvas: { width: 0, height: 0 },
    } as never,
    imageRuntime: { loadedImg: null } as never,
    gbRuntime: { pixels: null, renderedScale: 2 } as never,
    output,
    imageController: imageController as never,
    gbController: gbController as never,
    syncUi,
  });

  return { controller, imageController, gbController, output, syncUi };
}

describe('appController', () => {
  it('routes unloadActive to the GB controller when GB is loaded', () => {
    const { controller, imageController, gbController } = createController({
      ...initialAppState,
      loadedType: 'gb',
    });

    controller.unloadActive();

    expect(gbController.unloadGb).toHaveBeenCalledOnce();
    expect(imageController.unloadImage).not.toHaveBeenCalled();
  });

  it('resizes canvases and resets the image editor on device changes', () => {
    const { controller, imageController, gbController } = createController({
      ...initialAppState,
      device: { key: 'x3', targetW: 528, targetH: 792, totalPixels: 528 * 792 },
    });
    const imageRuntime = { loadedImg: {} as HTMLImageElement } as never;

    const instance = createAppController({
      store: createMockStore({
        ...initialAppState,
        loadedType: 'image',
        device: { key: 'x3', targetW: 528, targetH: 792, totalPixels: 528 * 792 },
      }),
      dom: {
        workCanvas: { width: 0, height: 0 },
        previewCanvas: { width: 0, height: 0 },
      } as never,
      imageRuntime,
      gbRuntime: { pixels: null, renderedScale: 2 } as never,
      output: { pxcBytes: null, bmpBytes: null, outputBaseName: 'sleep' },
      imageController: imageController as never,
      gbController: gbController as never,
      syncUi: vi.fn(),
    });

    instance.handleDeviceChange();

    expect(imageController.resetEditor).toHaveBeenCalledOnce();
    expect(gbController.buildOutput).not.toHaveBeenCalled();
  });

  it('rebuilds GB output on device changes when GB pixels are loaded', () => {
    const gbController = {
      buildOutput: vi.fn(),
      refreshVisuals: vi.fn(),
      setRotation: vi.fn(),
      setZoom: vi.fn(),
      unloadGb: vi.fn(),
    };

    const controller = createAppController({
      store: createMockStore({
        ...initialAppState,
        loadedType: 'gb',
      }),
      dom: {
        workCanvas: { width: 0, height: 0 },
        previewCanvas: { width: 0, height: 0 },
      } as never,
      imageRuntime: { loadedImg: null } as never,
      gbRuntime: { pixels: new Uint8Array([1]), renderedScale: 2 } as never,
      output: { pxcBytes: null, bmpBytes: null, outputBaseName: 'sleep' },
      imageController: {
        resetEditor: vi.fn(),
        requestConvert: vi.fn(),
        setRotation: vi.fn(),
        setZoom: vi.fn(),
        unloadImage: vi.fn(),
      } as never,
      gbController: gbController as never,
      syncUi: vi.fn(),
    });

    controller.handleDeviceChange();

    expect(gbController.buildOutput).toHaveBeenCalledOnce();
  });

  it('guards downloads until both output byte buffers exist', () => {
    const { controller, output } = createController();
    const downloadSpy = vi.mocked(triggerDownload);

    controller.downloadPxc();
    controller.downloadBmp();
    expect(downloadSpy).not.toHaveBeenCalled();

    output.pxcBytes = new Uint8Array([1]);
    output.bmpBytes = new Uint8Array([2]);
    output.outputBaseName = 'sample';

    controller.downloadPxc();
    controller.downloadBmp();

    expect(downloadSpy).toHaveBeenNthCalledWith(1, output.pxcBytes, 'sample.pxc', 'application/octet-stream');
    expect(downloadSpy).toHaveBeenNthCalledWith(2, output.bmpBytes, 'sample.bmp', 'image/bmp');
  });
});

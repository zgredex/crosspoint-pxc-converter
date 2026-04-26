import { actions } from './actions';
import type { AppDom } from '../ui/dom';
import { triggerDownload } from '../infra/browser/downloads';
import { clearOutputBytes, hasOutput, type OutputRuntime } from './runtime/outputRuntime';
import type { AppStore } from './store';
import type { GbRuntime } from './runtime/gbRuntime';
import type { ImageRuntime } from './runtime/imageRuntime';
import type { FitBackground } from './state';
import type { DeviceKey } from '../domain/devices';
import type { GbPaletteKey } from '../domain/formats/bmpGb';
import type { GbController } from '../features/gb/controller';
import type { ImageController } from '../features/image/controller';

export type AppController = {
  handleDeviceChange(): void;
  handleImageLayoutChange(): void;
  handleGbVisualChange(): void;
  handleBackgroundChange(): void;
  setDevice(deviceKey: DeviceKey): void;
  setImageMode(mode: 'crop' | 'fit'): void;
  setBackground(background: FitBackground): void;
  setGbPalette(paletteKey: GbPaletteKey): void;
  setGbInvert(invert: boolean): void;
  unloadActive(): void;
  rotateActive(direction: 'cw' | 'ccw'): void;
  zoomActive(direction: 'in' | 'out'): void;
  downloadPxc(): void;
  downloadBmp(): void;
};

type AppControllerDeps = {
  store: AppStore;
  dom: AppDom;
  imageRuntime: ImageRuntime;
  gbRuntime: GbRuntime;
  output: OutputRuntime;
  imageController: ImageController;
  gbController: GbController;
  syncUi: () => void;
};

const IMAGE_ZOOM_STEPS = [0.5, 0.75, 1, 1.5, 2, 3, 4] as const;

export function createAppController(deps: AppControllerDeps): AppController {
  function resizeOutputCanvases(): void {
    const { targetW, targetH } = deps.store.getState().device;
    deps.dom.workCanvas.width = targetW;
    deps.dom.workCanvas.height = targetH;
    deps.dom.previewCanvas.width = targetW;
    deps.dom.previewCanvas.height = targetH;
  }

  function clearOutput(): void {
    clearOutputBytes(deps.output);
    deps.syncUi();
  }

  function handleDeviceChange(): void {
    resizeOutputCanvases();

    const state = deps.store.getState();
    if (deps.imageRuntime.loadedImg) {
      void deps.imageController.resetEditor();
      return;
    }

    if (state.loadedType === 'gb' && deps.gbRuntime.pixels) {
      deps.gbController.buildOutput();
      return;
    }

    clearOutput();
  }

  function handleImageLayoutChange(): void {
    if (deps.imageRuntime.loadedImg) {
      void deps.imageController.resetEditor();
    }
  }

  function handleGbVisualChange(): void {
    if (deps.gbRuntime.pixels) {
      deps.gbController.refreshVisuals();
    }
  }

  function handleBackgroundChange(): void {
    if (deps.gbRuntime.pixels) {
      deps.gbController.refreshVisuals();
      return;
    }

    if (deps.imageRuntime.loadedImg) {
      deps.imageController.requestConvert(0);
    }
  }

  function setDevice(deviceKey: DeviceKey): void {
    deps.store.dispatch(actions.setDevice(deviceKey));
    handleDeviceChange();
  }

  function setImageMode(mode: 'crop' | 'fit'): void {
    deps.store.dispatch(actions.imageSetMode(mode));
    handleImageLayoutChange();
  }

  function setBackground(background: FitBackground): void {
    deps.store.dispatch(actions.setBackground(background));
    handleBackgroundChange();
  }

  function setGbPalette(paletteKey: GbPaletteKey): void {
    deps.store.dispatch(actions.gbSetPalette(paletteKey));
    handleGbVisualChange();
  }

  function setGbInvert(invert: boolean): void {
    deps.store.dispatch(actions.gbSetInvert(invert));
    handleGbVisualChange();
  }

  function unloadActive(): void {
    if (deps.store.getState().loadedType === 'gb') {
      deps.gbController.unloadGb();
      return;
    }

    deps.imageController.unloadImage();
  }

  function rotateActive(direction: 'cw' | 'ccw'): void {
    const state = deps.store.getState();
    const delta = direction === 'cw' ? 90 : 270;

    if (state.loadedType === 'gb') {
      deps.gbController.setRotation(((state.gb.rotation + delta) % 360) as 0 | 90 | 180 | 270);
      return;
    }

    deps.imageController.setRotation(((state.image.rotation + delta) % 360) as 0 | 90 | 180 | 270);
  }

  function zoomActive(direction: 'in' | 'out'): void {
    const state = deps.store.getState();

    if (state.loadedType === 'gb') {
      const nextZoom = direction === 'in'
        ? Math.min(6, deps.gbRuntime.renderedScale + 1)
        : Math.max(1, deps.gbRuntime.renderedScale - 1);
      deps.gbController.setZoom(nextZoom);
      return;
    }

    const currentIndex = IMAGE_ZOOM_STEPS.indexOf(state.image.editorZoom as (typeof IMAGE_ZOOM_STEPS)[number]);
    if (currentIndex === -1) return;

    const nextIndex = direction === 'in' ? currentIndex + 1 : currentIndex - 1;
    if (nextIndex >= 0 && nextIndex < IMAGE_ZOOM_STEPS.length) {
      deps.imageController.setZoom(IMAGE_ZOOM_STEPS[nextIndex]);
    }
  }

  function downloadPxc(): void {
    if (!hasOutput(deps.output)) return;
    triggerDownload(deps.output.pxcBytes, `${deps.output.outputBaseName}.pxc`, 'application/octet-stream');
  }

  function downloadBmp(): void {
    if (!hasOutput(deps.output)) return;
    triggerDownload(deps.output.bmpBytes, `${deps.output.outputBaseName}.bmp`, 'image/bmp');
  }

  return {
    handleDeviceChange,
    handleImageLayoutChange,
    handleGbVisualChange,
    handleBackgroundChange,
    setDevice,
    setImageMode,
    setBackground,
    setGbPalette,
    setGbInvert,
    unloadActive,
    rotateActive,
    zoomActive,
    downloadPxc,
    downloadBmp,
  };
}

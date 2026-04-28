import { actions } from './actions';
import type { AppDom } from '../ui/dom';
import { triggerDownload } from '../infra/browser/downloads';
import { clearOutputBytes, type OutputRuntime } from './runtime/outputRuntime';
import type { AppStore } from './store';
import type { GbRuntime } from './runtime/gbRuntime';
import type { ImageRuntime } from './runtime/imageRuntime';
import type { FitBackground } from './state';
import { encodePxc } from '../domain/formats/pxc';
import { encodeGrayBmp } from '../domain/formats/bmpGray';

import type { DeviceKey } from '../domain/devices';
import type { GbPaletteKey } from '../domain/formats/bmpGb';
import type { GbController } from '../features/gb/controller';
import type { ImageController } from '../features/image/controller';
import { selectGbDisplayScale } from '../features/gb/service';

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
};

const IMAGE_ZOOM_STEP = 1.25;

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
    deps.store.dispatch(actions.outputClear());
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
      deps.imageController.requestConvert();
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
      const currentScale = selectGbDisplayScale(state);
      const nextZoom = direction === 'in'
        ? Math.min(6, currentScale + 1)
        : Math.max(1, currentScale - 1);
      deps.gbController.setZoom(nextZoom);
      return;
    }

    const maxZoom = deps.imageController.getMaxEditorZoom();
    const factor = direction === 'in' ? IMAGE_ZOOM_STEP : 1 / IMAGE_ZOOM_STEP;
    const next = Math.min(Math.max(1, state.image.editorZoom * factor), maxZoom);
    if (Math.abs(next - state.image.editorZoom) < 1e-4) return;
    deps.imageController.applyEditorZoom(next);
  }

  function downloadPxc(): void {
    const state = deps.store.getState();
    if (state.loadedType === 'image') {
      const px = deps.imageRuntime.lastIndexedPixels;
      if (!px) return;
      triggerDownload(encodePxc(px, state.device.targetW, state.device.targetH), `${state.output.baseName}.pxc`, 'application/octet-stream');
      return;
    }
    if (deps.output.pxcBytes) {
      triggerDownload(deps.output.pxcBytes, `${state.output.baseName}.pxc`, 'application/octet-stream');
    }
  }

  function downloadBmp(): void {
    const state = deps.store.getState();
    if (state.loadedType === 'image') {
      const px = deps.imageRuntime.lastIndexedPixels;
      if (!px) return;
      triggerDownload(encodeGrayBmp(px, state.device.targetW, state.device.targetH), `${state.output.baseName}.bmp`, 'image/bmp');
      return;
    }
    if (deps.output.bmpBytes) {
      triggerDownload(deps.output.bmpBytes, `${state.output.baseName}.bmp`, 'image/bmp');
    }
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

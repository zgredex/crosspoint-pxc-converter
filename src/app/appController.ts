import { actions } from './actions';
import { triggerDownload } from '../infra/browser/downloads';
import type { OutputRuntime } from './runtime/outputRuntime';
import type { AppStore } from './store';
import type { GbRuntime } from './runtime/gbRuntime';
import type { ImageRuntime } from './runtime/imageRuntime';
import type { FitBackground, ImageMode } from './state';
import { encodePxc } from '../domain/formats/pxc';
import { encodeGrayBmp } from '../domain/formats/bmpGray';
import { DITHER_FILENAME_SUFFIX } from '../domain/dither';

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
  setImageMode(mode: ImageMode, opts?: { fitLockNative?: boolean }): void;
  setBackground(background: FitBackground): void;
  setGbPalette(paletteKey: GbPaletteKey): void;
  setGbInvert(invert: boolean): void;
  unloadActive(): void;
  rotateActive(direction: 'cw' | 'ccw'): void;
  setActiveZoom(zoom: number): void;
  downloadPxc(): void;
  downloadBmp(): void;
};

type AppControllerDeps = {
  store: AppStore;
  workCanvas: HTMLCanvasElement;
  previewCanvas: HTMLCanvasElement;
  imageRuntime: ImageRuntime;
  gbRuntime: GbRuntime;
  output: OutputRuntime;
  imageController: ImageController;
  gbController: GbController;
};

export function createAppController(deps: AppControllerDeps): AppController {
  function resizeOutputCanvases(): void {
    const { targetW, targetH } = deps.store.getState().device;
    deps.workCanvas.width = targetW;
    deps.workCanvas.height = targetH;
    deps.previewCanvas.width = targetW;
    deps.previewCanvas.height = targetH;
  }

  function handleDeviceChange(): void {
    resizeOutputCanvases();

    const state = deps.store.getState();
    if (deps.imageRuntime.loadedImg) {
      deps.imageController.notifyCropRegionChanged();
      void deps.imageController.resetEditor();
      return;
    }

    if (state.loadedType === 'gb' && deps.gbRuntime.pixels) {
      deps.gbController.buildOutput();
      return;
    }

    // Nothing loaded: output bytes are already null (every unload path runs resetSession);
    // only the store-side ready flags need clearing.
    deps.store.dispatch(actions.outputClear());
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
      deps.imageController.invalidateBaseRaster();
      deps.imageController.requestConvert();
    }
  }

  function setDevice(deviceKey: DeviceKey): void {
    deps.store.dispatch(actions.setDevice(deviceKey));
    handleDeviceChange();
  }

  function setImageMode(mode: ImageMode, opts?: { fitLockNative?: boolean }): void {
    if (deps.imageRuntime.loadedImg) deps.imageController.notifyCropRegionChanged();
    const fitLockNative = mode === 'fit' ? opts?.fitLockNative ?? false : false;
    deps.store.dispatch(actions.imageSetModePreset(mode, fitLockNative));
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

  function setActiveZoom(zoom: number): void {
    const state = deps.store.getState();
    if (!Number.isFinite(zoom)) return;

    if (state.loadedType === 'gb') {
      const nextZoom = Math.round(Math.min(6, Math.max(1, zoom)));
      if (state.gb.zoom === nextZoom) return;
      deps.gbController.setZoom(nextZoom);
      return;
    }

    if (state.loadedType !== 'image') return;

    const maxZoom = deps.imageController.getMaxEditorZoom();
    const next = Math.min(Math.max(1, zoom), maxZoom);
    if (Math.abs(next - state.image.editorZoom) < 1e-4) return;
    deps.imageController.applyEditorZoom(next);
  }

  function downloadActive(
    encoder: (px: Uint8Array, w: number, h: number) => Uint8Array,
    outputField: 'pxcBytes' | 'bmpBytes',
    ext: 'pxc' | 'bmp',
    mime: string,
  ): void {
    const state = deps.store.getState();
    const ditherSuffix =
      state.loadedType === 'image' && state.image.ditherEnabled
        ? `-${DITHER_FILENAME_SUFFIX[state.image.ditherMode]}`
        : '';
    const deviceSuffix = `-${state.device.key.toUpperCase()}`;
    const filename = `${state.output.baseName}${ditherSuffix}${deviceSuffix}.${ext}`;
    if (state.loadedType === 'image') {
      const px = deps.imageRuntime.lastIndexedPixels;
      if (!px) return;
      triggerDownload(encoder(px, state.device.targetW, state.device.targetH), filename, mime);
      return;
    }
    const bytes = deps.output[outputField];
    if (bytes) triggerDownload(bytes, filename, mime);
  }

  function downloadPxc(): void {
    downloadActive(encodePxc, 'pxcBytes', 'pxc', 'application/octet-stream');
  }

  function downloadBmp(): void {
    downloadActive(encodeGrayBmp, 'bmpBytes', 'bmp', 'image/bmp');
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
    setActiveZoom,
    downloadPxc,
    downloadBmp,
  };
}

import { actions } from '../app/actions';
import type { AppController } from '../app/appController';
import type { AppStore } from '../app/store';
import type { DeviceKey } from '../domain/devices';
import type { DitherMode } from '../domain/dither';
import type { GbPaletteKey } from '../domain/formats/bmpGb';
import type { FitAlign } from '../domain/geometry';
import { initialImageState, type FitBackground, type ImageMode } from '../app/state';
import type { AppDom } from './dom';
import { isModePillActive } from './render';

type BindingDeps = {
  store: AppStore;
  appController: Pick<AppController, 'setBackground' | 'setDevice' | 'setGbInvert' | 'setGbPalette' | 'setImageMode'>;
  scheduleConvert: () => void;
  autoLevels: () => void | Promise<void>;
  invalidateBaseRaster: () => void;
};

export function bindStoreControls(dom: AppDom, deps: BindingDeps): void {
  const {
    store,
    appController,
    scheduleConvert,
    autoLevels,
  } = deps;

  dom.invertToggle.addEventListener('change', () => {
    store.dispatch(actions.imageSetInvert(dom.invertToggle.checked));
    scheduleConvert();
  });

  dom.ditherToggle.addEventListener('change', () => {
    store.dispatch(actions.imageSetDitherEnabled(dom.ditherToggle.checked));
    scheduleConvert();
  });

  dom.fitSizeSlider.addEventListener('input', () => {
    store.dispatch(actions.imageSetFitSizePct(parseInt(dom.fitSizeSlider.value)));
    deps.invalidateBaseRaster();
    scheduleConvert();
  });

  dom.fitNoUpscaleToggle.addEventListener('change', () => {
    const noUpscale = dom.fitNoUpscaleToggle.checked;
    store.dispatch(actions.imageSetFitNoUpscale(noUpscale));
    // When the guard turns on, snap the size slider down to the largest value that doesn't
    // upscale, so the displayed slider value matches the effective scale. Without this the
    // slider would read 100% while the actual output is capped at native size — confusing.
    if (noUpscale) {
      const state = store.getState();
      const dims = state.image.sourceDims;
      if (dims) {
        const rotated = state.image.rotation === 90 || state.image.rotation === 270;
        const sW = rotated ? dims.height : dims.width;
        const sH = rotated ? dims.width : dims.height;
        const maxFit = Math.min(state.device.targetW / sW, state.device.targetH / sH);
        if (maxFit > 1) {
          const maxPct = Math.max(10, Math.floor(100 / maxFit));
          if (state.image.fitSizePct > maxPct) {
            store.dispatch(actions.imageSetFitSizePct(maxPct));
          }
        }
      }
    }
    deps.invalidateBaseRaster();
    scheduleConvert();
  });

  dom.contrastSlider.addEventListener('input', () => {
    store.dispatch(actions.imageSetContrast(parseInt(dom.contrastSlider.value)));
    scheduleConvert();
  });

  dom.contrastReset.addEventListener('click', () => {
    if (store.getState().image.contrastValue === initialImageState.contrastValue) return;
    store.dispatch(actions.imageResetContrast());
    scheduleConvert();
  });

  dom.blackSlider.addEventListener('input', () => {
    store.dispatch(actions.imageSetBlackPoint(parseInt(dom.blackSlider.value)));
    scheduleConvert();
  });

  dom.whiteSlider.addEventListener('input', () => {
    store.dispatch(actions.imageSetWhitePoint(parseInt(dom.whiteSlider.value)));
    scheduleConvert();
  });

  dom.toneReset.addEventListener('click', () => {
    const image = store.getState().image;
    if (
      image.blackPoint === initialImageState.blackPoint &&
      image.whitePoint === initialImageState.whitePoint &&
      image.gammaValue === initialImageState.gammaValue &&
      !image.autoLevelsApplied
    ) {
      return;
    }
    store.dispatch(actions.imageResetTone());
    scheduleConvert();
  });

  dom.autoLevelsBtn.addEventListener('click', () => {
    if (store.getState().image.autoLevelsApplied) return;
    void autoLevels();
  });

  dom.gammaSlider.addEventListener('input', () => {
    let nextGammaValue = parseInt(dom.gammaSlider.value) / 100;
    if (nextGammaValue < 0.01) nextGammaValue = 0.01;
    store.dispatch(actions.imageSetGamma(nextGammaValue));
    scheduleConvert();
  });

  for (const button of dom.deviceButtons) {
    button.addEventListener('click', () => {
      const deviceKey = button.dataset.xt;
      if (!deviceKey) return;
      if (store.getState().device.key === deviceKey) return;
      appController.setDevice(deviceKey as DeviceKey);
    });
  }

  for (const button of dom.modeButtons) {
    button.addEventListener('click', () => {
      const datasetMode = button.dataset.mode;
      if (!datasetMode) return;
      if (isModePillActive(datasetMode, store.getState().image)) return;
      const targetMode: ImageMode = datasetMode === 'crop' ? 'crop' : 'fit';
      const targetLockNative = datasetMode === 'one-to-one';
      appController.setImageMode(targetMode, { fitLockNative: targetLockNative });
    });
  }

  for (const button of dom.ditherButtons) {
    button.addEventListener('click', () => {
      const ditherMode = button.dataset.dither;
      if (!ditherMode) return;
      if (store.getState().image.ditherMode === ditherMode) return;
      store.dispatch(actions.imageSetDitherMode(ditherMode as DitherMode));
      scheduleConvert();
    });
  }

  for (const button of dom.posButtons) {
    button.addEventListener('click', () => {
      const fitAlign = button.dataset.pos;
      if (!fitAlign) return;
      if (store.getState().image.fitAlign === fitAlign) return;
      store.dispatch(actions.imageSetFitAlign(fitAlign as FitAlign));
      deps.invalidateBaseRaster();
      scheduleConvert();
    });
  }

  for (const button of dom.bgButtons) {
    button.addEventListener('click', () => {
      const background = button.dataset.bg;
      if (!background) return;
      if (store.getState().background === background) return;
      appController.setBackground(background as FitBackground);
    });
  }

  for (const button of dom.gbPaletteButtons) {
    button.addEventListener('click', () => {
      const paletteKey = button.dataset.gbpalette;
      if (!paletteKey) return;
      if (store.getState().gb.paletteKey === paletteKey) return;
      appController.setGbPalette(paletteKey as GbPaletteKey);
    });
  }

  dom.gbInvertToggle.addEventListener('change', () => {
    appController.setGbInvert(dom.gbInvertToggle.checked);
  });
}

import { actions } from '../app/actions';
import type { AppStore } from '../app/store';
import type { DeviceKey } from '../domain/devices';
import type { DitherMode } from '../domain/dither';
import type { FitAlign } from '../domain/geometry';
import type { GbPaletteKey } from '../domain/formats/bmpGb';
import type { FitBackground } from '../app/state';
import type { AppDom } from './dom';

type BindingDeps = {
  store: AppStore;
  scheduleConvert: (delay: number) => void;
  rebuildGammaLUT: () => void;
  autoLevels: () => void | Promise<void>;
  onDeviceChanged: () => void;
  onImageLayoutChanged: () => void;
  onGbVisualChanged: () => void;
};

export function bindStoreControls(dom: AppDom, deps: BindingDeps): void {
  const {
    store,
    scheduleConvert,
    rebuildGammaLUT,
    autoLevels,
    onDeviceChanged,
    onImageLayoutChanged,
    onGbVisualChanged,
  } = deps;

  dom.invertToggle.addEventListener('change', () => {
    store.dispatch(actions.imageSetInvert(dom.invertToggle.checked));
    scheduleConvert(0);
  });

  dom.ditherToggle.addEventListener('change', () => {
    store.dispatch(actions.imageSetDitherEnabled(dom.ditherToggle.checked));
    scheduleConvert(0);
  });

  dom.contrastSlider.addEventListener('input', () => {
    store.dispatch(actions.imageSetContrast(parseInt(dom.contrastSlider.value)));
    scheduleConvert(50);
  });

  dom.contrastReset.addEventListener('click', () => {
    store.dispatch(actions.imageResetContrast());
    scheduleConvert(0);
  });

  dom.blackSlider.addEventListener('input', () => {
    const state = store.getState();
    let nextBlackPoint = parseInt(dom.blackSlider.value);
    if (nextBlackPoint >= state.image.whitePoint) nextBlackPoint = state.image.whitePoint - 1;
    store.dispatch(actions.imageSetBlackPoint(nextBlackPoint));
    scheduleConvert(50);
  });

  dom.whiteSlider.addEventListener('input', () => {
    const state = store.getState();
    let nextWhitePoint = parseInt(dom.whiteSlider.value);
    if (nextWhitePoint <= state.image.blackPoint) nextWhitePoint = state.image.blackPoint + 1;
    store.dispatch(actions.imageSetWhitePoint(nextWhitePoint));
    scheduleConvert(50);
  });

  dom.toneReset.addEventListener('click', () => {
    store.dispatch(actions.imageResetTone());
    rebuildGammaLUT();
    scheduleConvert(0);
  });

  dom.autoLevelsBtn.addEventListener('click', () => {
    void autoLevels();
  });

  dom.gammaSlider.addEventListener('input', () => {
    let nextGammaValue = parseInt(dom.gammaSlider.value) / 100;
    if (nextGammaValue < 0.01) nextGammaValue = 0.01;
    store.dispatch(actions.imageSetGamma(nextGammaValue));
    rebuildGammaLUT();
    scheduleConvert(50);
  });

  for (const button of dom.deviceButtons) {
    button.addEventListener('click', () => {
      const deviceKey = button.dataset.xt;
      if (!deviceKey) return;
      store.dispatch(actions.setDevice(deviceKey as DeviceKey));
      onDeviceChanged();
    });
  }

  for (const button of dom.modeButtons) {
    button.addEventListener('click', () => {
      const mode = button.dataset.mode;
      if (!mode) return;
      store.dispatch(actions.imageSetMode(mode as 'crop' | 'fit'));
      onImageLayoutChanged();
    });
  }

  for (const button of dom.ditherButtons) {
    button.addEventListener('click', () => {
      const ditherMode = button.dataset.dither;
      if (!ditherMode) return;
      store.dispatch(actions.imageSetDitherMode(ditherMode as DitherMode));
      scheduleConvert(0);
    });
  }

  for (const button of dom.posButtons) {
    button.addEventListener('click', () => {
      const fitAlign = button.dataset.pos;
      if (!fitAlign) return;
      store.dispatch(actions.imageSetFitAlign(fitAlign as FitAlign));
      scheduleConvert(0);
    });
  }

  for (const button of dom.bgButtons) {
    button.addEventListener('click', () => {
      const fitBg = button.dataset.bg;
      if (!fitBg) return;
      store.dispatch(actions.imageSetFitBg(fitBg as FitBackground));
      scheduleConvert(0);
    });
  }

  for (const button of dom.gbPaletteButtons) {
    button.addEventListener('click', () => {
      const paletteKey = button.dataset.gbpalette;
      if (!paletteKey) return;
      store.dispatch(actions.gbSetPalette(paletteKey as GbPaletteKey));
      onGbVisualChanged();
    });
  }

  dom.gbInvertToggle.addEventListener('change', () => {
    store.dispatch(actions.gbSetInvert(dom.gbInvertToggle.checked));
    onGbVisualChanged();
  });
}

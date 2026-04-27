import { actions } from '../app/actions';
import type { AppController } from '../app/appController';
import type { AppStore } from '../app/store';
import type { DeviceKey } from '../domain/devices';
import type { DitherMode } from '../domain/dither';
import type { GbPaletteKey } from '../domain/formats/bmpGb';
import type { FitAlign } from '../domain/geometry';
import type { FitBackground } from '../app/state';
import type { AppDom } from './dom';

type BindingDeps = {
  store: AppStore;
  appController: Pick<AppController, 'setBackground' | 'setDevice' | 'setGbInvert' | 'setGbPalette' | 'setImageMode'>;
  scheduleConvert: () => void;
  autoLevels: () => void | Promise<void>;
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

  dom.contrastSlider.addEventListener('input', () => {
    store.dispatch(actions.imageSetContrast(parseInt(dom.contrastSlider.value)));
    scheduleConvert();
  });

  dom.contrastReset.addEventListener('click', () => {
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
    store.dispatch(actions.imageResetTone());
    scheduleConvert();
  });

  dom.autoLevelsBtn.addEventListener('click', () => {
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
      appController.setDevice(deviceKey as DeviceKey);
    });
  }

  for (const button of dom.modeButtons) {
    button.addEventListener('click', () => {
      const mode = button.dataset.mode;
      if (!mode) return;
      appController.setImageMode(mode as 'crop' | 'fit');
    });
  }

  for (const button of dom.ditherButtons) {
    button.addEventListener('click', () => {
      const ditherMode = button.dataset.dither;
      if (!ditherMode) return;
      store.dispatch(actions.imageSetDitherMode(ditherMode as DitherMode));
      scheduleConvert();
    });
  }

  for (const button of dom.posButtons) {
    button.addEventListener('click', () => {
      const fitAlign = button.dataset.pos;
      if (!fitAlign) return;
      store.dispatch(actions.imageSetFitAlign(fitAlign as FitAlign));
      scheduleConvert();
    });
  }

  for (const button of dom.bgButtons) {
    button.addEventListener('click', () => {
      const background = button.dataset.bg;
      if (!background) return;
      appController.setBackground(background as FitBackground);
    });
  }

  for (const button of dom.gbPaletteButtons) {
    button.addEventListener('click', () => {
      const paletteKey = button.dataset.gbpalette;
      if (!paletteKey) return;
      appController.setGbPalette(paletteKey as GbPaletteKey);
    });
  }

  dom.gbInvertToggle.addEventListener('change', () => {
    appController.setGbInvert(dom.gbInvertToggle.checked);
  });
}

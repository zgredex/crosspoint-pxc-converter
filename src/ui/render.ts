import type { AppState } from '../app/state';
import type { AppDom } from './dom';

function setActive(buttons: HTMLButtonElement[], predicate: (button: HTMLButtonElement) => boolean): void {
  for (const button of buttons) {
    button.classList.toggle('active', predicate(button));
  }
}

export function renderStoreState(dom: AppDom, state: AppState): void {
  dom.statusBanner.hidden = state.ui.message === null;
  dom.statusBanner.textContent = state.ui.message ?? '';
  dom.statusBanner.className = state.ui.tone ? `status-banner ${state.ui.tone}` : 'status-banner';

  dom.dropZone.style.display = state.loadedType === null ? '' : 'none';
  dom.editorSection.classList.toggle('visible', state.loadedType !== null);
  dom.previewCanvas.style.aspectRatio = `${state.device.targetW} / ${state.device.targetH}`;

  setActive(dom.deviceButtons, button => button.dataset.xt === state.device.key);
  setActive(dom.modeButtons, button => button.dataset.mode === state.image.mode);
  setActive(dom.ditherButtons, button => button.dataset.dither === state.image.ditherMode);
  setActive(dom.posButtons, button => button.dataset.pos === state.image.fitAlign);
  setActive(dom.bgButtons, button => button.dataset.bg === state.image.fitBg);
  setActive(dom.gbPaletteButtons, button => button.dataset.gbpalette === state.gb.paletteKey);

  dom.posSection.classList.toggle('disabled', state.image.mode === 'crop');
  dom.mirrorHBtn.classList.toggle('active', state.image.mirrorH);
  dom.mirrorVBtn.classList.toggle('active', state.image.mirrorV);

  dom.invertToggle.checked = state.image.invert;
  dom.ditherToggle.checked = state.image.ditherEnabled;
  dom.ditherAlgos.classList.toggle('disabled', !state.image.ditherEnabled);

  dom.contrastSlider.value = String(state.image.contrastValue);
  dom.contrastValEl.textContent = `${state.image.contrastValue > 0 ? '+' : ''}${state.image.contrastValue}`;
  dom.blackSlider.value = String(state.image.blackPoint);
  dom.blackValEl.textContent = String(state.image.blackPoint);
  dom.whiteSlider.value = String(state.image.whitePoint);
  dom.whiteValEl.textContent = String(state.image.whitePoint);
  dom.gammaSlider.value = String(Math.round(state.image.gammaValue * 100));
  dom.gammaValEl.textContent = state.image.gammaValue.toFixed(2);
  dom.gbScaleVal.textContent = `${state.gb.outputScale}×`;
  dom.gbInvertToggle.checked = state.gb.invert;

  dom.sourceLabel.textContent = state.loadedType === 'gb'
    ? 'GB — native palette'
    : state.image.mode === 'crop'
      ? 'Source — drag or click to reposition'
      : 'Source';
  dom.cropBox.style.display = state.loadedType === 'image' && state.image.mode === 'crop' ? 'block' : 'none';

  if (state.loadedType !== 'gb') {
    dom.rotateValEl.textContent = `${state.image.rotation}°`;
    dom.zoomLabelEl.textContent = `${state.image.editorZoom}×`;
  } else {
    dom.rotateValEl.textContent = `${state.gb.rotation}°`;
  }
}

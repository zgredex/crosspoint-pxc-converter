import type { AppState } from '../app/state';
import type { AppDom } from './dom';

function getPanelSection(element: Element): HTMLElement {
  const section = element.closest('.panel-section');
  if (!(section instanceof HTMLElement)) throw new Error('Expected panel section element');
  return section;
}

function setActive(buttons: HTMLButtonElement[], predicate: (button: HTMLButtonElement) => boolean): void {
  for (const button of buttons) {
    button.classList.toggle('active', predicate(button));
  }
}

export function renderStoreState(dom: AppDom, state: AppState): void {
  const isGbLoaded = state.loadedType === 'gb';
  const outputVisible = state.output.pxcReady && state.output.bmpReady;
  const fileInfo = isGbLoaded ? state.gb.fileInfo : null;

  dom.statusBanner.hidden = state.ui.message === null;
  dom.statusBanner.textContent = state.ui.message ?? '';
  dom.statusBanner.className = state.ui.tone ? `status-banner ${state.ui.tone}` : 'status-banner';

  dom.dropZone.style.display = state.loadedType === null ? '' : 'none';
  dom.editorSection.classList.toggle('visible', state.loadedType !== null);
  dom.gbSourceWrap.style.display = isGbLoaded ? '' : 'none';
  dom.sourceFrame.style.display = isGbLoaded ? 'none' : '';
  dom.gbFileInfo.classList.toggle('visible', isGbLoaded);
  dom.scaleSection.style.display = isGbLoaded ? 'none' : '';
  dom.mirrorSection.style.display = isGbLoaded ? 'none' : '';
  dom.posSection.style.display = isGbLoaded ? 'none' : '';
  dom.histogramSection.style.display = isGbLoaded ? 'none' : '';
  dom.toneRangeSection.style.display = isGbLoaded ? 'none' : '';
  getPanelSection(dom.contrastReset).style.display = isGbLoaded ? 'none' : '';
  getPanelSection(dom.ditherToggle).style.display = isGbLoaded ? 'none' : '';
  getPanelSection(dom.invertToggle).style.display = isGbLoaded ? 'none' : '';
  dom.gbControls.style.display = isGbLoaded ? '' : 'none';
  dom.downloadGroup.classList.toggle('visible', outputVisible);
  if (!outputVisible) dom.zoomBox.style.display = 'none';
  dom.previewCanvas.style.aspectRatio = `${state.device.targetW} / ${state.device.targetH}`;

  setActive(dom.deviceButtons, button => button.dataset.xt === state.device.key);
  setActive(dom.modeButtons, button => button.dataset.mode === state.image.mode);
  setActive(dom.ditherButtons, button => button.dataset.dither === state.image.ditherMode);
  setActive(dom.posButtons, button => button.dataset.pos === state.image.fitAlign);
  setActive(dom.bgButtons, button => button.dataset.bg === state.background);
  setActive(dom.gbPaletteButtons, button => button.dataset.gbpalette === state.gb.paletteKey);

  dom.posSection.classList.toggle('disabled', state.image.mode === 'crop');
  dom.mirrorHBtn.classList.toggle('active', state.image.mirrorH);
  dom.mirrorVBtn.classList.toggle('active', state.image.mirrorV);

  dom.invertToggle.checked = state.image.invert;
  dom.ditherToggle.checked = state.image.ditherEnabled;
  dom.ditherAlgos.classList.toggle('disabled', !state.image.ditherEnabled);
  for (const button of dom.ditherButtons) button.disabled = !state.image.ditherEnabled;

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
  dom.gbInfoName.textContent = fileInfo?.name ?? '—';
  dom.gbInfoSize.textContent = fileInfo?.sizeText ?? '—';
  dom.gbInfoTiles.textContent = fileInfo?.tilesText ?? '—';
  dom.gbInfoDims.textContent = fileInfo?.dimsText ?? '—';
  dom.gbWarnRow.style.display = fileInfo?.warningText ? '' : 'none';
  dom.gbWarnMsg.textContent = fileInfo?.warningText ?? '';
  dom.paletteInfoVal.textContent = fileInfo?.paletteInfoText ?? '—';
  dom.paletteInfo.style.display = fileInfo?.paletteInfoText ? '' : 'none';

  dom.sourceLabel.textContent = state.loadedType === 'gb'
    ? 'GB — native palette'
    : state.image.mode === 'crop'
      ? 'Source — drag or click to reposition'
      : 'Source';
  dom.cropBox.style.display = state.loadedType === 'image' && state.image.mode === 'crop' ? 'block' : 'none';

  dom.rotateValEl.textContent = `${state.loadedType === 'gb' ? state.gb.rotation : state.image.rotation}°`;

  const isImage = state.loadedType === 'image';
  const isFit = isImage && state.image.mode === 'fit';
  const zoomLocked = isImage && state.image.editorMaxZoom <= 1.0001;
  if (!isImage || isFit) {
    dom.zoomHint.hidden = true;
    dom.zoomHint.textContent = '';
  } else {
    const zoomText = `${state.image.editorZoom.toFixed(state.image.editorZoom < 10 ? 2 : 1)}×`;
    const message = zoomLocked
      ? "image isn't larger than the device output — zoom unavailable"
      : 'scroll over the image to zoom';
    dom.zoomHint.hidden = false;
    dom.zoomHint.textContent = `${zoomText} · ${message}`;
  }
  dom.zoomInBtn.disabled = zoomLocked;
  dom.zoomOutBtn.disabled = zoomLocked || (isImage && state.image.editorZoom <= 1.0001);
}

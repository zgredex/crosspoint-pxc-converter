import type { AppState } from '../app/state';
import { computeGbDisplayScale } from '../domain/gb/displayScale';
import { computeMaxFitSizePct, rotatedSourceDims } from '../domain/geometry';
import { DEFAULT_QUANT_PRESET, QUANT_PRESET_LABELS } from '../domain/quantize';
import type { AppDom } from './dom';

// Three user-facing pills, two internal modes: '1:1' = fit + fitLockNative.
// Used by both the active-pill predicate (here) and the no-op guard (in bindings.ts) — keep in lockstep.
export function isModePillActive(datasetMode: string | undefined, image: AppState['image']): boolean {
  if (!datasetMode) return false;
  if (datasetMode === 'crop') return image.mode === 'crop';
  if (datasetMode === 'fit') return image.mode === 'fit' && !image.fitLockNative;
  if (datasetMode === 'one-to-one') return image.mode === 'fit' && image.fitLockNative;
  return false;
}

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

  dom.quantPresetBadge.hidden = state.quantPreset === DEFAULT_QUANT_PRESET;
  dom.quantPresetBadge.textContent = state.quantPreset === DEFAULT_QUANT_PRESET
    ? ''
    : `Quant: ${QUANT_PRESET_LABELS[state.quantPreset]}`;

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
  setActive(dom.modeButtons, button => isModePillActive(button.dataset.mode, state.image));
  setActive(dom.ditherButtons, button => button.dataset.dither === state.image.ditherMode);
  setActive(dom.posButtons, button => button.dataset.pos === state.image.fitAlign);
  setActive(dom.bgButtons, button => button.dataset.bg === state.background);
  setActive(dom.gbPaletteButtons, button => button.dataset.gbpalette === state.gb.paletteKey);

  const positionGridUsable = state.image.mode !== 'crop';
  const fitFreeScale = state.image.mode === 'fit' && !state.image.fitLockNative;
  dom.posSection.classList.toggle('disabled', !positionGridUsable);
  dom.fitSizeRow.style.display = fitFreeScale ? '' : 'none';
  let fitSizeMaxPct = 100;
  if (state.image.fitNoUpscale && state.image.sourceDims) {
    const dims = rotatedSourceDims(state.image.sourceDims.width, state.image.sourceDims.height, state.image.rotation);
    fitSizeMaxPct = computeMaxFitSizePct({
      sourceW: dims.w,
      sourceH: dims.h,
      targetW: state.device.targetW,
      targetH: state.device.targetH,
    });
  }
  const effectiveFitSizePct = Math.min(state.image.fitSizePct, fitSizeMaxPct);
  dom.fitSizeSlider.max = String(fitSizeMaxPct);
  dom.fitSizeSlider.value = String(effectiveFitSizePct);
  dom.fitSizeValEl.textContent = `${effectiveFitSizePct}%`;
  dom.fitNoUpscaleRow.style.display = fitFreeScale ? '' : 'none';
  dom.fitNoUpscaleToggle.checked = state.image.fitNoUpscale;
  dom.mirrorHBtn.classList.toggle('active', state.image.mirrorH);
  dom.mirrorVBtn.classList.toggle('active', state.image.mirrorV);
  dom.autoLevelsBtn.classList.toggle('active', state.image.autoLevelsApplied);

  dom.invertToggle.checked = state.image.invert;
  dom.ditherToggle.checked = state.image.ditherEnabled;
  dom.cropBox.classList.toggle('unlocked', state.image.mode !== 'crop');
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

  const dimsText = state.loadedType === 'gb'
    ? state.gb.dims ? `${state.gb.dims.width}×${state.gb.dims.height}` : null
    : state.loadedType === 'image' && state.image.sourceDims
      ? `${state.image.sourceDims.width}×${state.image.sourceDims.height}`
      : null;
  const dimsSuffix = dimsText ? ` · ${dimsText}` : '';
  dom.sourceLabel.textContent = state.loadedType === 'gb'
    ? `GB${dimsSuffix}`
    : `Source${dimsSuffix}`;
  dom.sourceSubLabel.textContent = state.loadedType === 'gb'
    ? 'native palette'
    : state.loadedType === 'image'
      ? 'drag or click to reposition'
      : '';
  dom.sourceSubLabel.hidden = dom.sourceSubLabel.textContent === '';
  dom.cropBox.style.display = state.loadedType === 'image' ? 'block' : 'none';

  dom.rotateValEl.textContent = `${state.loadedType === 'gb' ? state.gb.rotation : state.image.rotation}°`;

  const isImage = state.loadedType === 'image';
  const isGb = state.loadedType === 'gb';
  const zoomLocked = isImage && state.image.editorMaxZoom <= 1.0001;

  if (isImage) {
    const maxZoom = Math.max(1, state.image.editorMaxZoom);
    dom.zoomSlider.min = '1';
    dom.zoomSlider.max = String(maxZoom);
    dom.zoomSlider.step = 'any';
    dom.zoomSlider.value = String(Math.min(maxZoom, Math.max(1, state.image.editorZoom)));
    dom.zoomSlider.disabled = zoomLocked;
  } else if (isGb) {
    const gbZoom = state.gb.zoom > 0
      ? state.gb.zoom
      : state.gb.dims
        ? computeGbDisplayScale(state.gb.dims.width, state.gb.dims.height, state.gb.rotation, state.gb.zoom)
        : 1;
    dom.zoomSlider.min = '1';
    dom.zoomSlider.max = '6';
    dom.zoomSlider.step = '1';
    dom.zoomSlider.value = String(Math.min(6, Math.max(1, gbZoom)));
    dom.zoomSlider.disabled = false;
  } else {
    dom.zoomSlider.min = '1';
    dom.zoomSlider.max = '1';
    dom.zoomSlider.step = '0.01';
    dom.zoomSlider.value = '1';
    dom.zoomSlider.disabled = true;
  }

  if (!isImage) {
    dom.zoomHint.hidden = true;
    dom.zoomHint.textContent = '';
  } else {
    const zoomText = `${state.image.editorZoom.toFixed(state.image.editorZoom < 10 ? 2 : 1)}×`;
    const atMaxZoom = state.image.editorZoom >= state.image.editorMaxZoom - 1e-2;
    const message = zoomLocked
      ? "image isn't larger than the device output — zoom unavailable"
      : atMaxZoom
        ? 'maximum zoom reached. further zoom is disabled to avoid upscaling'
        : 'scroll or drag the slider to zoom';
    dom.zoomHint.hidden = false;
    dom.zoomHint.textContent = `${zoomText} · ${message}`;
  }
}

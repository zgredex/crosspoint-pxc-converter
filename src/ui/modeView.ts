import type { AppDom } from './dom';

function getPanelSection(element: Element): HTMLElement {
  const section = element.closest('.panel-section');
  if (!(section instanceof HTMLElement)) throw new Error('Expected panel section element');
  return section;
}

export function showGbUI(dom: AppDom, clearHistogramView: () => void): void {
  dom.editorSection.classList.add('visible');
  dom.gbSourceWrap.style.display = '';
  dom.sourceFrame.style.display = 'none';
  dom.gbFileInfo.classList.add('visible');
  dom.dropZone.style.display = 'none';

  dom.scaleSection.style.display = 'none';
  dom.mirrorSection.style.display = 'none';
  dom.posSection.style.display = 'none';
  dom.histogramSection.style.display = 'none';
  dom.toneRangeSection.style.display = 'none';
  getPanelSection(dom.contrastReset).style.display = 'none';
  getPanelSection(dom.ditherToggle).style.display = 'none';
  getPanelSection(dom.invertToggle).style.display = 'none';

  dom.gbControls.style.display = '';
  dom.sourceLabel.textContent = 'GB — native palette';
  clearHistogramView();
}

export function showImageUI(dom: AppDom): void {
  dom.gbSourceWrap.style.display = 'none';
  dom.gbFileInfo.classList.remove('visible');
  dom.gbControls.style.display = 'none';
  dom.sourceFrame.style.display = '';
  dom.sourceLabel.textContent = 'Source — drag or click to reposition';

  dom.scaleSection.style.display = '';
  dom.mirrorSection.style.display = '';
  dom.posSection.style.display = '';
  dom.histogramSection.style.display = '';
  dom.toneRangeSection.style.display = '';
  getPanelSection(dom.contrastReset).style.display = '';
  getPanelSection(dom.ditherToggle).style.display = '';
  getPanelSection(dom.invertToggle).style.display = '';
}

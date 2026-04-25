import type { AppStore } from '../../app/store';
import type { AppDom } from '../../ui/dom';
import type { GbRuntime } from '../../app/runtime/gbRuntime';
import type { OutputRuntime } from '../../app/runtime/outputRuntime';
import type { Rotation } from '../../app/state';
import { decode2bpp } from '../../domain/gb/decode2bpp';
import { parsePrinterTxt } from '../../domain/gb/parsePrinterTxt';
import { rotatePixels } from '../../domain/gb/rotatePixels';
import { readFileAsArrayBuffer, readFileAsText } from '../../infra/browser/imageLoader';
import { renderGbSourceCanvas } from '../../infra/canvas/gbSourceRenderer';
import { renderIndexedPreview } from '../../infra/canvas/previewRenderer';
import { buildGbFileInfo, buildGbOutputArtifacts, buildGbSourceView } from './service';
import { showGbUI, showImageUI } from '../../ui/modeView';

export type GbController = {
  loadBinaryFile(file: File): Promise<void>;
  loadPrinterText(text: string, outputBaseName?: string): Promise<void>;
  unloadGb(): void;
  unloadActive(): void;
  initGb(): void;
  drawSource(): void;
  refreshVisuals(): void;
  buildOutput(): void;
  setRotation(rotation: Rotation): void;
  setZoom(zoom: number): void;
  scaleUp(): void;
  scaleDown(): void;
};

type GbControllerDeps = {
  store: AppStore;
  dom: AppDom;
  runtime: GbRuntime;
  output: OutputRuntime;
  clearStatus: () => void;
  showError: (message: string) => void;
  clearHistogramView: () => void;
  validateGbBytes: (bytes: Uint8Array, sourceLabel: string) => void;
};

function getContext2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D canvas context is unavailable');
  return context;
}

const TILES_WIDE = 20;

export function createGbController(deps: GbControllerDeps): GbController {
  function getState() {
    return deps.store.getState();
  }

  function unloadGb(): void {
    deps.clearStatus();
    deps.dom.gbCanvas.width = 1;
    deps.dom.gbCanvas.height = 1;
    deps.runtime.rawBytes = null;
    deps.runtime.pixels = null;
    deps.runtime.paletteRemap = null;
    deps.store.dispatch({ type: 'gb/resetAll' });
    showImageUI(deps.dom);
    deps.store.dispatch({ type: 'setLoadedType', loadedType: null });
    getContext2d(deps.dom.previewCanvas).clearRect(0, 0, getState().device.targetW, getState().device.targetH);
    deps.dom.downloadGroup.classList.remove('visible');
    deps.dom.fileInput.value = '';
    deps.output.pxcBytes = null;
    deps.output.bmpBytes = null;
  }

  function updateFileInfo(): void {
    if (deps.runtime.rawBytes === null) throw new Error('GB bytes are not loaded');
    const info = buildGbFileInfo({
      name: deps.output.outputBaseName,
      rawByteLength: deps.runtime.rawBytes.length,
      tilesWide: TILES_WIDE,
      paletteRemap: deps.runtime.paletteRemap,
    });

    deps.dom.gbInfoName.textContent = info.name;
    deps.dom.gbInfoSize.textContent = info.sizeText;
    deps.dom.gbInfoTiles.textContent = info.tilesText;
    deps.dom.gbInfoDims.textContent = info.dimsText;
    deps.dom.gbWarnRow.style.display = info.warningText ? '' : 'none';
    deps.dom.gbWarnMsg.textContent = info.warningText ?? '';
    deps.dom.palletInfoVal.textContent = info.paletteInfoText ?? '';
    deps.dom.palletInfo.style.display = info.paletteInfoText ? '' : 'none';
  }

  function drawGbSource(): void {
    if (deps.runtime.pixels === null) throw new Error('GB pixels are not decoded');
    const state = getState();
    const view = buildGbSourceView(deps.runtime.pixels, deps.runtime.width, deps.runtime.height, state.gb.rotation, state.gb.zoom);
    deps.runtime.renderedScale = view.displayScale;
    deps.dom.zoomLabelEl.textContent = `${view.displayScale}×`;
    renderGbSourceCanvas(
      deps.dom.gbCanvas,
      view.pixels,
      view.width,
      view.height,
      state.gb.paletteKey,
      view.displayScale,
      deps.runtime.paletteRemap,
      state.gb.invert,
    );
  }

  function buildOutput(): void {
    if (deps.runtime.pixels === null) throw new Error('GB pixels are not decoded');
    const state = getState();
    const outputs = buildGbOutputArtifacts({
      pixels: deps.runtime.pixels,
      width: deps.runtime.width,
      height: deps.runtime.height,
      rotation: state.gb.rotation,
      outputScale: state.gb.outputScale,
      targetW: state.device.targetW,
      targetH: state.device.targetH,
      background: state.image.fitBg,
      paletteRemap: deps.runtime.paletteRemap,
      invert: state.gb.invert,
      paletteKey: state.gb.paletteKey,
    });

    renderIndexedPreview(deps.dom.previewCanvas, outputs.indexedPixels, state.device.targetW, state.device.targetH);
    deps.output.pxcBytes = outputs.pxcBytes;
    deps.output.bmpBytes = outputs.bmpBytes;
    deps.dom.downloadGroup.classList.add('visible');
    deps.clearHistogramView();
  }

  function decodeGbDraw(): void {
    if (deps.runtime.rawBytes === null) throw new Error('GB bytes are not loaded');
    const { pixels, w, h } = decode2bpp(deps.runtime.rawBytes, TILES_WIDE);
    deps.runtime.pixels = pixels;
    deps.runtime.width = w;
    deps.runtime.height = h;
    updateFileInfo();
    drawGbSource();
  }

  function initGb(): void {
    decodeGbDraw();
    buildOutput();
    showGbUI(deps.dom, deps.clearHistogramView);
  }

  async function loadBinaryFile(file: File): Promise<void> {
    deps.clearStatus();
    unloadGb();
    try {
      deps.output.outputBaseName = file.name.replace(/\.[^.]+$/, '');
      deps.store.dispatch({ type: 'setLoadedType', loadedType: 'gb' });
      deps.runtime.rawBytes = new Uint8Array(await readFileAsArrayBuffer(file));
      deps.validateGbBytes(deps.runtime.rawBytes, 'Game Boy binary');
      deps.runtime.paletteRemap = null;
      initGb();
    } catch (error) {
      unloadGb();
      deps.showError(error instanceof Error ? error.message : 'Failed to load the selected GB input.');
    }
  }

  async function loadPrinterText(text: string, outputBaseName = 'pasted-printer-log'): Promise<void> {
    deps.clearStatus();
    unloadGb();
    try {
      deps.output.outputBaseName = outputBaseName;
      deps.store.dispatch({ type: 'setLoadedType', loadedType: 'gb' });
      const parsed = parsePrinterTxt(text);
      deps.validateGbBytes(parsed.bytes, outputBaseName === 'pasted-printer-log' ? 'Pasted GB Printer text' : 'GB Printer text log');
      deps.runtime.rawBytes = parsed.bytes;
      deps.runtime.paletteRemap = parsed.palletShades;
      initGb();
    } catch (error) {
      unloadGb();
      deps.showError(error instanceof Error ? error.message : 'Failed to parse GB Printer text.');
    }
  }

  function refreshVisuals(): void {
    if (!deps.runtime.pixels) return;
    drawGbSource();
    buildOutput();
  }

  function setRotation(rotation: Rotation): void {
    deps.store.dispatch({ type: 'gb/setRotation', rotation });
    if (deps.runtime.pixels) refreshVisuals();
  }

  function setZoom(zoom: number): void {
    deps.store.dispatch({ type: 'gb/setZoom', zoom });
    if (deps.runtime.pixels) drawGbSource();
  }

  function scaleUp(): void {
    if (!deps.runtime.pixels) return;
    const state = getState();
    const rotated = rotatePixels(deps.runtime.pixels, deps.runtime.width, deps.runtime.height, state.gb.rotation);
    const maxScale = Math.min(Math.floor(state.device.targetW / rotated.w), Math.floor(state.device.targetH / rotated.h));
    if (state.gb.outputScale < maxScale) {
      deps.store.dispatch({ type: 'gb/setOutputScale', outputScale: state.gb.outputScale + 1 });
      buildOutput();
    }
  }

  function scaleDown(): void {
    if (!deps.runtime.pixels) return;
    const state = getState();
    if (state.gb.outputScale > 1) {
      deps.store.dispatch({ type: 'gb/setOutputScale', outputScale: state.gb.outputScale - 1 });
      buildOutput();
    }
  }

  return {
    loadBinaryFile,
    loadPrinterText,
    unloadGb,
    unloadActive: unloadGb,
    initGb,
    drawSource: drawGbSource,
    refreshVisuals,
    buildOutput,
    setRotation,
    setZoom,
    scaleUp,
    scaleDown,
  };
}

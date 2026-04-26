import type { AppStore } from '../../app/store';
import type { AppDom } from '../../ui/dom';
import type { GbRuntime } from '../../app/runtime/gbRuntime';
import { clearOutputBytes, setOutputBytes, type OutputRuntime } from '../../app/runtime/outputRuntime';
import type { Rotation } from '../../app/state';
import { decode2bpp } from '../../domain/gb/decode2bpp';
import { parsePrinterTxt } from '../../domain/gb/parsePrinterTxt';
import { rotatePixels } from '../../domain/gb/rotatePixels';
import { readFileAsArrayBuffer, readFileAsText } from '../../infra/browser/imageLoader';
import { getContext2d } from '../../infra/canvas/context';
import { renderGbSourceCanvas } from '../../infra/canvas/gbSourceRenderer';
import { renderIndexedPreview } from '../../infra/canvas/previewRenderer';
import { buildGbOutputArtifacts, buildGbSourceView } from './service';

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
  syncUi: () => void;
};

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
    deps.store.dispatch({ type: 'setLoadedType', loadedType: null });
    getContext2d(deps.dom.previewCanvas).clearRect(0, 0, getState().device.targetW, getState().device.targetH);
    deps.dom.fileInput.value = '';
    clearOutputBytes(deps.output);
    deps.output.outputBaseName = 'sleep';
    deps.syncUi();
  }

  function drawGbSource(): void {
    if (deps.runtime.pixels === null) throw new Error('GB pixels are not decoded');
    const state = getState();
    const view = buildGbSourceView(deps.runtime.pixels, deps.runtime.width, deps.runtime.height, state.gb.rotation, state.gb.zoom);
    deps.runtime.renderedScale = view.displayScale;
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
    deps.syncUi();
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
      background: state.background,
      paletteRemap: deps.runtime.paletteRemap,
      invert: state.gb.invert,
      paletteKey: state.gb.paletteKey,
    });

    renderIndexedPreview(deps.dom.previewCanvas, outputs.indexedPixels, state.device.targetW, state.device.targetH);
    setOutputBytes(deps.output, outputs.pxcBytes, outputs.bmpBytes);
    deps.clearHistogramView();
    deps.syncUi();
  }

  function decodeGbDraw(): void {
    if (deps.runtime.rawBytes === null) throw new Error('GB bytes are not loaded');
    const { pixels, w, h } = decode2bpp(deps.runtime.rawBytes, TILES_WIDE);
    deps.runtime.pixels = pixels;
    deps.runtime.width = w;
    deps.runtime.height = h;
    drawGbSource();
  }

  function initGb(): void {
    decodeGbDraw();
    buildOutput();
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
      deps.runtime.paletteRemap = parsed.paletteShades;
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

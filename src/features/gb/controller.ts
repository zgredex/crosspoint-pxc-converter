import { actions } from '../../app/actions';
import type { AppStore } from '../../app/store';
import type { GbRuntime } from '../../app/runtime/gbRuntime';
import { setOutputBytes, type OutputRuntime } from '../../app/runtime/outputRuntime';
import type { Rotation } from '../../app/state';
import { decode2bpp } from '../../domain/gb/decode2bpp';
import { parsePrinterTxt } from '../../domain/gb/parsePrinterTxt';
import { rotatePixels } from '../../domain/gb/rotatePixels';
import { readFileAsArrayBuffer, readFileAsText } from '../../infra/browser/imageLoader';
import { renderGbSourceCanvas } from '../../infra/canvas/gbSourceRenderer';
import { renderIndexedPreview } from '../../infra/canvas/previewRenderer';
import { buildGbFileInfo, buildGbOutputArtifacts, buildGbSourceView } from './service';

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

export type GbControllerElements = {
  previewCanvas: HTMLCanvasElement;
  gbCanvas: HTMLCanvasElement;
};

type GbControllerDeps = {
  store: AppStore;
  elements: GbControllerElements;
  runtime: GbRuntime;
  output: OutputRuntime;
  clearStatus: () => void;
  showError: (message: string) => void;
  clearHistogramView: () => void;
  validateGbBytes: (bytes: Uint8Array, sourceLabel: string) => void;
  resetSession: () => void;
};

const TILES_WIDE = 20;

export function createGbController(deps: GbControllerDeps): GbController {
  function getState() {
    return deps.store.getState();
  }

  function requireDecoded(): { pixels: Uint8Array; width: number; height: number } {
    const { pixels } = deps.runtime;
    const dims = getState().gb.dims;
    if (pixels === null || dims === null) throw new Error('GB pixels are not decoded');
    return { pixels, width: dims.width, height: dims.height };
  }

  function unloadGb(): void {
    deps.elements.gbCanvas.width = 1;
    deps.elements.gbCanvas.height = 1;
    deps.runtime.rawBytes = null;
    deps.runtime.pixels = null;
    deps.runtime.paletteRemap = null;
    deps.store.dispatch(actions.gbResetAll());
    deps.resetSession();
  }

  function drawGbSource(): void {
    const { pixels, width, height } = requireDecoded();
    const state = getState();
    const view = buildGbSourceView(pixels, width, height, state.gb.rotation, state.gb.zoom);
    renderGbSourceCanvas(
      deps.elements.gbCanvas,
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
    const { pixels, width, height } = requireDecoded();
    const state = getState();
    const outputs = buildGbOutputArtifacts({
      pixels,
      width,
      height,
      rotation: state.gb.rotation,
      outputScale: state.gb.outputScale,
      targetW: state.device.targetW,
      targetH: state.device.targetH,
      background: state.background,
      paletteRemap: deps.runtime.paletteRemap,
      invert: state.gb.invert,
      paletteKey: state.gb.paletteKey,
    });

    renderIndexedPreview(deps.elements.previewCanvas, outputs.indexedPixels, state.device.targetW, state.device.targetH);
    setOutputBytes(deps.output, outputs.pxcBytes, outputs.bmpBytes);
    deps.clearHistogramView();
    deps.store.dispatch(actions.outputSetReady(true, true));
  }

  function decodeGbDraw(): void {
    if (deps.runtime.rawBytes === null) throw new Error('GB bytes are not loaded');
    const { pixels, w, h } = decode2bpp(deps.runtime.rawBytes, TILES_WIDE);
    deps.runtime.pixels = pixels;
    deps.store.dispatch(actions.gbSetDims({ width: w, height: h }));
    drawGbSource();
  }

  function dispatchFileInfo(name: string): void {
    if (deps.runtime.rawBytes === null) return;
    const fileInfo = buildGbFileInfo({
      name,
      rawByteLength: deps.runtime.rawBytes.length,
      tilesWide: TILES_WIDE,
      paletteRemap: deps.runtime.paletteRemap,
    });
    deps.store.dispatch(actions.gbSetFileInfo(fileInfo));
  }

  function initGb(): void {
    decodeGbDraw();
    buildOutput();
  }

  async function loadBinaryFile(file: File): Promise<void> {
    deps.clearStatus();
    unloadGb();
    try {
      const baseName = file.name.replace(/\.[^.]+$/, '');
      deps.store.dispatch(actions.outputSetBaseName(baseName));
      deps.store.dispatch(actions.setLoadedType('gb'));
      deps.runtime.rawBytes = new Uint8Array(await readFileAsArrayBuffer(file));
      deps.validateGbBytes(deps.runtime.rawBytes, 'Game Boy binary');
      deps.runtime.paletteRemap = null;
      dispatchFileInfo(baseName);
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
      deps.store.dispatch(actions.outputSetBaseName(outputBaseName));
      deps.store.dispatch(actions.setLoadedType('gb'));
      const parsed = parsePrinterTxt(text);
      deps.validateGbBytes(parsed.bytes, outputBaseName === 'pasted-printer-log' ? 'Pasted GB Printer text' : 'GB Printer text log');
      deps.runtime.rawBytes = parsed.bytes;
      deps.runtime.paletteRemap = parsed.paletteShades;
      dispatchFileInfo(outputBaseName);
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
    deps.store.dispatch(actions.gbSetRotation(rotation));
    if (deps.runtime.pixels) refreshVisuals();
  }

  function setZoom(zoom: number): void {
    deps.store.dispatch(actions.gbSetZoom(zoom));
    if (deps.runtime.pixels) drawGbSource();
  }

  function adjustOutputScale(delta: 1 | -1): void {
    if (!deps.runtime.pixels) return;
    const state = getState();
    const next = state.gb.outputScale + delta;
    if (next < 1) return;
    if (delta === 1) {
      const { pixels, width, height } = requireDecoded();
      const rotated = rotatePixels(pixels, width, height, state.gb.rotation);
      const maxScale = Math.min(Math.floor(state.device.targetW / rotated.w), Math.floor(state.device.targetH / rotated.h));
      if (next > maxScale) return;
    }
    deps.store.dispatch(actions.gbSetOutputScale(next));
    buildOutput();
  }

  function scaleUp(): void { adjustOutputScale(1); }
  function scaleDown(): void { adjustOutputScale(-1); }

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

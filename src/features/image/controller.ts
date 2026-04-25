import type { AppStore } from '../../app/store';
import type { AppDom } from '../../ui/dom';
import type { ImageRuntime } from '../../app/runtime/imageRuntime';
import type { OutputRuntime } from '../../app/runtime/outputRuntime';
import type { Rotation } from '../../app/state';
import type { PicaResizer } from '../../infra/canvas/picaResize';
import { buildImageRenderPlan, getImageAnalysisRegion } from '../../domain/geometry';
import { buildUintHistogram } from '../../domain/histogram';
import { buildGammaLut, buildLuminanceBuffer, computeAutoLevels } from '../../domain/tone';
import { loadImageFromDataUrl, readFileAsDataUrl } from '../../infra/browser/imageLoader';
import { renderHistogram } from '../../infra/canvas/histogramRenderer';
import { resizeWithPica } from '../../infra/canvas/picaResize';
import { renderIndexedPreview } from '../../infra/canvas/previewRenderer';
import { buildImageOutputs, renderImageBaseRaster } from './service';
import { applyCropBoxToDom } from './cropBox';
import { buildRotatedSource, getSourceImage, srcH, srcW } from './source';

export type ImageController = {
  loadImageFile(file: File): Promise<void>;
  unloadImage(): void;
  resetEditor(): Promise<void>;
  autoLevels(): Promise<void>;
  convert(): Promise<void>;
  requestConvert(delay: number): void;
  refreshTransformedSource(): Promise<void>;
  rebuildGammaLut(): void;
  setRotation(rotation: Rotation): void;
  setZoom(zoom: number): void;
  toggleMirrorH(): void;
  toggleMirrorV(): void;
};

type ImageControllerDeps = {
  store: AppStore;
  dom: AppDom;
  runtime: ImageRuntime;
  output: OutputRuntime;
  pica: PicaResizer;
  clearStatus: () => void;
  showError: (message: string) => void;
  clearHistogramView: () => void;
  clearSnap: () => void;
};

function getContext2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D canvas context is unavailable');
  return context;
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function createImageController(deps: ImageControllerDeps): ImageController {
  function getState() {
    return deps.store.getState();
  }

  function rebuildGammaLut(): void {
    deps.runtime.gammaLut = buildGammaLut(getState().image.gammaValue);
  }

  function requestConvert(delay: number): void {
    if (deps.runtime.convertTimer !== null) clearTimeout(deps.runtime.convertTimer);
    deps.runtime.convertTimer = setTimeout(convert, delay);
  }

  function setRotation(rotation: Rotation): void {
    deps.store.dispatch({ type: 'image/setRotation', rotation });
    if (deps.runtime.loadedImg) void refreshTransformedSource();
  }

  function setZoom(zoom: number): void {
    deps.store.dispatch({ type: 'image/setEditorZoom', editorZoom: zoom });
    if (deps.runtime.loadedImg) void resetEditor();
  }

  function toggleMirrorH(): void {
    deps.store.dispatch({ type: 'image/toggleMirrorH' });
    if (deps.runtime.loadedImg) void refreshTransformedSource();
  }

  function toggleMirrorV(): void {
    deps.store.dispatch({ type: 'image/toggleMirrorV' });
    if (deps.runtime.loadedImg) void refreshTransformedSource();
  }

  function drawHistogram(): void {
    renderHistogram(deps.dom.histogramCanvas, deps.runtime.lastHistogram, getState().device.totalPixels);
  }

  function unloadImage(): void {
    deps.clearStatus();
    deps.store.dispatch({ type: 'setLoadedType', loadedType: null });

    if (deps.runtime.convertTimer !== null) {
      clearTimeout(deps.runtime.convertTimer);
      deps.runtime.convertTimer = null;
    }

    if (deps.runtime.loadedImg) {
      deps.runtime.loadedImg.src = '';
      deps.runtime.loadedImg = null;
    }

    deps.output.pxcBytes = null;
    deps.output.bmpBytes = null;
    deps.output.outputBaseName = 'sleep';

    deps.dom.sourceCanvas.width = 1;
    deps.dom.sourceCanvas.height = 1;
    getContext2d(deps.dom.workCanvas).clearRect(0, 0, getState().device.targetW, getState().device.targetH);
    getContext2d(deps.dom.previewCanvas).clearRect(0, 0, getState().device.targetW, getState().device.targetH);

    deps.dom.fileInput.value = '';
    deps.store.dispatch({ type: 'image/resetAll' });

    if (deps.runtime.rotatedSrc) {
      deps.runtime.rotatedSrc.width = 1;
      deps.runtime.rotatedSrc.height = 1;
      deps.runtime.rotatedSrc = null;
    }

    rebuildGammaLut();
    deps.clearSnap();

    deps.clearHistogramView();
    deps.dom.downloadGroup.classList.remove('visible');
  }

  async function loadImageFile(file: File): Promise<void> {
    deps.clearStatus();
    unloadImage();
    try {
      deps.output.outputBaseName = file.name.replace(/\.[^.]+$/, '');
      deps.store.dispatch({ type: 'setLoadedType', loadedType: 'image' });
      deps.runtime.loadedImg = await loadImageFromDataUrl(await readFileAsDataUrl(file));
      await resetEditor();
    } catch (error) {
      unloadImage();
      deps.showError(error instanceof Error ? error.message : 'Failed to load the selected input.');
    }
  }

  async function resetEditor(): Promise<void> {
    const state = getState();
    if (state.image.rotation !== 0 || state.image.mirrorH || state.image.mirrorV) {
      buildRotatedSource(deps.runtime, state.image.rotation, state.image.mirrorH, state.image.mirrorV);
    }

    const src = getSourceImage(deps.runtime, state.image.rotation, state.image.mirrorH, state.image.mirrorV);
    const sourceWidth = srcW(src);
    const sourceHeight = srcH(src);

    const baseScale = Math.min(340 / sourceWidth, 520 / sourceHeight);
    deps.runtime.displayScale = Math.min(baseScale * state.image.editorZoom, 1.0);
    deps.runtime.dispImgW = Math.round(sourceWidth * deps.runtime.displayScale);
    deps.runtime.dispImgH = Math.round(sourceHeight * deps.runtime.displayScale);

    deps.runtime.workScale = state.image.mode === 'crop'
      ? Math.max(state.device.targetW / sourceWidth, state.device.targetH / sourceHeight)
      : Math.min(state.device.targetW / sourceWidth, state.device.targetH / sourceHeight);

    const prevCenterX = deps.runtime.boxW > 0
      ? (deps.runtime.boxX + deps.runtime.boxW / 2) / deps.runtime.displayScale
      : sourceWidth / 2;
    const prevCenterY = deps.runtime.boxH > 0
      ? (deps.runtime.boxY + deps.runtime.boxH / 2) / deps.runtime.displayScale
      : sourceHeight / 2;

    deps.runtime.boxW = Math.min((state.device.targetW / deps.runtime.workScale) * deps.runtime.displayScale, deps.runtime.dispImgW);
    deps.runtime.boxH = Math.min((state.device.targetH / deps.runtime.workScale) * deps.runtime.displayScale, deps.runtime.dispImgH);
    deps.runtime.boxX = prevCenterX * deps.runtime.displayScale - deps.runtime.boxW / 2;
    deps.runtime.boxY = prevCenterY * deps.runtime.displayScale - deps.runtime.boxH / 2;

    deps.dom.sourceCanvas.width = deps.runtime.dispImgW;
    deps.dom.sourceCanvas.height = deps.runtime.dispImgH;
    await resizeWithPica(deps.pica, src, deps.dom.sourceCanvas);
    deps.dom.sourceFrame.style.width = `${Math.min(deps.runtime.dispImgW, 340)}px`;
    deps.dom.sourceFrame.style.height = `${Math.min(deps.runtime.dispImgH, 520)}px`;

    if (state.image.mode === 'crop') {
      deps.clearSnap();
      applyCropBoxToDom({ runtime: deps.runtime, cropBox: deps.dom.cropBox, sourceFrame: deps.dom.sourceFrame });
    } else {
      deps.clearSnap();
    }

    requestConvert(0);
  }

  async function autoLevels(): Promise<void> {
    if (!deps.runtime.loadedImg) return;

    const state = getState();
    const gen = ++deps.runtime.autoLevelsGen;
    const src = getSourceImage(deps.runtime, state.image.rotation, state.image.mirrorH, state.image.mirrorV);
    const sourceWidth = srcW(src);
    const sourceHeight = srcH(src);
    const tempCanvas = createCanvas(state.device.targetW, state.device.targetH);
    const plan = buildImageRenderPlan({
      mode: state.image.mode,
      sourceW: sourceWidth,
      sourceH: sourceHeight,
      targetW: state.device.targetW,
      targetH: state.device.targetH,
      fitAlign: state.image.fitAlign,
      displayScale: deps.runtime.displayScale,
      workScale: deps.runtime.workScale,
      boxX: deps.runtime.boxX,
      boxY: deps.runtime.boxY,
    });

    await renderImageBaseRaster({
      src,
      targetCanvas: tempCanvas,
      plan,
      fitBg: state.image.fitBg,
      pica: deps.pica,
    });
    if (gen !== deps.runtime.autoLevelsGen) return;

    const region = getImageAnalysisRegion(plan, state.device.targetW, state.device.targetH);
    const px = getContext2d(tempCanvas).getImageData(region.x, region.y, region.width, region.height).data;
    const levels = computeAutoLevels(buildUintHistogram(buildLuminanceBuffer(px)), region.pixelCount);

    deps.store.dispatch({ type: 'image/setBlackPoint', blackPoint: levels.blackPoint });
    deps.store.dispatch({ type: 'image/setWhitePoint', whitePoint: levels.whitePoint });
    deps.store.dispatch({ type: 'image/setGamma', gammaValue: 1.0 });
    rebuildGammaLut();
    requestConvert(0);
  }

  async function convert(): Promise<void> {
    if (!deps.runtime.loadedImg) return;

    const state = getState();
    const gen = ++deps.runtime.convertGen;
    const src = getSourceImage(deps.runtime, state.image.rotation, state.image.mirrorH, state.image.mirrorV);
    const sourceWidth = srcW(src);
    const sourceHeight = srcH(src);
    const plan = buildImageRenderPlan({
      mode: state.image.mode,
      sourceW: sourceWidth,
      sourceH: sourceHeight,
      targetW: state.device.targetW,
      targetH: state.device.targetH,
      fitAlign: state.image.fitAlign,
      displayScale: deps.runtime.displayScale,
      workScale: deps.runtime.workScale,
      boxX: deps.runtime.boxX,
      boxY: deps.runtime.boxY,
    });

    await renderImageBaseRaster({
      src,
      targetCanvas: deps.dom.workCanvas,
      plan,
      fitBg: state.image.fitBg,
      pica: deps.pica,
    });
    if (gen !== deps.runtime.convertGen) return;

    const outputs = buildImageOutputs(
      getContext2d(deps.dom.workCanvas).getImageData(0, 0, state.device.targetW, state.device.targetH).data,
      state.device.targetW,
      state.device.targetH,
      {
        blackPoint: state.image.blackPoint,
        whitePoint: state.image.whitePoint,
        gammaValue: state.image.gammaValue,
        gammaLut: deps.runtime.gammaLut,
        contrastValue: state.image.contrastValue,
        invert: state.image.invert,
        ditherEnabled: state.image.ditherEnabled,
        ditherMode: state.image.ditherMode,
      },
    );

    deps.runtime.lastHistogram = outputs.histogram;
    drawHistogram();
    renderIndexedPreview(deps.dom.previewCanvas, outputs.indexedPixels, state.device.targetW, state.device.targetH);
    deps.output.pxcBytes = outputs.pxcBytes;
    deps.output.bmpBytes = outputs.bmpBytes;
    deps.dom.downloadGroup.classList.add('visible');
  }

  async function refreshTransformedSource(): Promise<void> {
    if (!deps.runtime.loadedImg) return;
    const state = getState();
    buildRotatedSource(deps.runtime, state.image.rotation, state.image.mirrorH, state.image.mirrorV);
    await resetEditor();
  }

  return {
    loadImageFile,
    unloadImage,
    resetEditor,
    autoLevels,
    convert,
    requestConvert,
    refreshTransformedSource,
    rebuildGammaLut,
    setRotation,
    setZoom,
    toggleMirrorH,
    toggleMirrorV,
  };
}

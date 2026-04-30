import { actions, type AppAction } from '../../app/actions';
import type { AppStore } from '../../app/store';
import type { ImageRuntime } from '../../app/runtime/imageRuntime';
import type { OutputRuntime } from '../../app/runtime/outputRuntime';
import type { Rotation } from '../../app/state';
import { createCanvas, getContext2d } from '../../infra/canvas/context';
import type { PicaResizer } from '../../infra/canvas/picaResize';
import {
  buildImageRenderPlan,
  computeEditorGeometry,
  getImageAnalysisRegion,
  type EditorGeometry,
  type ImageRenderPlan,
} from '../../domain/geometry';
import { buildUintHistogram } from '../../domain/histogram';
import { buildLuminanceBuffer, computeAutoLevels } from '../../domain/tone';
import { loadImageFromDataUrl, readFileAsDataUrl } from '../../infra/browser/imageLoader';
import { renderHistogram } from '../../infra/canvas/histogramRenderer';
import { renderIndexedPreview } from '../../infra/canvas/previewRenderer';
import { renderImageBaseRaster } from './service';
import { applyCropBoxToDom, nudgeCropBoxIntoView } from './cropBox';
import { buildRotatedSource, getSourceImage, srcH, srcW, type SourceImage } from './source';
import type { ImageWorkerClient } from '../../infra/worker/imageWorkerClient';

export type ImageController = {
  loadImageFile(file: File): Promise<void>;
  unloadImage(): void;
  resetEditor(): Promise<void>;
  autoLevels(): Promise<void>;
  requestConvert(): void;
  invalidateBaseRaster(): void;
  refreshTransformedSource(): Promise<void>;
  setRotation(rotation: Rotation): void;
  setZoom(zoom: number): void;
  applyEditorZoom(targetZoom: number, anchorClientX?: number, anchorClientY?: number): void;
  getMaxEditorZoom(): number;
  toggleMirrorH(): void;
  toggleMirrorV(): void;
};

export type ImageControllerElements = {
  previewCanvas: HTMLCanvasElement;
  histogramCanvas: HTMLCanvasElement;
  sourceCanvas: HTMLCanvasElement;
  workCanvas: HTMLCanvasElement;
  sourceFrame: HTMLDivElement;
  cropBox: HTMLDivElement;
};

type ImageControllerDeps = {
  store: AppStore;
  elements: ImageControllerElements;
  runtime: ImageRuntime;
  output: OutputRuntime;
  pica: PicaResizer;
  worker: ImageWorkerClient;
  clearStatus: () => void;
  showError: (message: string) => void;
  clearHistogramView: () => void;
  clearSnap: () => void;
  resetSession: () => void;
};

const MAX_EDITOR_WIDTH = 340;
const MAX_EDITOR_HEIGHT = 520;

export function createImageController(deps: ImageControllerDeps): ImageController {
  function getState() {
    return deps.store.getState();
  }

  let processing = false;
  let processRequested = false;
  let rasterDirty = true;

  function getActiveSource(): SourceImage {
    const state = getState();
    return getSourceImage(deps.runtime, state.image.rotation, state.image.mirrorH, state.image.mirrorV);
  }

  function currentRenderPlan(sourceW: number, sourceH: number): ImageRenderPlan {
    const state = getState();
    return buildImageRenderPlan({
      mode: state.image.mode,
      sourceW,
      sourceH,
      targetW: state.device.targetW,
      targetH: state.device.targetH,
      fitAlign: state.image.fitAlign,
      displayScale: deps.runtime.displayScale,
      workScale: deps.runtime.workScale,
      boxX: deps.runtime.boxX,
      boxY: deps.runtime.boxY,
    });
  }

  function dispatchAndRetransform(action: AppAction): void {
    deps.store.dispatch(action);
    if (deps.runtime.loadedImg) void refreshTransformedSource();
  }

  deps.worker.onResult((result) => {
    if (result.version !== deps.runtime.processVersion) return;

    const state = getState();
    deps.runtime.lastIndexedPixels = new Uint8Array(result.indexedPixels);
    deps.runtime.lastHistogram = new Float32Array(result.histogram);

    renderIndexedPreview(deps.elements.previewCanvas, deps.runtime.lastIndexedPixels, state.device.targetW, state.device.targetH);
    renderHistogram(deps.elements.histogramCanvas, deps.runtime.lastHistogram, state.device.totalPixels);
    deps.store.dispatch(actions.outputSetReady(true, true));

    processing = false;
    if (processRequested) scheduleNextConvert();
  });

  function requestConvert(): void {
    if (deps.runtime.convertTimer !== null) cancelAnimationFrame(deps.runtime.convertTimer);
    processRequested = true;
    if (processing) return;
    scheduleNextConvert();
  }

  function scheduleNextConvert(): void {
    deps.runtime.convertTimer = requestAnimationFrame(() => {
      deps.runtime.convertTimer = null;
      void convert();
    });
  }

  function setRotation(rotation: Rotation): void {
    dispatchAndRetransform(actions.imageSetRotation(rotation));
  }

  function setZoom(zoom: number): void {
    deps.store.dispatch(actions.imageSetEditorZoom(zoom));
    if (deps.runtime.loadedImg) void resetEditor();
  }

  function toggleMirrorH(): void {
    if (deps.runtime.loadedImg && deps.runtime.dispImgW > 0) {
      deps.runtime.boxX = deps.runtime.dispImgW - deps.runtime.boxX - deps.runtime.boxW;
    }
    dispatchAndRetransform(actions.imageToggleMirrorH());
  }

  function toggleMirrorV(): void {
    if (deps.runtime.loadedImg && deps.runtime.dispImgH > 0) {
      deps.runtime.boxY = deps.runtime.dispImgH - deps.runtime.boxY - deps.runtime.boxH;
    }
    dispatchAndRetransform(actions.imageToggleMirrorV());
  }

  function unloadImage(): void {
    if (deps.runtime.convertTimer !== null) {
      cancelAnimationFrame(deps.runtime.convertTimer);
      deps.runtime.convertTimer = null;
    }

    if (deps.runtime.loadedImg) {
      deps.runtime.loadedImg.src = '';
      deps.runtime.loadedImg = null;
    }

    deps.runtime.cachedBaseRaster = null;
    deps.runtime.lastIndexedPixels = null;
    deps.runtime.sharedBufferVersion = 0;
    rasterDirty = true;

    deps.elements.sourceCanvas.width = 1;
    deps.elements.sourceCanvas.height = 1;
    getContext2d(deps.elements.workCanvas).clearRect(0, 0, getState().device.targetW, getState().device.targetH);

    deps.resetSession();
    deps.store.dispatch(actions.imageResetAll());

    if (deps.runtime.rotatedSrc) {
      deps.runtime.rotatedSrc.width = 1;
      deps.runtime.rotatedSrc.height = 1;
      deps.runtime.rotatedSrc = null;
    }

    deps.clearSnap();
    deps.clearHistogramView();
  }

  async function loadImageFile(file: File): Promise<void> {
    deps.clearStatus();
    unloadImage();
    try {
      deps.store.dispatch(actions.outputSetBaseName(file.name.replace(/\.[^.]+$/, '')));
      deps.store.dispatch(actions.setLoadedType('image'));
      deps.runtime.loadedImg = await loadImageFromDataUrl(await readFileAsDataUrl(file));
      await resetEditor();
    } catch (error) {
      unloadImage();
      deps.showError(error instanceof Error ? error.message : 'Failed to load the selected input.');
    }
  }

  type ScrollAnchor = { kind: 'box' } | { kind: 'point'; clientX: number; clientY: number };

  function redrawSourceCanvas(src: SourceImage, w: number, h: number): void {
    deps.elements.sourceCanvas.width = w;
    deps.elements.sourceCanvas.height = h;
    const ctx = getContext2d(deps.elements.sourceCanvas);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, w, h);
  }

  function geometryFor(zoom: number, src: SourceImage): { sourceW: number; sourceH: number; geom: EditorGeometry } {
    const state = getState();
    const sourceW = srcW(src);
    const sourceH = srcH(src);
    return {
      sourceW,
      sourceH,
      geom: computeEditorGeometry({
        mode: state.image.mode,
        sourceW,
        sourceH,
        targetW: state.device.targetW,
        targetH: state.device.targetH,
        frameMaxW: MAX_EDITOR_WIDTH,
        frameMaxH: MAX_EDITOR_HEIGHT,
        editorZoom: zoom,
      }),
    };
  }

  function applyGeometry(src: SourceImage, sourceW: number, sourceH: number, geom: EditorGeometry, anchor: ScrollAnchor): void {
    const state = getState();
    const oldDisplay = deps.runtime.displayScale || geom.displayScale;
    const frame = deps.elements.sourceFrame;

    let anchorFx = 0;
    let anchorFy = 0;
    let anchorSx = 0;
    let anchorSy = 0;
    if (anchor.kind === 'point') {
      const rect = frame.getBoundingClientRect();
      anchorFx = anchor.clientX - rect.left;
      anchorFy = anchor.clientY - rect.top;
      anchorSx = (anchorFx + frame.scrollLeft) / oldDisplay;
      anchorSy = (anchorFy + frame.scrollTop) / oldDisplay;
    }

    const prevCenterX = deps.runtime.boxW > 0
      ? (deps.runtime.boxX + deps.runtime.boxW / 2) / oldDisplay
      : sourceW / 2;
    const prevCenterY = deps.runtime.boxH > 0
      ? (deps.runtime.boxY + deps.runtime.boxH / 2) / oldDisplay
      : sourceH / 2;

    deps.runtime.displayScale = geom.displayScale;
    deps.runtime.workScale = geom.workScale;
    deps.runtime.dispImgW = geom.dispImgW;
    deps.runtime.dispImgH = geom.dispImgH;
    deps.runtime.boxW = Math.min((state.device.targetW / geom.workScale) * geom.displayScale, geom.dispImgW);
    deps.runtime.boxH = Math.min((state.device.targetH / geom.workScale) * geom.displayScale, geom.dispImgH);
    deps.runtime.boxX = prevCenterX * geom.displayScale - deps.runtime.boxW / 2;
    deps.runtime.boxY = prevCenterY * geom.displayScale - deps.runtime.boxH / 2;

    redrawSourceCanvas(src, geom.dispImgW, geom.dispImgH);
    frame.style.width = `${Math.min(geom.dispImgW, MAX_EDITOR_WIDTH)}px`;
    frame.style.height = `${Math.min(geom.dispImgH, MAX_EDITOR_HEIGHT)}px`;

    if (state.image.mode === 'crop') {
      applyCropBoxToDom({
        runtime: deps.runtime,
        cropBox: deps.elements.cropBox,
        sourceFrame: frame,
        scrollIntoView: anchor.kind === 'box',
      });
    }
    if (anchor.kind === 'point') {
      frame.scrollLeft = anchorSx * geom.displayScale - anchorFx;
      frame.scrollTop = anchorSy * geom.displayScale - anchorFy;

      if (state.image.mode === 'crop') {
        nudgeCropBoxIntoView({ runtime: deps.runtime, sourceFrame: frame, margin: 0 });
      }
    }

    if (Math.abs(state.image.editorMaxZoom - geom.maxZoom) > 1e-4) {
      deps.store.dispatch(actions.imageSetEditorMaxZoom(geom.maxZoom));
    }
  }

  function getMaxEditorZoom(): number {
    if (!deps.runtime.loadedImg) return 1;
    const src = getActiveSource();
    return geometryFor(getState().image.editorZoom, src).geom.maxZoom;
  }

  async function resetEditor(): Promise<void> {
    const state = getState();
    if (state.image.rotation !== 0 || state.image.mirrorH || state.image.mirrorV) {
      buildRotatedSource(deps.runtime, state.image.rotation, state.image.mirrorH, state.image.mirrorV);
    }

    const src = getActiveSource();
    const { sourceW, sourceH, geom } = geometryFor(state.image.editorZoom, src);
    if (geom.clampedZoom !== state.image.editorZoom) {
      deps.store.dispatch(actions.imageSetEditorZoom(geom.clampedZoom));
    }
    deps.clearSnap();
    applyGeometry(src, sourceW, sourceH, geom, { kind: 'box' });
    rasterDirty = true;
    requestConvert();
  }

  function applyEditorZoom(targetZoom: number, anchorClientX?: number, anchorClientY?: number): void {
    if (!deps.runtime.loadedImg) return;
    const state = getState();
    const src = getActiveSource();
    const { sourceW, sourceH, geom } = geometryFor(targetZoom, src);
    if (geom.clampedZoom === state.image.editorZoom && deps.runtime.dispImgW === geom.dispImgW) return;

    const anchor: ScrollAnchor = anchorClientX !== undefined && anchorClientY !== undefined
      ? { kind: 'point', clientX: anchorClientX, clientY: anchorClientY }
      : { kind: 'box' };
    applyGeometry(src, sourceW, sourceH, geom, anchor);
    if (geom.clampedZoom !== state.image.editorZoom) {
      deps.store.dispatch(actions.imageSetEditorZoom(geom.clampedZoom));
    }
    rasterDirty = true;
    requestConvert();
  }

  async function autoLevels(): Promise<void> {
    if (!deps.runtime.loadedImg) return;

    const state = getState();
    const gen = ++deps.runtime.autoLevelsGen;
    const src = getActiveSource();
    const tempCanvas = createCanvas(state.device.targetW, state.device.targetH);
    const plan = currentRenderPlan(srcW(src), srcH(src));

    await renderImageBaseRaster({
      src,
      targetCanvas: tempCanvas,
      plan,
      fitBg: state.background,
      pica: deps.pica,
    });
    if (gen !== deps.runtime.autoLevelsGen) return;

    const region = getImageAnalysisRegion(plan, state.device.targetW, state.device.targetH);
    const px = getContext2d(tempCanvas).getImageData(region.x, region.y, region.width, region.height).data;
    const levels = computeAutoLevels(buildUintHistogram(buildLuminanceBuffer(px)), region.pixelCount);

    deps.store.dispatch(actions.imageSetBlackPoint(levels.blackPoint));
    deps.store.dispatch(actions.imageSetWhitePoint(levels.whitePoint));
    deps.store.dispatch(actions.imageSetGamma(1.0));
    requestConvert();
  }

  async function convert(): Promise<void> {
    if (!deps.runtime.loadedImg) return;

    processing = true;
    processRequested = false;

    const state = getState();

    if (rasterDirty || !deps.runtime.cachedBaseRaster) {
      const src = getActiveSource();
      const plan = currentRenderPlan(srcW(src), srcH(src));

      await renderImageBaseRaster({
        src,
        targetCanvas: deps.elements.workCanvas,
        plan,
        fitBg: state.background,
        pica: deps.pica,
      });

      deps.runtime.cachedBaseRaster = getContext2d(deps.elements.workCanvas).getImageData(
        0, 0, state.device.targetW, state.device.targetH,
      ).data;

      const sharedBuffer = new SharedArrayBuffer(deps.runtime.cachedBaseRaster.byteLength);
      new Uint8ClampedArray(sharedBuffer).set(deps.runtime.cachedBaseRaster);
      deps.runtime.sharedBufferVersion++;
      deps.worker.setBaseRaster(
        sharedBuffer,
        state.device.targetW,
        state.device.targetH,
        deps.runtime.sharedBufferVersion,
      );

      rasterDirty = false;
    }

    deps.runtime.processVersion++;
    deps.worker.process(
      {
        blackPoint: state.image.blackPoint,
        whitePoint: state.image.whitePoint,
        gammaValue: state.image.gammaValue,
        contrastValue: state.image.contrastValue,
        invert: state.image.invert,
        ditherEnabled: state.image.ditherEnabled,
        ditherMode: state.image.ditherMode,
      },
      deps.runtime.processVersion,
    );
  }

  async function refreshTransformedSource(): Promise<void> {
    if (!deps.runtime.loadedImg) return;
    const state = getState();
    buildRotatedSource(deps.runtime, state.image.rotation, state.image.mirrorH, state.image.mirrorV);
    await resetEditor();
  }

  function invalidateBaseRaster(): void {
    rasterDirty = true;
  }

  return {
    loadImageFile,
    unloadImage,
    resetEditor,
    autoLevels,
    requestConvert,
    invalidateBaseRaster,
    refreshTransformedSource,
    setRotation,
    setZoom,
    applyEditorZoom,
    getMaxEditorZoom,
    toggleMirrorH,
    toggleMirrorV,
  };
}

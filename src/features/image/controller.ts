import { actions, type AppAction } from '../../app/actions';
import {
  bumpImageSession,
  bumpSharedBufferVersion,
  clearBaseRaster,
  clearGeometry,
  commitBaseRaster,
  commitGeometry,
  setBoxPosition,
} from '../../app/runtime/imageRuntime';
import type { AppStore } from '../../app/store';
import type { ControllerHost } from '../../app/controllerHost';
import type { ImageRuntime } from '../../app/runtime/imageRuntime';
import type { OutputRuntime } from '../../app/runtime/outputRuntime';
import type { Rotation } from '../../app/state';
import { createCanvas, getContext2d } from '../../infra/canvas/context';
import type { PicaResizer } from '../../infra/canvas/picaResize';
import {
  buildImageRenderPlan,
  clampBoxForMode,
  clampBoxToDevice,
  computeEditorGeometry,
  getImageAnalysisRegion,
  type EditorGeometry,
  type ImageRenderPlan,
} from '../../domain/geometry';
import { buildUintHistogram } from '../../domain/histogram';
import { getQuantPreset } from '../../domain/quantize';
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
  notifyCropRegionChanged(): void;
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
  host: ControllerHost;
  clearSnap: () => void;
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
  let inFlightProcessSession: number | null = null;
  let autoLevelsRefreshTimer: number | null = null;

  const AUTO_LEVELS_REFRESH_MS = 200;

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
      boxX: deps.runtime.boxX,
      boxY: deps.runtime.boxY,
      boxW: deps.runtime.boxW,
      boxH: deps.runtime.boxH,
      fitSizePct: state.image.fitSizePct,
      fitNoUpscale: state.image.fitNoUpscale,
      fitLockNative: state.image.fitLockNative,
    });
  }

  function dispatchAndRetransform(action: AppAction): void {
    deps.store.dispatch(action);
    if (deps.runtime.loadedImg) void refreshTransformedSource();
  }

  function isCurrentSession(sessionVersion: number): boolean {
    return sessionVersion === deps.runtime.sessionVersion;
  }

  deps.worker.onResult((result) => {
    if (result.version !== deps.runtime.processVersion) return;
    if (inFlightProcessSession === null) return;
    if (!isCurrentSession(inFlightProcessSession)) return;

    const state = getState();
    deps.runtime.lastIndexedPixels = new Uint8Array(result.indexedPixels);
    deps.runtime.lastHistogram = new Float32Array(result.histogram);

    renderIndexedPreview(deps.elements.previewCanvas, deps.runtime.lastIndexedPixels, state.device.targetW, state.device.targetH);
    renderHistogram(deps.elements.histogramCanvas, deps.runtime.lastHistogram, state.device.totalPixels);
    deps.store.dispatch(actions.outputSetReady(true, true));

    processing = false;
    if (processRequested) scheduleNextConvert();
  });

  // Worker-side errors must reset the single-flight gate; otherwise `processing` stays true and
  // every subsequent slider tweak only sets `processRequested`, locking the convert pipeline.
  deps.worker.onError((error) => {
    // Stale failures (from a superseded version or an old session) are already irrelevant; ignore.
    if (error.version !== -1 && error.version !== deps.runtime.processVersion) return;
    if (inFlightProcessSession !== null && !isCurrentSession(inFlightProcessSession)) return;
    processing = false;
    inFlightProcessSession = null;
    deps.host.showError(`Image worker failed (${error.phase}): ${error.message}`);
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
    notifyCropRegionChanged();
    dispatchAndRetransform(actions.imageSetRotation(rotation));
  }

  function setZoom(zoom: number): void {
    deps.store.dispatch(actions.imageSetEditorZoom(zoom));
    if (deps.runtime.loadedImg) void resetEditor();
  }

  function toggleMirrorH(): void {
    notifyCropRegionChanged();
    if (deps.runtime.loadedImg && deps.runtime.dispImgW > 0) {
      setBoxPosition(deps.runtime, deps.runtime.dispImgW - deps.runtime.boxX - deps.runtime.boxW, deps.runtime.boxY);
    }
    dispatchAndRetransform(actions.imageToggleMirrorH());
  }

  function toggleMirrorV(): void {
    notifyCropRegionChanged();
    if (deps.runtime.loadedImg && deps.runtime.dispImgH > 0) {
      setBoxPosition(deps.runtime, deps.runtime.boxX, deps.runtime.dispImgH - deps.runtime.boxY - deps.runtime.boxH);
    }
    dispatchAndRetransform(actions.imageToggleMirrorV());
  }

  function unloadImage(): void {
    const nextSessionVersion = bumpImageSession(deps.runtime);
    if (deps.runtime.convertTimer !== null) {
      cancelAnimationFrame(deps.runtime.convertTimer);
      deps.runtime.convertTimer = null;
    }
    if (autoLevelsRefreshTimer !== null) {
      clearTimeout(autoLevelsRefreshTimer);
      autoLevelsRefreshTimer = null;
    }

    clearGeometry(deps.runtime);

    if (deps.runtime.loadedImg) {
      deps.runtime.loadedImg.src = '';
      deps.runtime.loadedImg = null;
    }

    clearBaseRaster(deps.runtime);
    deps.runtime.lastIndexedPixels = null;
    deps.runtime.autoLevelsGen++;
    rasterDirty = true;
    processing = false;
    processRequested = false;
    inFlightProcessSession = null;

    deps.elements.sourceCanvas.width = 1;
    deps.elements.sourceCanvas.height = 1;
    getContext2d(deps.elements.workCanvas).clearRect(0, 0, getState().device.targetW, getState().device.targetH);

    deps.host.resetSession();
    deps.store.dispatch(actions.imageResetAll());

    if (deps.runtime.rotatedSrc) {
      deps.runtime.rotatedSrc.width = 1;
      deps.runtime.rotatedSrc.height = 1;
      deps.runtime.rotatedSrc = null;
    }

    deps.clearSnap();
    deps.host.clearHistogramView();
  }

  async function loadImageFile(file: File): Promise<void> {
    deps.host.clearStatus();
    unloadImage();
    const sessionVersion = deps.runtime.sessionVersion;
    try {
      deps.store.dispatch(actions.outputSetBaseName(file.name.replace(/\.[^.]+$/, '')));
      deps.store.dispatch(actions.setLoadedType('image'));
      const image = await loadImageFromDataUrl(await readFileAsDataUrl(file));
      if (!isCurrentSession(sessionVersion)) return;
      deps.runtime.loadedImg = image;
      deps.store.dispatch(actions.imageSetSourceDims({
        width: deps.runtime.loadedImg.naturalWidth,
        height: deps.runtime.loadedImg.naturalHeight,
      }));
      await resetEditor(true);
    } catch (error) {
      if (!isCurrentSession(sessionVersion)) return;
      unloadImage();
      deps.host.showError(error instanceof Error ? error.message : 'Failed to load the selected input.');
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

  function applyGeometry(src: SourceImage, sourceW: number, sourceH: number, geom: EditorGeometry, anchor: ScrollAnchor, forceCenter?: boolean): void {
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

    const prevCenterX = forceCenter || deps.runtime.boxW === 0
      ? sourceW / 2
      : (deps.runtime.boxX + deps.runtime.boxW / 2) / oldDisplay;
    const prevCenterY = forceCenter || deps.runtime.boxH === 0
      ? sourceH / 2
      : (deps.runtime.boxY + deps.runtime.boxH / 2) / oldDisplay;

    const lockedBoxW = Math.min((state.device.targetW / geom.workScale) * geom.displayScale, geom.dispImgW);
    const lockedBoxH = Math.min((state.device.targetH / geom.workScale) * geom.displayScale, geom.dispImgH);
    let boxW = lockedBoxW;
    let boxH = lockedBoxH;
    if (state.image.mode !== 'crop') {
      const prevBoxSrcW = oldDisplay > 0 ? deps.runtime.boxW / oldDisplay : 0;
      const prevBoxSrcH = oldDisplay > 0 ? deps.runtime.boxH / oldDisplay : 0;
      if (prevBoxSrcW > 0 && prevBoxSrcH > 0) {
        const clamped = clampBoxForMode(state.image.mode, state.image.fitLockNative, {
          srcW: prevBoxSrcW,
          srcH: prevBoxSrcH,
          sourceW,
          sourceH,
          targetW: state.device.targetW,
          targetH: state.device.targetH,
        });
        boxW = clamped.srcW * geom.displayScale;
        boxH = clamped.srcH * geom.displayScale;
      } else if (state.image.fitLockNative) {
        // First-paint default for fit-locked-native: cap full-image box to device dims.
        const clamped = clampBoxToDevice({
          srcW: lockedBoxW / geom.displayScale,
          srcH: lockedBoxH / geom.displayScale,
          sourceW,
          sourceH,
          targetW: state.device.targetW,
          targetH: state.device.targetH,
        });
        boxW = clamped.srcW * geom.displayScale;
        boxH = clamped.srcH * geom.displayScale;
      }
    }
    commitGeometry(deps.runtime, {
      displayScale: geom.displayScale,
      workScale: geom.workScale,
      dispImgW: geom.dispImgW,
      dispImgH: geom.dispImgH,
      boxW,
      boxH,
      boxX: prevCenterX * geom.displayScale - boxW / 2,
      boxY: prevCenterY * geom.displayScale - boxH / 2,
    });

    redrawSourceCanvas(src, geom.dispImgW, geom.dispImgH);
    frame.style.width = `${Math.min(geom.dispImgW, MAX_EDITOR_WIDTH)}px`;
    frame.style.height = `${Math.min(geom.dispImgH, MAX_EDITOR_HEIGHT)}px`;

    applyCropBoxToDom({
      runtime: deps.runtime,
      cropBox: deps.elements.cropBox,
      sourceFrame: frame,
      scrollIntoView: anchor.kind === 'box',
    });
    if (anchor.kind === 'point') {
      frame.scrollLeft = anchorSx * geom.displayScale - anchorFx;
      frame.scrollTop = anchorSy * geom.displayScale - anchorFy;
      nudgeCropBoxIntoView({ runtime: deps.runtime, sourceFrame: frame, margin: 0 });
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

  async function resetEditor(forceCenter?: boolean): Promise<void> {
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
    applyGeometry(src, sourceW, sourceH, geom, { kind: 'box' }, forceCenter);
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
    notifyCropRegionChanged();
    requestConvert();
  }

  async function autoLevels(): Promise<void> {
    if (!deps.runtime.loadedImg) return;

    const state = getState();
    const sessionVersion = deps.runtime.sessionVersion;
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
    if (gen !== deps.runtime.autoLevelsGen || !isCurrentSession(sessionVersion)) return;

    const region = getImageAnalysisRegion(plan);
    const px = getContext2d(tempCanvas).getImageData(region.x, region.y, region.width, region.height).data;
    const levels = computeAutoLevels(buildUintHistogram(buildLuminanceBuffer(px)), region.pixelCount);

    deps.store.dispatch(actions.imageApplyAutoLevels(levels.blackPoint, levels.whitePoint, 1.0));
    requestConvert();
  }

  function notifyCropRegionChanged(): void {
    if (!getState().image.autoLevelsApplied) return;
    if (autoLevelsRefreshTimer !== null) clearTimeout(autoLevelsRefreshTimer);
    autoLevelsRefreshTimer = setTimeout(() => {
      autoLevelsRefreshTimer = null;
      if (!getState().image.autoLevelsApplied) return;
      void autoLevels();
    }, AUTO_LEVELS_REFRESH_MS) as unknown as number;
  }

  async function convert(): Promise<void> {
    if (!deps.runtime.loadedImg) return;

    processing = true;
    processRequested = false;

    const state = getState();
    const sessionVersion = deps.runtime.sessionVersion;

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
      if (!isCurrentSession(sessionVersion)) return;

      const baseRaster = getContext2d(deps.elements.workCanvas).getImageData(
        0, 0, state.device.targetW, state.device.targetH,
      ).data;
      commitBaseRaster(deps.runtime, baseRaster);

      const sharedBuffer = new SharedArrayBuffer(baseRaster.byteLength);
      new Uint8ClampedArray(sharedBuffer).set(baseRaster);
      const sharedBufferVersion = bumpSharedBufferVersion(deps.runtime);
      deps.worker.setBaseRaster(
        sharedBuffer,
        state.device.targetW,
        state.device.targetH,
        sharedBufferVersion,
      );

      rasterDirty = false;
    }

    inFlightProcessSession = sessionVersion;
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
        quantPreset: getQuantPreset(),
      },
      deps.runtime.processVersion,
    );
  }

  async function refreshTransformedSource(): Promise<void> {
    if (!deps.runtime.loadedImg) return;
    const state = getState();
    buildRotatedSource(deps.runtime, state.image.rotation, state.image.mirrorH, state.image.mirrorV);
    await resetEditor(false);
  }

  function invalidateBaseRaster(): void {
    rasterDirty = true;
  }

  return {
    loadImageFile,
    unloadImage,
    resetEditor,
    autoLevels,
    notifyCropRegionChanged,
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

import type { AppStore } from '../app/store';
import type { AppDom } from './dom';
import { setupCropInteraction } from './cropInteraction';
import { setBoxPosition, setBoxSize, type ImageRuntime } from '../app/runtime/imageRuntime';
import { applyCropBoxToDom, nudgeCropBoxIntoView as nudgeCropBox } from '../features/image/cropBox';
import { clampBoxToDevice, clampBoxToSource } from '../domain/geometry';

const SNAP_THRESHOLD = 9;
const WHEEL_ZOOM_K = 0.0015;

type CropWiringDeps = {
  store: AppStore;
  dom: AppDom;
  runtime: ImageRuntime;
  scheduleConvert: () => void;
  invalidateBaseRaster: () => void;
  applyEditorZoom: (targetZoom: number, anchorClientX?: number, anchorClientY?: number) => void;
  notifyCropRegionChanged: () => void;
};

export function setupImageCropInteraction(deps: CropWiringDeps): { clearSnap: () => void } {
  function getRotatedSourceDims(): { w: number; h: number } {
    const state = deps.store.getState();
    const dims = state.image.sourceDims;
    if (!dims) return { w: 0, h: 0 };
    const rotated = state.image.rotation === 90 || state.image.rotation === 270;
    return rotated ? { w: dims.height, h: dims.width } : { w: dims.width, h: dims.height };
  }

  return setupCropInteraction({
    cropBox: deps.dom.cropBox,
    cropHandles: deps.dom.cropHandles,
    sourceCanvas: deps.dom.sourceCanvas,
    sourceFrame: deps.dom.sourceFrame,
    snapGuideH: deps.dom.snapGuideH,
    snapGuideV: deps.dom.snapGuideV,
    snapThreshold: SNAP_THRESHOLD,
    wheelZoomK: WHEEL_ZOOM_K,
    isImageLoaded: () => deps.store.getState().loadedType === 'image',
    getEditorZoom: () => deps.store.getState().image.editorZoom,
    applyEditorZoom: deps.applyEditorZoom,
    getMode: () => deps.store.getState().image.mode,
    getBoxState: () => {
      const state = deps.store.getState();
      const { w: sourceW, h: sourceH } = getRotatedSourceDims();
      return {
        dispImgW: deps.runtime.dispImgW,
        dispImgH: deps.runtime.dispImgH,
        boxW: deps.runtime.boxW,
        boxH: deps.runtime.boxH,
        boxX: deps.runtime.boxX,
        boxY: deps.runtime.boxY,
        displayScale: deps.runtime.displayScale,
        sourceW,
        sourceH,
        targetW: state.device.targetW,
        targetH: state.device.targetH,
      };
    },
    clampBox: params => {
      const mode = deps.store.getState().image.mode;
      if (mode === 'one-to-one') return clampBoxToDevice(params);
      // 'crop' mode disables resize handles, so this is reached only for 'fit' (and the
      // defensive 'crop' fallthrough that never fires in practice).
      return clampBoxToSource(params);
    },
    setBoxPosition: (x, y) => setBoxPosition(deps.runtime, x, y),
    setBoxSize: (w, h) => setBoxSize(deps.runtime, w, h),
    applyCropBox: scrollIntoView => applyCropBoxToDom({
      runtime: deps.runtime,
      cropBox: deps.dom.cropBox,
      sourceFrame: deps.dom.sourceFrame,
      scrollIntoView,
    }),
    nudgeCropBoxIntoView: margin => nudgeCropBox({
      runtime: deps.runtime,
      sourceFrame: deps.dom.sourceFrame,
      margin,
    }),
    scheduleConvert: () => {
      deps.invalidateBaseRaster();
      deps.scheduleConvert();
    },
    onCropRegionChanged: deps.notifyCropRegionChanged,
  });
}

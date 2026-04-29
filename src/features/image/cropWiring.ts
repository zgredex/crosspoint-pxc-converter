import type { AppStore } from '../../app/store';
import type { AppDom } from '../../ui/dom';
import { setupCropInteraction } from '../../ui/cropInteraction';
import type { ImageRuntime } from '../../app/runtime/imageRuntime';
import { applyCropBoxToDom, nudgeCropBoxIntoView as nudgeCropBox } from './cropBox';

const SNAP_THRESHOLD = 9;
const WHEEL_ZOOM_K = 0.0015;

type CropWiringDeps = {
  store: AppStore;
  dom: AppDom;
  runtime: ImageRuntime;
  scheduleConvert: () => void;
  invalidateBaseRaster: () => void;
  applyEditorZoom: (targetZoom: number, anchorClientX?: number, anchorClientY?: number) => void;
};

export function setupImageCropInteraction(deps: CropWiringDeps): { clearSnap: () => void } {
  return setupCropInteraction({
    cropBox: deps.dom.cropBox,
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
    getBoxState: () => ({
      dispImgW: deps.runtime.dispImgW,
      dispImgH: deps.runtime.dispImgH,
      boxW: deps.runtime.boxW,
      boxH: deps.runtime.boxH,
      boxX: deps.runtime.boxX,
      boxY: deps.runtime.boxY,
    }),
    setBoxPosition: (x, y) => {
      deps.runtime.boxX = x;
      deps.runtime.boxY = y;
    },
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
  });
}

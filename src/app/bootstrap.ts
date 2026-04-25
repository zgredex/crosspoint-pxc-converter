import { actions } from './actions';
import { createLoaderRouter } from './loaderRouter';
import { clearStatus, showError } from './messages';
import { createGbRuntime } from './runtime/gbRuntime';
import { createImageRuntime } from './runtime/imageRuntime';
import { createOutputRuntime } from './runtime/outputRuntime';
import { store } from './store';
import { validateGbBytes } from './validation';
import { DEFAULT_XT, DEVICES } from '../domain/devices';
import { triggerDownload } from '../infra/browser/downloads';
import { renderHistogram, resizeHistogramCanvas } from '../infra/canvas/histogramRenderer';
import { createPicaResizer } from '../infra/canvas/picaResize';
import { applyCropBoxToDom } from '../features/image/cropBox';
import { createGbController } from '../features/gb/controller';
import { createImageController } from '../features/image/controller';
import type { GbController } from '../features/gb/controller';
import type { ImageController } from '../features/image/controller';
import { bindStoreControls } from '../ui/bindings';
import { setupCropInteraction } from '../ui/cropInteraction';
import { bindDownloadButtons } from '../ui/downloadButtons';
import { dom } from '../ui/dom';
import { bindFileInput } from '../ui/fileInput';
import { bindGbScaleControls } from '../ui/gbControls';
import { bindImageControls } from '../ui/imageControls';
import { setupPreviewZoom } from '../ui/previewZoom';
import { renderStoreState } from '../ui/render';
import { bindRotationControls } from '../ui/rotationControls';
import { bindZoomControls } from '../ui/zoomControls';

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

const SNAP_THRESHOLD = 9;

const imageRuntime = createImageRuntime();
const gbRuntime = createGbRuntime();
const outputRuntime = createOutputRuntime();
let imageController!: ImageController;
let gbController!: GbController;
const ZOOM_STEPS  = [0.5, 0.75, 1, 1.5, 2, 3, 4];

function getAppState() {
  return store.getState();
}

renderStoreState(dom, getAppState());
store.subscribe(() => {
  renderStoreState(dom, getAppState());
});

function clearHistogramView(): void {
  imageRuntime.lastHistogram = null;
  if (histogramCanvas.width) {
    getContext2d(histogramCanvas).clearRect(0, 0, histogramCanvas.width, histogramCanvas.height);
  }
}

const {
  editorSection,
  sourceFrame,
  sourceCanvas,
  cropBox,
  snapGuideH,
  snapGuideV,
  previewCanvas,
  workCanvas,
  downloadGroup,
  histogramCanvas,
  zoomBox,
  zoomCanvas,
} = dom;

function applyCropBox(): void {
  applyCropBoxToDom({ runtime: imageRuntime, cropBox, sourceFrame });
}

const { clearSnap } = setupCropInteraction({
  cropBox,
  sourceCanvas,
  snapGuideH,
  snapGuideV,
  snapThreshold: SNAP_THRESHOLD,
  getMode: () => getAppState().image.mode,
  getBoxState: () => ({
    dispImgW: imageRuntime.dispImgW,
    dispImgH: imageRuntime.dispImgH,
    boxW: imageRuntime.boxW,
    boxH: imageRuntime.boxH,
    boxX: imageRuntime.boxX,
    boxY: imageRuntime.boxY,
  }),
  setBoxPosition: (x, y) => {
    imageRuntime.boxX = x;
    imageRuntime.boxY = y;
  },
  applyCropBox,
  scheduleConvert: imageController.requestConvert,
});

// Histogram

function drawHistogram(): void {
  renderHistogram(histogramCanvas, imageRuntime.lastHistogram, getAppState().device.totalPixels);
}

window.addEventListener('resize', () => {
  resizeHistogramCanvas(histogramCanvas);
  drawHistogram();
});

const picaInstance = createPicaResizer();

imageController = createImageController({
  store,
  dom,
  runtime: imageRuntime,
  output: outputRuntime,
  pica: picaInstance,
  clearStatus: () => clearStatus(store),
  showError: message => showError(store, message),
  clearHistogramView,
  clearSnap,
});

gbController = createGbController({
  store,
  dom,
  runtime: gbRuntime,
  output: outputRuntime,
  clearStatus: () => clearStatus(store),
  showError: message => showError(store, message),
  clearHistogramView,
  validateGbBytes,
});

const loaderRouter = createLoaderRouter({
  imageController,
  gbController,
});

bindStoreControls(dom, {
  store,
  scheduleConvert: imageController.requestConvert,
  rebuildGammaLUT: imageController.rebuildGammaLut,
  autoLevels: imageController.autoLevels,
  onDeviceChanged: () => {
    const state = getAppState();
    workCanvas.width = state.device.targetW;
    workCanvas.height = state.device.targetH;
    previewCanvas.width = state.device.targetW;
    previewCanvas.height = state.device.targetH;
    if (imageRuntime.loadedImg) void imageController.resetEditor();
    else if (state.loadedType === 'gb') gbController.buildOutput();
    else {
      downloadGroup.classList.remove('visible');
      outputRuntime.pxcBytes = null;
      outputRuntime.bmpBytes = null;
    }
  },
  onImageLayoutChanged: () => {
    if (imageRuntime.loadedImg) void imageController.resetEditor();
  },
  onGbVisualChanged: () => {
    if (gbRuntime.pixels) {
      gbController.refreshVisuals();
    }
  },
});
const ZOOM_BOX   = 260;
const ZOOM_SRC   = 72;

setupPreviewZoom({
  previewCanvas,
  zoomBox,
  zoomCanvas,
  zoomBoxSize: ZOOM_BOX,
  zoomSourceSize: ZOOM_SRC,
  canShow: () => Boolean(outputRuntime.pxcBytes),
  getTargetSize: () => {
    const state = getAppState();
    return { width: state.device.targetW, height: state.device.targetH };
  },
});

bindRotationControls({
  dom,
  getLoadedType: () => getAppState().loadedType,
  getImageRotation: () => getAppState().image.rotation,
  getGbRotation: () => getAppState().gb.rotation,
  onRotateImage: imageController.setRotation,
  onRotateGb: gbController.setRotation,
});

bindZoomControls({
  dom,
  getLoadedType: () => getAppState().loadedType,
  getEditorZoom: () => getAppState().image.editorZoom,
  zoomSteps: ZOOM_STEPS,
  getGbRenderedScale: () => gbRuntime.renderedScale,
  onImageZoom: imageController.setZoom,
  onGbZoom: gbController.setZoom,
});

bindFileInput({
  dom,
  loadFile: loaderRouter.loadFile,
  loadPrinterText: text => gbController.loadPrinterText(text),
});

bindImageControls({
  dom,
  getLoadedType: () => getAppState().loadedType,
  onUnloadImage: imageController.unloadImage,
  onUnloadGb: gbController.unloadGb,
  onToggleMirrorH: imageController.toggleMirrorH,
  onToggleMirrorV: imageController.toggleMirrorV,
});

bindGbScaleControls({
  dom,
  onScaleUp: gbController.scaleUp,
  onScaleDown: gbController.scaleDown,
});

bindDownloadButtons({
  dom,
  onDownloadPxc: () => {
    if (outputRuntime.pxcBytes) {
      triggerDownload(outputRuntime.pxcBytes, `${outputRuntime.outputBaseName}.pxc`, 'application/octet-stream');
    }
  },
  onDownloadBmp: () => {
    if (outputRuntime.bmpBytes) {
      triggerDownload(outputRuntime.bmpBytes, `${outputRuntime.outputBaseName}.bmp`, 'image/bmp');
    }
  },
});

imageController.rebuildGammaLut();

import { createAppController } from './appController';
import { createLoaderRouter } from './loaderRouter';
import { clearStatus, showError } from './messages';
import { createGbRuntime } from './runtime/gbRuntime';
import { createImageRuntime } from './runtime/imageRuntime';
import { createOutputRuntime } from './runtime/outputRuntime';
import { store } from './store';
import { validateGbBytes } from './validation';
import { clearHistogram, mountHistogramAutoResize } from '../infra/canvas/histogramRenderer';
import { createPicaResizer } from '../infra/canvas/picaResize';
import { createGbController } from '../features/gb/controller';
import { createImageController } from '../features/image/controller';
import { setupImageCropInteraction } from '../features/image/cropWiring';
import type { GbController } from '../features/gb/controller';
import type { ImageController } from '../features/image/controller';
import { bindStoreControls } from '../ui/bindings';
import { bindDownloadButtons } from '../ui/downloadButtons';
import { createDom } from '../ui/dom';
import { bindFileInput } from '../ui/fileInput';
import { bindGbScaleControls } from '../ui/gbControls';
import { bindImageControls } from '../ui/imageControls';
import { setupPreviewZoom } from '../ui/previewZoom';
import { renderStoreState } from '../ui/render';
import { bindRotationControls } from '../ui/rotationControls';
import { bindZoomControls } from '../ui/zoomControls';

const dom = createDom();
const imageRuntime = createImageRuntime();
const gbRuntime = createGbRuntime();
const outputRuntime = createOutputRuntime();
let imageController!: ImageController;
let gbController!: GbController;
let appController!: ReturnType<typeof createAppController>;

function render(): void {
  renderStoreState(dom, store.getState());
}

store.subscribe(render);

const {
  histogramCanvas,
  previewCanvas,
  zoomBox,
  zoomCanvas,
} = dom;

function clearHistogramView(): void {
  clearHistogram(histogramCanvas, imageRuntime);
}

const picaInstance = createPicaResizer();

const { clearSnap } = setupImageCropInteraction({
  store,
  dom,
  runtime: imageRuntime,
  scheduleConvert: delay => imageController.requestConvert(delay),
});

mountHistogramAutoResize({
  canvas: histogramCanvas,
  getHistogram: () => imageRuntime.lastHistogram,
  getTotalPixels: () => store.getState().device.totalPixels,
});

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

appController = createAppController({
  store,
  dom,
  imageRuntime,
  gbRuntime,
  output: outputRuntime,
  imageController,
  gbController,
});

const loaderRouter = createLoaderRouter({
  imageController,
  gbController,
});

bindStoreControls(dom, {
  store,
  appController,
  scheduleConvert: imageController.requestConvert,
  autoLevels: imageController.autoLevels,
});

setupPreviewZoom({
  store,
  output: outputRuntime,
  previewCanvas,
  zoomBox,
  zoomCanvas,
});

bindRotationControls({
  dom,
  onRotate: appController.rotateActive,
});

bindZoomControls({
  dom,
  onZoom: appController.zoomActive,
});

bindFileInput({
  dom,
  loadFile: loaderRouter.loadFile,
  loadPrinterText: gbController.loadPrinterText,
});

bindImageControls({
  dom,
  onUnloadActive: appController.unloadActive,
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
  onDownloadPxc: appController.downloadPxc,
  onDownloadBmp: appController.downloadBmp,
});

render();

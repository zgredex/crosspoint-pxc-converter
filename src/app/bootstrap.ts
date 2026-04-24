import { actions } from './actions';
import { store } from './store';
import { DEFAULT_XT, DEVICES } from '../domain/devices';
import { fitOffset, type FitAlign } from '../domain/geometry';
import { decode2bpp } from '../domain/gb/decode2bpp';
import { parsePrinterTxt } from '../domain/gb/parsePrinterTxt';
import { rotatePixels } from '../domain/gb/rotatePixels';
import { buildUintHistogram } from '../domain/histogram';
import { buildGammaLut, buildLuminanceBuffer, computeAutoLevels } from '../domain/tone';
import { getPastedImageFile, getPastedText } from '../infra/browser/clipboard';
import { triggerDownload } from '../infra/browser/downloads';
import { loadImageFromDataUrl, readFileAsArrayBuffer, readFileAsDataUrl, readFileAsText } from '../infra/browser/imageLoader';
import { renderGbSourceCanvas } from '../infra/canvas/gbSourceRenderer';
import { renderHistogram, resizeHistogramCanvas } from '../infra/canvas/histogramRenderer';
import { createPicaResizer, resizeWithPica } from '../infra/canvas/picaResize';
import { renderIndexedPreview } from '../infra/canvas/previewRenderer';
import { buildGbFileInfo, buildGbOutputArtifacts, buildGbSourceView } from '../features/gb/service';
import { buildImageOutputs } from '../features/image/service';
import { bindStoreControls } from '../ui/bindings';
import { setupCropInteraction } from '../ui/cropInteraction';
import { dom } from '../ui/dom';
import { setupPreviewZoom } from '../ui/previewZoom';
import { renderStoreState } from '../ui/render';
import type { DitherMode } from '../domain/dither';
import type { GbPaletteKey } from '../domain/formats/bmpGb';
import type { FitBackground, LoadedType, Rotation } from './state';

type SourceImage = HTMLImageElement | HTMLCanvasElement;

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

function getPanelSection(element: Element): HTMLElement {
  const section = element.closest('.panel-section');
  if (!(section instanceof HTMLElement)) throw new Error('Expected panel section element');
  return section;
}

let targetW = DEVICES[DEFAULT_XT].w;
let targetH = DEVICES[DEFAULT_XT].h;
let totalPixels = targetW * targetH;

const MAX_EDITOR_W = 340;
const MAX_EDITOR_H = 520;
const SNAP_THRESHOLD = 9;

let loadedImg: HTMLImageElement | null = null;
let rotatedSrc: HTMLCanvasElement | null = null;   // offscreen canvas holding rotated image, or null when rotation=0
let pxcBytes: Uint8Array | null = null;   // Uint8Array — pxc file bytes
let bmpBytes: Uint8Array | null = null;   // Uint8Array — bmp file bytes
let outputBaseName = 'sleep';
let mode: 'crop' | 'fit' = 'crop';
let fitAlign: FitAlign = 'mc';
let fitBg: FitBackground = 'white';
let contrastValue = 0;
let blackPoint    = 0;
let whitePoint    = 255;
let gammaValue    = 1.0;  // 1.0 = no adjustment; > 1 lifts shadows, < 1 compresses them
let gammaLUT: Float32Array | null = null; // Float32Array(256), rebuilt whenever gammaValue changes
let invert        = false;
let ditherEnabled = true;   // when false, pixels are quantized directly with no error diffusion
let ditherMode: DitherMode = 'fs';   // 'fs' = Floyd-Steinberg, 'atk' = Atkinson
let rotation: Rotation = 0;      // 0, 90, 180, 270
let mirrorH       = false;
let mirrorV       = false;

let loadedType: LoadedType = null;   // 'image' | 'gb' | null

// GB 2BPP state
let gbRawBytes: Uint8Array | null = null;   // Uint8Array — raw 2BPP bytes
let gbPixels: Uint8Array | null = null;   // Uint8Array — decoded GB color indices (0–3)
let gbW = 0, gbH = 0;
let gbBmpBytes: Uint8Array | null = null;   // native-palette BMP bytes (GB colors)
let gbPaletteKey: GbPaletteKey = 'dmg';
let gbInvert      = false;
let gbPalletShades: number[] | null = null;  // null = identity palette remapping
let gbRotation: Rotation = 0;      // 0 | 90 | 180 | 270
let gbZoom        = 0;      // 0 = auto; 1–6 = explicit integer scale
let gbRenderedScale = 1;    // last scale used in drawGbSource, for zoom step math
let gbOutputScale = 1;      // integer multiplier applied to output canvas (pixel-perfect)

let displayScale = 1;
let workScale    = 1;
let dispImgW = 0, dispImgH = 0;
let boxW = 0, boxH = 0, boxX = 0, boxY = 0;

let editorZoom    = 1.0;
const ZOOM_STEPS  = [0.5, 0.75, 1, 1.5, 2, 3, 4];

let lastHistogram: Float32Array | null = null;

let convertTimer: ReturnType<typeof setTimeout> | null = null;
let convertGen   = 0;

function syncRuntimeState() {
  const state = store.getState();

  loadedType = state.loadedType;

  targetW = state.device.targetW;
  targetH = state.device.targetH;
  totalPixels = state.device.totalPixels;

  mode = state.image.mode;
  fitAlign = state.image.fitAlign;
  fitBg = state.image.fitBg;
  contrastValue = state.image.contrastValue;
  blackPoint = state.image.blackPoint;
  whitePoint = state.image.whitePoint;
  gammaValue = state.image.gammaValue;
  invert = state.image.invert;
  ditherEnabled = state.image.ditherEnabled;
  ditherMode = state.image.ditherMode;
  rotation = state.image.rotation;
  mirrorH = state.image.mirrorH;
  mirrorV = state.image.mirrorV;
  editorZoom = state.image.editorZoom;

  gbPaletteKey = state.gb.paletteKey;
  gbInvert = state.gb.invert;
  gbRotation = state.gb.rotation;
  gbZoom = state.gb.zoom;
  gbOutputScale = state.gb.outputScale;
}

function syncStoreUi() {
  syncRuntimeState();
  renderStoreState(dom, store.getState());
}

syncStoreUi();
store.subscribe(syncStoreUi);

function clearStatus(): void {
  store.dispatch(actions.uiClearMessage());
}

function showError(message: string): void {
  store.dispatch(actions.uiSetMessage('error', message));
}

function clearHistogramView(): void {
  lastHistogram = null;
  if (histogramCanvas.width) {
    getContext2d(histogramCanvas).clearRect(0, 0, histogramCanvas.width, histogramCanvas.height);
  }
}

function validateGbBytes(bytes: Uint8Array, sourceLabel: string): void {
  if (bytes.length === 0) {
    throw new Error(`${sourceLabel} did not contain any GB tile bytes.`);
  }
  if (bytes.length < 16) {
    throw new Error(`${sourceLabel} must contain at least one 16-byte tile.`);
  }
}

const {
  dropZone,
  fileInput,
  editorSection,
  sourceFrame,
  sourceCanvas,
  sourceLabel,
  changeBtn,
  cropBox,
  snapGuideH,
  snapGuideV,
  posSection,
  contrastSlider,
  contrastValEl,
  contrastReset,
  blackSlider,
  blackValEl,
  whiteSlider,
  whiteValEl,
  toneReset,
  autoLevelsBtn,
  gammaSlider,
  gammaValEl,
  rotateCWBtn,
  rotateCCWBtn,
  rotateValEl,
  mirrorHBtn,
  mirrorVBtn,
  invertToggle,
  ditherToggle,
  ditherAlgos,
  previewCanvas,
  workCanvas,
  downloadGroup,
  downloadPxcBtn,
  downloadBmpBtn,
  zoomInBtn,
  zoomOutBtn,
  zoomLabelEl,
  histogramCanvas,
  gbCanvas,
  gbScaleUpBtn,
  gbScaleDownBtn,
  gbScaleVal,
  gbInvertToggle,
  zoomBox,
  zoomCanvas,
} = dom;

// Rotation — branches on loadedType to avoid duplicate listener issue
rotateCWBtn.addEventListener('click', () => {
  if (loadedType === 'gb') {
    store.dispatch(actions.gbSetRotation(((gbRotation + 90) % 360) as Rotation));
    rotateValEl.textContent = gbRotation + '°';
    if (gbPixels) { drawGbSource(); buildGbOutput(); }
  } else {
    applyRotation(((rotation + 90) % 360) as Rotation);
  }
});
rotateCCWBtn.addEventListener('click', () => {
  if (loadedType === 'gb') {
    store.dispatch(actions.gbSetRotation(((gbRotation + 270) % 360) as Rotation));
    rotateValEl.textContent = gbRotation + '°';
    if (gbPixels) { drawGbSource(); buildGbOutput(); }
  } else {
    applyRotation(((rotation + 270) % 360) as Rotation);
  }
});

function applyRotation(deg: Rotation): void {
  store.dispatch(actions.imageSetRotation(deg));
  rotateValEl.textContent = deg + '°';
  if (loadedImg) { buildRotatedSrc(); resetEditor(); }
}

// Mirror
mirrorHBtn.addEventListener('click', () => {
  store.dispatch(actions.imageToggleMirrorH());
  mirrorHBtn.classList.toggle('active', mirrorH);
  if (loadedImg) { buildRotatedSrc(); resetEditor(); }
});
mirrorVBtn.addEventListener('click', () => {
  store.dispatch(actions.imageToggleMirrorV());
  mirrorVBtn.classList.toggle('active', mirrorV);
  if (loadedImg) { buildRotatedSrc(); resetEditor(); }
});

// Build an offscreen canvas with rotation and mirror applied.
// Width/height swap on 90°/270° so the output always has the rotated dimensions.
function buildRotatedSrc(): void {
  if (!loadedImg) return;
  const sw = loadedImg.naturalWidth, sh = loadedImg.naturalHeight;
  const rw = (rotation % 180 === 0) ? sw : sh;
  const rh = (rotation % 180 === 0) ? sh : sw;
  if (!rotatedSrc) rotatedSrc = createCanvas(rw, rh);
  rotatedSrc.width = rw; rotatedSrc.height = rh;
  const tc = getContext2d(rotatedSrc);
  tc.clearRect(0, 0, rw, rh);
  tc.save();
  tc.translate(rw / 2, rh / 2);
  tc.rotate(rotation * Math.PI / 180);
  if (mirrorH) tc.scale(-1,  1);
  if (mirrorV) tc.scale( 1, -1);
  tc.drawImage(loadedImg, -sw / 2, -sh / 2);
  tc.restore();
}

// Returns the effective source image/canvas after rotation/mirror.
function getSource(): SourceImage {
  if (!loadedImg) throw new Error('Source image is not loaded');
  if (rotation === 0 && !mirrorH && !mirrorV) return loadedImg;
  if (!rotatedSrc) throw new Error('Rotated source is not available');
  return rotatedSrc;
}
function srcW(source: SourceImage): number { return source instanceof HTMLImageElement ? source.naturalWidth : source.width; }
function srcH(source: SourceImage): number { return source instanceof HTMLImageElement ? source.naturalHeight : source.height; }

function rebuildGammaLUT() {
  gammaLUT = buildGammaLut(gammaValue);
}

// Change / unload image
changeBtn.addEventListener('click', unloadImage);

// Zoom controls
function applyZoom(z: number): void {
  store.dispatch(actions.imageSetEditorZoom(z));
  zoomLabelEl.textContent = z + '×';
  if (loadedImg) resetEditor();
}
zoomInBtn.addEventListener('click', () => {
  if (loadedType === 'gb') {
    store.dispatch(actions.gbSetZoom(Math.min(6, gbRenderedScale + 1)));
    if (gbPixels) drawGbSource();
  } else {
    const idx = ZOOM_STEPS.indexOf(editorZoom);
    if (idx < ZOOM_STEPS.length - 1) applyZoom(ZOOM_STEPS[idx + 1]);
  }
});
zoomOutBtn.addEventListener('click', () => {
  if (loadedType === 'gb') {
    store.dispatch(actions.gbSetZoom(Math.max(1, gbRenderedScale - 1)));
    if (gbPixels) drawGbSource();
  } else {
    const idx = ZOOM_STEPS.indexOf(editorZoom);
    if (idx > 0) applyZoom(ZOOM_STEPS[idx - 1]);
  }
});

function unloadImage() {
  if (loadedType === 'gb') { unloadGb(); return; }
  clearStatus();
  store.dispatch(actions.setLoadedType(null));
  if (convertTimer !== null) clearTimeout(convertTimer);

  // Release decoded bitmap from browser memory
  if (loadedImg) { loadedImg.src = ''; loadedImg = null; }

  // Release encoded output buffers
  pxcBytes = null;
  bmpBytes = null;

  // Free canvas pixel buffers by resizing to 1×1
  sourceCanvas.width = 1; sourceCanvas.height = 1;
  getContext2d(workCanvas).clearRect(0, 0, targetW, targetH);
  getContext2d(previewCanvas).clearRect(0, 0, targetW, targetH);

  // Reset file input so the same file can be re-picked
  fileInput.value = '';

  // Reset state
  outputBaseName = 'sleep';
  store.dispatch(actions.imageResetAll());
  if (rotatedSrc) { rotatedSrc.width = 1; rotatedSrc.height = 1; rotatedSrc = null; }
  rotateValEl.textContent = '0°';
  mirrorHBtn.classList.remove('active');
  mirrorVBtn.classList.remove('active');
  invertToggle.checked = false;
  ditherToggle.checked = true; ditherAlgos.classList.remove('disabled');
  contrastSlider.value = '0';
  contrastValEl.textContent = '0';
  blackSlider.value = '0';
  whiteSlider.value = '255';
  blackValEl.textContent = '0';
  whiteValEl.textContent = '255';
  gammaSlider.value = '100';
  gammaValEl.textContent = '1.00';
  rebuildGammaLUT();
  clearSnap();

  // Reset zoom
  zoomLabelEl.textContent = '1×';

  // Clear histogram
  clearHistogramView();

  // Restore UI
  dropZone.style.display = '';
  editorSection.classList.remove('visible');
  posSection.classList.add('disabled');
  downloadGroup.classList.remove('visible');
}

function unloadGb() {
  clearStatus();
  if (convertTimer !== null) clearTimeout(convertTimer);
  gbCanvas.width = 1;
  gbCanvas.height = 1;
  gbRawBytes = gbPixels = gbBmpBytes = null;
  gbPalletShades = null;
  store.dispatch(actions.gbResetAll());
  rotateValEl.textContent = '0°';
  gbScaleVal.textContent = '1×';
  store.dispatch(actions.setLoadedType(null));
  hideGbUI();
  getContext2d(previewCanvas).clearRect(0, 0, targetW, targetH);
  downloadGroup.classList.remove('visible');
  fileInput.value = '';
  pxcBytes = null;
  dropZone.style.display = '';
  editorSection.classList.remove('visible');
}

// XTeink device selection
// Drop / browse
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault(); dropZone.classList.remove('over');
  const f = e.dataTransfer?.files[0];
  if (f) void loadFile(f);
});
fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (file) void loadFile(file);
});

async function loadFile(file: File): Promise<void> {
  clearStatus();
  unloadImage();
  try {
    const name = file.name.toLowerCase();
    const isGb = /\.(2bpp|bin|gb|txt)$/i.test(name);
    outputBaseName = file.name.replace(/\.[^.]+$/, '');

    if (isGb) {
      store.dispatch(actions.setLoadedType('gb'));
      const isTxt = /\.txt$/i.test(name);
      if (isTxt) {
        const parsed = parsePrinterTxt(await readFileAsText(file));
        validateGbBytes(parsed.bytes, 'GB Printer text log');
        gbRawBytes = parsed.bytes;
        gbPalletShades = parsed.palletShades;
        initGb();
      } else {
        gbRawBytes = new Uint8Array(await readFileAsArrayBuffer(file));
        validateGbBytes(gbRawBytes, 'Game Boy binary');
        gbPalletShades = null;
        initGb();
      }
    } else {
      store.dispatch(actions.setLoadedType('image'));
      loadedImg = await loadImageFromDataUrl(await readFileAsDataUrl(file));
      await resetEditor();
    }
  } catch (error) {
    unloadImage();
    showError(error instanceof Error ? error.message : 'Failed to load the selected input.');
  }
}

async function loadPastedPrinterLog(text: string): Promise<void> {
  clearStatus();
  unloadImage();
  try {
    outputBaseName = 'pasted-printer-log';
    store.dispatch(actions.setLoadedType('gb'));
    const parsed = parsePrinterTxt(text);
    validateGbBytes(parsed.bytes, 'Pasted GB Printer text');
    gbRawBytes = parsed.bytes;
    gbPalletShades = parsed.palletShades;
    initGb();
  } catch (error) {
    unloadImage();
    showError(error instanceof Error ? error.message : 'Failed to parse pasted GB Printer text.');
  }
}

async function resetEditor(): Promise<void> {
  if (rotation !== 0 || mirrorH || mirrorV) buildRotatedSrc();
  const src = getSource();
  const sw = srcW(src), sh = srcH(src);

  // Fit image within editor bounds, then apply user zoom
  const baseScale = Math.min(MAX_EDITOR_W / sw, MAX_EDITOR_H / sh);
  displayScale = Math.min(baseScale * editorZoom, 1.0);
  dispImgW = Math.round(sw * displayScale);
  dispImgH = Math.round(sh * displayScale);

  workScale = mode === 'crop'
    ? Math.max(targetW / sw, targetH / sh)
    : Math.min(targetW / sw, targetH / sh);

  // Preserve the crop centre in source-image coordinates across device switches.
  // On first load (boxW === 0) just centre; otherwise anchor to the same content.
  const prevCX = boxW > 0 ? (boxX + boxW / 2) / displayScale : sw / 2;
  const prevCY = boxH > 0 ? (boxY + boxH / 2) / displayScale : sh / 2;

  boxW = Math.min((targetW / workScale) * displayScale, dispImgW);
  boxH = Math.min((targetH / workScale) * displayScale, dispImgH);
  boxX = prevCX * displayScale - boxW / 2;
  boxY = prevCY * displayScale - boxH / 2;

  sourceCanvas.width  = dispImgW;
  sourceCanvas.height = dispImgH;
  await resizeWithPica(picaInstance, src, sourceCanvas);
  sourceFrame.style.width  = Math.min(dispImgW, MAX_EDITOR_W) + 'px';
  sourceFrame.style.height = Math.min(dispImgH, MAX_EDITOR_H) + 'px';

  if (mode === 'crop') {
    sourceLabel.textContent = 'Source — drag or click to reposition';
    cropBox.style.display = 'block';
    posSection.classList.add('disabled');
    clearSnap();
    applyCropBox();
  } else {
    sourceLabel.textContent = 'Source';
    cropBox.style.display = 'none';
    posSection.classList.remove('disabled');
    clearSnap();
  }

  dropZone.style.display = 'none';
  editorSection.classList.add('visible');
  scheduleConvert(0);
}

function applyCropBox(): void {
  boxX = Math.max(0, Math.min(dispImgW - boxW, boxX));
  boxY = Math.max(0, Math.min(dispImgH - boxH, boxY));
  cropBox.style.left   = boxX + 'px';
  cropBox.style.top    = boxY + 'px';
  cropBox.style.width  = boxW + 'px';
  cropBox.style.height = boxH + 'px';

  // Auto-scroll to keep crop box visible
  const margin = 20;
  const visLeft   = sourceFrame.scrollLeft;
  const visTop    = sourceFrame.scrollTop;
  const visRight  = visLeft + sourceFrame.clientWidth;
  const visBottom = visTop  + sourceFrame.clientHeight;

  let sx = visLeft, sy = visTop;
  if (boxX < visLeft + margin)              sx = boxX - margin;
  if (boxX + boxW > visRight - margin)      sx = boxX + boxW - sourceFrame.clientWidth + margin;
  if (boxY < visTop + margin)               sy = boxY - margin;
  if (boxY + boxH > visBottom - margin)     sy = boxY + boxH - sourceFrame.clientHeight + margin;

  sourceFrame.scrollLeft = Math.max(0, sx);
  sourceFrame.scrollTop  = Math.max(0, sy);
}

// Conversion
function scheduleConvert(delay: number): void {
  if (convertTimer !== null) clearTimeout(convertTimer);
  convertTimer = setTimeout(convert, delay);
}

const { clearSnap } = setupCropInteraction({
  cropBox,
  sourceCanvas,
  snapGuideH,
  snapGuideV,
  snapThreshold: SNAP_THRESHOLD,
  getMode: () => mode,
  getBoxState: () => ({ dispImgW, dispImgH, boxW, boxH, boxX, boxY }),
  setBoxPosition: (x, y) => {
    boxX = x;
    boxY = y;
  },
  applyCropBox,
  scheduleConvert,
});

function autoLevels(): void {
  if (!loadedImg) return;
  const src = getSource();
  const sw = srcW(src), sh = srcH(src);

  // Render the same crop/fit region that convert() would process —
  // not the full source — so Auto responds to what is actually visible.
  const tmp = createCanvas(targetW, targetH);
  const tc = getContext2d(tmp);
  tc.fillStyle = fitBg === 'black' ? '#000000' : '#ffffff';
  tc.fillRect(0, 0, targetW, targetH);
  if (mode === 'fit') {
    const fs = Math.min(targetW / sw, targetH / sh);
    const fw = sw * fs, fh = sh * fs;
    const off = fitOffset(fw, fh, targetW, targetH, fitAlign);
    tc.drawImage(src, off.x, off.y, fw, fh);
  } else {
    const k = workScale / displayScale;
    tc.drawImage(src, -boxX * k, -boxY * k, sw * workScale, sh * workScale);
  }

  const px = tc.getImageData(0, 0, targetW, targetH).data;
  const levels = computeAutoLevels(buildUintHistogram(buildLuminanceBuffer(px)), totalPixels);

  store.dispatch(actions.imageSetBlackPoint(levels.blackPoint));
  store.dispatch(actions.imageSetWhitePoint(levels.whitePoint));
  // Reset gamma so B/W points are calibrated on the clean unmodified range
  store.dispatch(actions.imageSetGamma(1.0));
  blackSlider.value = String(blackPoint);
  whiteSlider.value = String(whitePoint);
  blackValEl.textContent = String(blackPoint);
  whiteValEl.textContent = String(whitePoint);
  gammaSlider.value = '100';
  gammaValEl.textContent = '1.00';
  rebuildGammaLUT();
  scheduleConvert(0);
}

// Histogram

function drawHistogram(): void {
  renderHistogram(histogramCanvas, lastHistogram, totalPixels);
}

window.addEventListener('resize', () => {
  resizeHistogramCanvas(histogramCanvas);
  drawHistogram();
});

const picaInstance = createPicaResizer();

async function convert(): Promise<void> {
  if (!loadedImg) return;
  const gen = ++convertGen;
  const src  = getSource();
  const sw   = srcW(src), sh = srcH(src);
  const ctx  = getContext2d(workCanvas);

  ctx.fillStyle = fitBg === 'black' ? '#000000' : '#ffffff';
  ctx.fillRect(0, 0, targetW, targetH);

  if (mode === 'fit') {
    const fs = Math.min(targetW / sw, targetH / sh);
    const fw = Math.max(1, Math.round(sw * fs));
    const fh = Math.max(1, Math.round(sh * fs));
    const off = fitOffset(fw, fh, targetW, targetH, fitAlign);
    const fitCanvas = createCanvas(fw, fh);
    await resizeWithPica(picaInstance, src, fitCanvas);
    if (gen !== convertGen) return;
    ctx.drawImage(fitCanvas, off.x, off.y);
  } else {
    const srcX  = Math.max(0, Math.round(boxX / displayScale));
    const srcY  = Math.max(0, Math.round(boxY / displayScale));
    const cropW = Math.max(1, Math.min(sw - srcX, Math.round(targetW / workScale)));
    const cropH = Math.max(1, Math.min(sh - srcY, Math.round(targetH / workScale)));
    const cropCanvas = createCanvas(cropW, cropH);
    getContext2d(cropCanvas).drawImage(src, srcX, srcY, cropW, cropH, 0, 0, cropW, cropH);
    await resizeWithPica(picaInstance, cropCanvas, workCanvas);
    if (gen !== convertGen) return;
  }

  const outputs = buildImageOutputs(ctx.getImageData(0, 0, targetW, targetH).data, targetW, targetH, {
    blackPoint,
    whitePoint,
    gammaValue,
    gammaLut: gammaLUT,
    contrastValue,
    invert,
    ditherEnabled,
    ditherMode,
  });

  lastHistogram = outputs.histogram;
  drawHistogram();

  renderIndexedPreview(previewCanvas, outputs.indexedPixels, targetW, targetH);

  pxcBytes = outputs.pxcBytes;
  bmpBytes = outputs.bmpBytes;
  downloadGroup.classList.add('visible');
}

const TILES_WIDE = 20;

function initGb() {
  decodeGbDraw();
  buildGbOutput();
  showGbUI();
}

function showGbUI() {
  editorSection.classList.add('visible');
  dom.gbSourceWrap.style.display = '';
  sourceFrame.style.display = 'none';
  dom.gbFileInfo.classList.add('visible');
  dropZone.style.display = 'none';

  dom.scaleSection.style.display = 'none';
  dom.mirrorSection.style.display = 'none';
  posSection.style.display                                   = 'none';
  dom.histogramSection.style.display = 'none';
  dom.toneRangeSection.style.display = 'none';
  getPanelSection(dom.contrastReset).style.display = 'none';
  getPanelSection(dom.ditherToggle).style.display = 'none';
  getPanelSection(dom.invertToggle).style.display = 'none';

  dom.gbControls.style.display = '';

  sourceLabel.textContent = 'GB — native palette';

  clearHistogramView();
}

function hideGbUI() {
  dom.gbSourceWrap.style.display = 'none';
  dom.gbFileInfo.classList.remove('visible');
  dom.gbControls.style.display = 'none';
  sourceFrame.style.display = '';
  sourceLabel.textContent = 'Source — drag or click to reposition';

  dom.scaleSection.style.display = '';
  dom.mirrorSection.style.display = '';
  posSection.style.display                                   = '';
  dom.histogramSection.style.display = '';
  dom.toneRangeSection.style.display = '';
  getPanelSection(dom.contrastReset).style.display = '';
  getPanelSection(dom.ditherToggle).style.display = '';
  getPanelSection(dom.invertToggle).style.display = '';

  gbRawBytes = gbPixels = gbBmpBytes = null;
  gbPalletShades = null;
  zoomLabelEl.textContent = editorZoom + '×';
}

function decodeGbDraw() {
  if (gbRawBytes === null) throw new Error('GB bytes are not loaded');
  const { pixels, w, h } = decode2bpp(gbRawBytes, TILES_WIDE);
  gbPixels = pixels; gbW = w; gbH = h;
  updateGbFileInfo();
  drawGbSource();
}

function updateGbFileInfo() {
  if (gbRawBytes === null) throw new Error('GB bytes are not loaded');
  const info = buildGbFileInfo({
    name: outputBaseName,
    rawByteLength: gbRawBytes.length,
    tilesWide: TILES_WIDE,
    paletteRemap: gbPalletShades,
  });

  dom.gbInfoName.textContent = info.name;
  dom.gbInfoSize.textContent = info.sizeText;
  dom.gbInfoTiles.textContent = info.tilesText;
  dom.gbInfoDims.textContent = info.dimsText;
  dom.gbWarnRow.style.display = info.warningText ? '' : 'none';
  dom.gbWarnMsg.textContent = info.warningText ?? '';
  dom.palletInfoVal.textContent = info.paletteInfoText ?? '';
  dom.palletInfo.style.display = info.paletteInfoText ? '' : 'none';
}

function drawGbSource() {
  if (gbPixels === null) throw new Error('GB pixels are not decoded');
  const view = buildGbSourceView(gbPixels, gbW, gbH, gbRotation, gbZoom);
  gbRenderedScale = view.displayScale;
  zoomLabelEl.textContent = view.displayScale + '×';
  renderGbSourceCanvas(gbCanvas, view.pixels, view.width, view.height, gbPaletteKey, view.displayScale, gbPalletShades, gbInvert);
}

function buildGbOutput() {
  if (gbPixels === null) throw new Error('GB pixels are not decoded');
  const outputs = buildGbOutputArtifacts({
    pixels: gbPixels,
    width: gbW,
    height: gbH,
    rotation: gbRotation,
    outputScale: gbOutputScale,
    targetW,
    targetH,
    background: fitBg,
    paletteRemap: gbPalletShades,
    invert: gbInvert,
    paletteKey: gbPaletteKey,
  });

  renderIndexedPreview(previewCanvas, outputs.indexedPixels, targetW, targetH);

  pxcBytes = outputs.pxcBytes;
  gbBmpBytes = outputs.bmpBytes;
  downloadGroup.classList.add('visible');

  clearHistogramView();
}

bindStoreControls(dom, {
  store,
  scheduleConvert,
  rebuildGammaLUT,
  autoLevels,
  onDeviceChanged: () => {
    workCanvas.width = targetW;
    workCanvas.height = targetH;
    previewCanvas.width = targetW;
    previewCanvas.height = targetH;
    if (loadedImg) resetEditor();
    else if (loadedType === 'gb') buildGbOutput();
    else {
      downloadGroup.classList.remove('visible');
      pxcBytes = null;
      bmpBytes = null;
    }
  },
  onImageLayoutChanged: () => {
    if (loadedImg) resetEditor();
  },
  onGbVisualChanged: () => {
    if (gbPixels) {
      drawGbSource();
      buildGbOutput();
    }
  },
});

gbScaleUpBtn.addEventListener('click', () => {
  if (!gbPixels) return;
  const rot = rotatePixels(gbPixels, gbW, gbH, gbRotation);
  const maxScale = Math.min(Math.floor(targetW / rot.w), Math.floor(targetH / rot.h));
  if (gbOutputScale < maxScale) {
    store.dispatch(actions.gbSetOutputScale(gbOutputScale + 1));
    gbScaleVal.textContent = gbOutputScale + '×';
    buildGbOutput();
  }
});
gbScaleDownBtn.addEventListener('click', () => {
  if (!gbPixels) return;
  if (gbOutputScale > 1) {
    store.dispatch(actions.gbSetOutputScale(gbOutputScale - 1));
    gbScaleVal.textContent = gbOutputScale + '×';
    buildGbOutput();
  }
});
const ZOOM_BOX   = 260;
const ZOOM_SRC   = 72;

setupPreviewZoom({
  previewCanvas,
  zoomBox,
  zoomCanvas,
  zoomBoxSize: ZOOM_BOX,
  zoomSourceSize: ZOOM_SRC,
  canShow: () => Boolean(pxcBytes),
  getTargetSize: () => ({ width: targetW, height: targetH }),
});

downloadPxcBtn.addEventListener('click', () => {
  if (pxcBytes) triggerDownload(pxcBytes, outputBaseName + '.pxc', 'application/octet-stream');
});
downloadBmpBtn.addEventListener('click', () => {
  if (loadedType === 'gb' && gbBmpBytes)
    triggerDownload(gbBmpBytes, outputBaseName + '.bmp', 'image/bmp');
  else if (bmpBytes)
    triggerDownload(bmpBytes, outputBaseName + '.bmp', 'image/bmp');
});

document.addEventListener('paste', e => {
  const file = getPastedImageFile(e);
  if (file) {
    e.preventDefault();
    void loadFile(file);
    return;
  }

  const text = getPastedText(e);
  if (text) {
    e.preventDefault();
    void loadPastedPrinterLog(text);
  }
});

rebuildGammaLUT();

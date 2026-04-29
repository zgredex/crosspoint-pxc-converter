function requiredElement<T extends Element>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required element: ${id}`);
  }
  return element as unknown as T;
}

function queryAll<T extends Element>(selector: string): T[] {
  return Array.from(document.querySelectorAll(selector)) as T[];
}

export function createDom() {
  return {
    statusBanner: requiredElement<HTMLDivElement>('statusBanner'),
    dropZone: requiredElement<HTMLDivElement>('dropZone'),
    fileInput: requiredElement<HTMLInputElement>('fileInput'),
    editorSection: requiredElement<HTMLDivElement>('editorSection'),
    sourceFrame: requiredElement<HTMLDivElement>('sourceFrame'),
    sourceCanvas: requiredElement<HTMLCanvasElement>('sourceCanvas'),
    sourceLabel: requiredElement<HTMLParagraphElement>('sourceLabel'),
    changeBtn: requiredElement<HTMLButtonElement>('changeBtn'),
    cropBox: requiredElement<HTMLDivElement>('cropBox'),
    snapGuideH: requiredElement<HTMLDivElement>('snapGuideH'),
    snapGuideV: requiredElement<HTMLDivElement>('snapGuideV'),
    posSection: requiredElement<HTMLDivElement>('posSection'),
    contrastSlider: requiredElement<HTMLInputElement>('contrastSlider'),
    contrastValEl: requiredElement<HTMLSpanElement>('contrastVal'),
    contrastReset: requiredElement<HTMLButtonElement>('contrastReset'),
    blackSlider: requiredElement<HTMLInputElement>('blackSlider'),
    blackValEl: requiredElement<HTMLSpanElement>('blackVal'),
    whiteSlider: requiredElement<HTMLInputElement>('whiteSlider'),
    whiteValEl: requiredElement<HTMLSpanElement>('whiteVal'),
    toneReset: requiredElement<HTMLButtonElement>('toneReset'),
    autoLevelsBtn: requiredElement<HTMLButtonElement>('autoLevelsBtn'),
    gammaSlider: requiredElement<HTMLInputElement>('gammaSlider'),
    gammaValEl: requiredElement<HTMLSpanElement>('gammaVal'),
    rotateCWBtn: requiredElement<HTMLButtonElement>('rotateCW'),
    rotateCCWBtn: requiredElement<HTMLButtonElement>('rotateCCW'),
    rotateValEl: requiredElement<HTMLSpanElement>('rotateVal'),
    mirrorHBtn: requiredElement<HTMLButtonElement>('mirrorHBtn'),
    mirrorVBtn: requiredElement<HTMLButtonElement>('mirrorVBtn'),
    invertToggle: requiredElement<HTMLInputElement>('invertToggle'),
    ditherToggle: requiredElement<HTMLInputElement>('ditherToggle'),
    ditherAlgos: requiredElement<HTMLDivElement>('ditherAlgos'),
    previewCanvas: requiredElement<HTMLCanvasElement>('previewCanvas'),
    workCanvas: requiredElement<HTMLCanvasElement>('workCanvas'),
    downloadGroup: requiredElement<HTMLDivElement>('downloadGroup'),
    downloadPxcBtn: requiredElement<HTMLButtonElement>('downloadPxc'),
    downloadBmpBtn: requiredElement<HTMLButtonElement>('downloadBmp'),
    zoomSlider: requiredElement<HTMLInputElement>('zoomSlider'),
    zoomHint: requiredElement<HTMLParagraphElement>('zoomHint'),
    histogramCanvas: requiredElement<HTMLCanvasElement>('histogramCanvas'),
    gbSourceWrap: requiredElement<HTMLDivElement>('gbSourceWrap'),
    gbCanvas: requiredElement<HTMLCanvasElement>('gbCanvas'),
    gbFileInfo: requiredElement<HTMLDivElement>('gbFileInfo'),
    scaleSection: requiredElement<HTMLDivElement>('scaleSection'),
    mirrorSection: requiredElement<HTMLDivElement>('mirrorSection'),
    histogramSection: requiredElement<HTMLDivElement>('histogramSection'),
    toneRangeSection: requiredElement<HTMLDivElement>('toneRangeSection'),
    gbControls: requiredElement<HTMLDivElement>('gbControls'),
    gbInfoName: requiredElement<HTMLElement>('gbInfoName'),
    gbInfoSize: requiredElement<HTMLElement>('gbInfoSize'),
    gbInfoTiles: requiredElement<HTMLElement>('gbInfoTiles'),
    gbInfoDims: requiredElement<HTMLElement>('gbInfoDims'),
    gbWarnRow: requiredElement<HTMLDivElement>('gbWarnRow'),
    gbWarnMsg: requiredElement<HTMLElement>('gbWarnMsg'),
    paletteInfo: requiredElement<HTMLDivElement>('paletteInfo'),
    paletteInfoVal: requiredElement<HTMLElement>('paletteInfoVal'),
    gbScaleUpBtn: requiredElement<HTMLButtonElement>('gbScaleUpBtn'),
    gbScaleDownBtn: requiredElement<HTMLButtonElement>('gbScaleDownBtn'),
    gbScaleVal: requiredElement<HTMLSpanElement>('gbScaleVal'),
    gbInvertToggle: requiredElement<HTMLInputElement>('gbInvertToggle'),
    zoomBox: requiredElement<HTMLDivElement>('zoomBox'),
    zoomCanvas: requiredElement<HTMLCanvasElement>('zoomCanvas'),
    deviceButtons: queryAll<HTMLButtonElement>('[data-xt]'),
    modeButtons: queryAll<HTMLButtonElement>('[data-mode]'),
    ditherButtons: queryAll<HTMLButtonElement>('[data-dither]'),
    posButtons: queryAll<HTMLButtonElement>('.pos-btn'),
    bgButtons: queryAll<HTMLButtonElement>('[data-bg]'),
    gbPaletteButtons: queryAll<HTMLButtonElement>('[data-gbpalette]'),
  };
}

export type AppDom = ReturnType<typeof createDom>;

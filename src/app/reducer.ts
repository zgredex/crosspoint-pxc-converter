import { getDeviceState, initialAppState, initialGbState, initialImageState, initialOutputState, type AppState } from './state';
import type { AppAction } from './actions';

export function reducer(state: AppState = initialAppState, action: AppAction): AppState {
  switch (action.type) {
    case 'setLoadedType':
      return { ...state, loadedType: action.loadedType };
    case 'setDevice':
      return { ...state, device: getDeviceState(action.deviceKey) };
    case 'setBackground':
      return { ...state, background: action.background };
    case 'image/setMode':
      return { ...state, image: { ...state.image, mode: action.mode } };
    case 'image/setFitAlign':
      return { ...state, image: { ...state.image, fitAlign: action.fitAlign } };
    case 'image/setContrast':
      return { ...state, image: { ...state.image, contrastValue: action.contrastValue } };
    case 'image/resetContrast':
      return { ...state, image: { ...state.image, contrastValue: initialImageState.contrastValue } };
    case 'image/setBlackPoint':
      return {
        ...state,
        image: {
          ...state.image,
          blackPoint: Math.max(0, Math.min(action.blackPoint, state.image.whitePoint - 1)),
        },
      };
    case 'image/setWhitePoint':
      return {
        ...state,
        image: {
          ...state.image,
          whitePoint: Math.min(255, Math.max(action.whitePoint, state.image.blackPoint + 1)),
        },
      };
    case 'image/resetTone':
      return {
        ...state,
        image: {
          ...state.image,
          blackPoint: initialImageState.blackPoint,
          whitePoint: initialImageState.whitePoint,
          gammaValue: initialImageState.gammaValue,
        },
      };
    case 'image/setGamma':
      return { ...state, image: { ...state.image, gammaValue: action.gammaValue } };
    case 'image/setInvert':
      return { ...state, image: { ...state.image, invert: action.invert } };
    case 'image/setDitherEnabled':
      return { ...state, image: { ...state.image, ditherEnabled: action.ditherEnabled } };
    case 'image/setDitherMode':
      return { ...state, image: { ...state.image, ditherMode: action.ditherMode } };
    case 'image/setRotation':
      return { ...state, image: { ...state.image, rotation: action.rotation } };
    case 'image/toggleMirrorH':
      return { ...state, image: { ...state.image, mirrorH: !state.image.mirrorH } };
    case 'image/toggleMirrorV':
      return { ...state, image: { ...state.image, mirrorV: !state.image.mirrorV } };
    case 'image/setEditorZoom':
      return { ...state, image: { ...state.image, editorZoom: action.editorZoom } };
    case 'image/resetAll':
      return { ...state, image: initialImageState };
    case 'gb/setPalette':
      return { ...state, gb: { ...state.gb, paletteKey: action.paletteKey } };
    case 'gb/setInvert':
      return { ...state, gb: { ...state.gb, invert: action.invert } };
    case 'gb/setRotation':
      return { ...state, gb: { ...state.gb, rotation: action.rotation } };
    case 'gb/setZoom':
      return { ...state, gb: { ...state.gb, zoom: action.zoom } };
    case 'gb/setOutputScale':
      return { ...state, gb: { ...state.gb, outputScale: action.outputScale } };
    case 'gb/setDims':
      return { ...state, gb: { ...state.gb, dims: action.dims } };
    case 'gb/setFileInfo':
      return { ...state, gb: { ...state.gb, fileInfo: action.fileInfo } };
    case 'gb/resetAll':
      return { ...state, gb: initialGbState };
    case 'output/setReady':
      return { ...state, output: { ...state.output, pxcReady: action.pxcReady, bmpReady: action.bmpReady } };
    case 'output/clear':
      return { ...state, output: { ...state.output, pxcReady: false, bmpReady: false } };
    case 'output/setBaseName':
      return { ...state, output: { ...state.output, baseName: action.baseName } };
    case 'ui/setMessage':
      return { ...state, ui: { tone: action.tone, message: action.message } };
    case 'ui/clearMessage':
      return { ...state, ui: { tone: null, message: null } };
    default:
      return state;
  }
}

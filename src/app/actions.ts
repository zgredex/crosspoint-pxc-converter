import type { DeviceKey } from '../domain/devices';
import type { DitherMode } from '../domain/dither';
import type { FitAlign } from '../domain/geometry';
import type { GbPaletteKey } from '../domain/formats/bmpGb';
import type { FitBackground, GbDims, GbFileInfo, ImageDims, LoadedType, Rotation, UiTone } from './state';

export type AppAction =
  | { type: 'setLoadedType'; loadedType: LoadedType }
  | { type: 'setDevice'; deviceKey: DeviceKey }
  | { type: 'setBackground'; background: FitBackground }
  | { type: 'image/setMode'; mode: 'crop' | 'fit' }
  | { type: 'image/setFitAlign'; fitAlign: FitAlign }
  | { type: 'image/setContrast'; contrastValue: number }
  | { type: 'image/resetContrast' }
  | { type: 'image/setBlackPoint'; blackPoint: number }
  | { type: 'image/setWhitePoint'; whitePoint: number }
  | { type: 'image/resetTone' }
  | { type: 'image/setGamma'; gammaValue: number }
  | { type: 'image/setInvert'; invert: boolean }
  | { type: 'image/setDitherEnabled'; ditherEnabled: boolean }
  | { type: 'image/setDitherMode'; ditherMode: DitherMode }
  | { type: 'image/setRotation'; rotation: Rotation }
  | { type: 'image/toggleMirrorH' }
  | { type: 'image/toggleMirrorV' }
  | { type: 'image/setEditorZoom'; editorZoom: number }
  | { type: 'image/setEditorMaxZoom'; editorMaxZoom: number }
  | { type: 'image/setSourceDims'; dims: ImageDims | null }
  | { type: 'image/resetAll' }
  | { type: 'gb/setPalette'; paletteKey: GbPaletteKey }
  | { type: 'gb/setInvert'; invert: boolean }
  | { type: 'gb/setRotation'; rotation: Rotation }
  | { type: 'gb/setZoom'; zoom: number }
  | { type: 'gb/setOutputScale'; outputScale: number }
  | { type: 'gb/setDims'; dims: GbDims | null }
  | { type: 'gb/setFileInfo'; fileInfo: GbFileInfo | null }
  | { type: 'gb/resetAll' }
  | { type: 'output/setReady'; pxcReady: boolean; bmpReady: boolean }
  | { type: 'output/clear' }
  | { type: 'output/setBaseName'; baseName: string }
  | { type: 'ui/setMessage'; tone: UiTone; message: string }
  | { type: 'ui/clearMessage' };

export const actions = {
  setLoadedType: (loadedType: LoadedType): AppAction => ({ type: 'setLoadedType', loadedType }),
  setDevice: (deviceKey: DeviceKey): AppAction => ({ type: 'setDevice', deviceKey }),
  setBackground: (background: FitBackground): AppAction => ({ type: 'setBackground', background }),
  imageSetMode: (mode: 'crop' | 'fit'): AppAction => ({ type: 'image/setMode', mode }),
  imageSetFitAlign: (fitAlign: FitAlign): AppAction => ({ type: 'image/setFitAlign', fitAlign }),
  imageSetContrast: (contrastValue: number): AppAction => ({ type: 'image/setContrast', contrastValue }),
  imageResetContrast: (): AppAction => ({ type: 'image/resetContrast' }),
  imageSetBlackPoint: (blackPoint: number): AppAction => ({ type: 'image/setBlackPoint', blackPoint }),
  imageSetWhitePoint: (whitePoint: number): AppAction => ({ type: 'image/setWhitePoint', whitePoint }),
  imageResetTone: (): AppAction => ({ type: 'image/resetTone' }),
  imageSetGamma: (gammaValue: number): AppAction => ({ type: 'image/setGamma', gammaValue }),
  imageSetInvert: (invert: boolean): AppAction => ({ type: 'image/setInvert', invert }),
  imageSetDitherEnabled: (ditherEnabled: boolean): AppAction => ({ type: 'image/setDitherEnabled', ditherEnabled }),
  imageSetDitherMode: (ditherMode: DitherMode): AppAction => ({ type: 'image/setDitherMode', ditherMode }),
  imageSetRotation: (rotation: Rotation): AppAction => ({ type: 'image/setRotation', rotation }),
  imageToggleMirrorH: (): AppAction => ({ type: 'image/toggleMirrorH' }),
  imageToggleMirrorV: (): AppAction => ({ type: 'image/toggleMirrorV' }),
  imageSetEditorZoom: (editorZoom: number): AppAction => ({ type: 'image/setEditorZoom', editorZoom }),
  imageSetEditorMaxZoom: (editorMaxZoom: number): AppAction => ({ type: 'image/setEditorMaxZoom', editorMaxZoom }),
  imageSetSourceDims: (dims: ImageDims | null): AppAction => ({ type: 'image/setSourceDims', dims }),
  imageResetAll: (): AppAction => ({ type: 'image/resetAll' }),
  gbSetPalette: (paletteKey: GbPaletteKey): AppAction => ({ type: 'gb/setPalette', paletteKey }),
  gbSetInvert: (invert: boolean): AppAction => ({ type: 'gb/setInvert', invert }),
  gbSetRotation: (rotation: Rotation): AppAction => ({ type: 'gb/setRotation', rotation }),
  gbSetZoom: (zoom: number): AppAction => ({ type: 'gb/setZoom', zoom }),
  gbSetOutputScale: (outputScale: number): AppAction => ({ type: 'gb/setOutputScale', outputScale }),
  gbSetDims: (dims: GbDims | null): AppAction => ({ type: 'gb/setDims', dims }),
  gbSetFileInfo: (fileInfo: GbFileInfo | null): AppAction => ({ type: 'gb/setFileInfo', fileInfo }),
  gbResetAll: (): AppAction => ({ type: 'gb/resetAll' }),
  outputSetReady: (pxcReady: boolean, bmpReady: boolean): AppAction => ({ type: 'output/setReady', pxcReady, bmpReady }),
  outputClear: (): AppAction => ({ type: 'output/clear' }),
  outputSetBaseName: (baseName: string): AppAction => ({ type: 'output/setBaseName', baseName }),
  uiSetMessage: (tone: UiTone, message: string): AppAction => ({ type: 'ui/setMessage', tone, message }),
  uiClearMessage: (): AppAction => ({ type: 'ui/clearMessage' }),
};

import { describe, expect, it } from 'vitest';

import { actions } from '../../src/app/actions';
import { reducer } from '../../src/app/reducer';
import { initialAppState } from '../../src/app/state';

describe('app reducer', () => {
  it('changes device dimensions from the device key', () => {
    const next = reducer(initialAppState, actions.setDevice('x3'));

    expect(next.device).toEqual({
      key: 'x3',
      targetW: 528,
      targetH: 792,
      totalPixels: 528 * 792,
    });
  });

  it('resets the image slice to defaults', () => {
    const modified = reducer(
      reducer(
        reducer(initialAppState, actions.imageSetRotation(90)),
        actions.imageSetGamma(2),
      ),
      actions.imageSetInvert(true),
    );

    const reset = reducer(modified, actions.imageResetAll());

    expect(reset.image).toEqual(initialAppState.image);
  });

  it('resets only tone controls with image/resetTone', () => {
    const modified = {
      ...initialAppState,
      image: {
        ...initialAppState.image,
        blackPoint: 10,
        whitePoint: 200,
        gammaValue: 1.5,
        contrastValue: 12,
      },
    };

    const reset = reducer(modified, actions.imageResetTone());

    expect(reset.image.blackPoint).toBe(0);
    expect(reset.image.whitePoint).toBe(255);
    expect(reset.image.gammaValue).toBe(1.0);
    expect(reset.image.contrastValue).toBe(12);
  });

  it('toggles image mirrors and updates GB controls independently', () => {
    const toggled = reducer(initialAppState, actions.imageToggleMirrorH());
    const gbUpdated = reducer(toggled, actions.gbSetOutputScale(3));

    expect(gbUpdated.image.mirrorH).toBe(true);
    expect(gbUpdated.gb.outputScale).toBe(3);
    expect(gbUpdated.image.mirrorV).toBe(false);
  });

  it('tracks loaded type separately from feature settings', () => {
    const next = reducer(initialAppState, actions.setLoadedType('gb'));

    expect(next.loadedType).toBe('gb');
    expect(next.image).toEqual(initialAppState.image);
    expect(next.gb).toEqual(initialAppState.gb);
  });

  it('stores shared background outside the image slice', () => {
    const next = reducer(initialAppState, actions.setBackground('black'));

    expect(next.background).toBe('black');
    expect(next.image).toEqual(initialAppState.image);
  });

  it('clamps black and white points in the reducer', () => {
    const clampedBlack = reducer(
      { ...initialAppState, image: { ...initialAppState.image, whitePoint: 100 } },
      actions.imageSetBlackPoint(150),
    );
    const clampedWhite = reducer(
      { ...initialAppState, image: { ...initialAppState.image, blackPoint: 90 } },
      actions.imageSetWhitePoint(10),
    );

    expect(clampedBlack.image.blackPoint).toBe(99);
    expect(clampedWhite.image.whitePoint).toBe(91);
  });

  it('stores and clears the source dimensions', () => {
    const set = reducer(initialAppState, actions.imageSetSourceDims({ width: 1920, height: 1080 }));
    expect(set.image.sourceDims).toEqual({ width: 1920, height: 1080 });

    const cleared = reducer(set, actions.imageSetSourceDims(null));
    expect(cleared.image.sourceDims).toBeNull();

    const reset = reducer(set, actions.imageResetAll());
    expect(reset.image.sourceDims).toBeNull();
  });

  it('marks autoLevelsApplied via image/applyAutoLevels and clears it on manual edits', () => {
    const applied = reducer(initialAppState, actions.imageApplyAutoLevels(40, 220, 1.2));
    expect(applied.image.autoLevelsApplied).toBe(true);
    expect(applied.image.blackPoint).toBe(40);
    expect(applied.image.whitePoint).toBe(220);
    expect(applied.image.gammaValue).toBe(1.2);

    expect(reducer(applied, actions.imageSetBlackPoint(50)).image.autoLevelsApplied).toBe(false);
    expect(reducer(applied, actions.imageSetWhitePoint(200)).image.autoLevelsApplied).toBe(false);
    expect(reducer(applied, actions.imageSetGamma(1.5)).image.autoLevelsApplied).toBe(false);
    expect(reducer(applied, actions.imageResetTone()).image.autoLevelsApplied).toBe(false);
    expect(reducer(applied, actions.imageResetAll()).image.autoLevelsApplied).toBe(false);
    expect(reducer(applied, actions.imageSetContrast(15)).image.autoLevelsApplied).toBe(true);
  });

  it('switches the quant preset', () => {
    expect(initialAppState.quantPreset).toBe('pr1614');
    const next = reducer(initialAppState, actions.setQuantPreset('master'));
    expect(next.quantPreset).toBe('master');
    expect(reducer(next, actions.setQuantPreset('pr1614')).quantPreset).toBe('pr1614');
  });

  it('stores and clears UI status messages', () => {
    const withMessage = reducer(initialAppState, actions.uiSetMessage('error', 'Bad input'));

    expect(withMessage.ui).toEqual({ tone: 'error', message: 'Bad input' });
    expect(reducer(withMessage, actions.uiClearMessage()).ui).toEqual({ tone: null, message: null });
  });
});

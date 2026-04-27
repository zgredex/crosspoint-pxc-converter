import { describe, expect, it, vi } from 'vitest';

import { initialAppState } from '../../src/app/state';
import type { AppStore } from '../../src/app/store';
import { createImageRuntime } from '../../src/app/runtime/imageRuntime';
import { createOutputRuntime } from '../../src/app/runtime/outputRuntime';
import { createImageController } from '../../src/features/image/controller';

function createMockStore(state = initialAppState): AppStore & { actions: unknown[] } {
  const actions: unknown[] = [];
  return {
    actions,
    getState() {
      return state;
    },
    dispatch(action) {
      actions.push(action);
    },
    subscribe() {
      return () => {};
    },
  };
}

describe('image controller', () => {
  it('updates rotation state', () => {
    const store = createMockStore();
    const dom = {
      rotateValEl: { textContent: '' },
      zoomLabelEl: { textContent: '' },
    } as unknown as Parameters<typeof createImageController>[0]['dom'];

    const controller = createImageController({
      store,
      dom,
      runtime: createImageRuntime(),
      output: createOutputRuntime(),
      pica: { resize: vi.fn() },
      clearStatus: vi.fn(),
      showError: vi.fn(),
      clearHistogramView: vi.fn(),
      clearSnap: vi.fn(),
    });

    controller.setRotation(90);

    expect(store.actions).toContainEqual({ type: 'image/setRotation', rotation: 90 });
  });

  it('updates zoom state', () => {
    const store = createMockStore();
    const dom = {
      rotateValEl: { textContent: '' },
      zoomLabelEl: { textContent: '' },
    } as unknown as Parameters<typeof createImageController>[0]['dom'];

    const controller = createImageController({
      store,
      dom,
      runtime: createImageRuntime(),
      output: createOutputRuntime(),
      pica: { resize: vi.fn() },
      clearStatus: vi.fn(),
      showError: vi.fn(),
      clearHistogramView: vi.fn(),
      clearSnap: vi.fn(),
    });

    controller.setZoom(2);

    expect(store.actions).toContainEqual({ type: 'image/setEditorZoom', editorZoom: 2 });
  });

  it('rebuilds gamma LUT on the runtime object', () => {
    const runtime = createImageRuntime();
    const controller = createImageController({
      store: createMockStore({
        ...initialAppState,
        image: { ...initialAppState.image, gammaValue: 2 },
      }),
      dom: {
        rotateValEl: { textContent: '' },
        zoomLabelEl: { textContent: '' },
      } as never,
      runtime,
      output: createOutputRuntime(),
      pica: { resize: vi.fn() },
      clearStatus: vi.fn(),
      showError: vi.fn(),
      clearHistogramView: vi.fn(),
      clearSnap: vi.fn(),
    });

    controller.rebuildGammaLut();

    expect(runtime.gammaLut).not.toBeNull();
    expect(runtime.gammaLut?.[255]).toBe(255);
  });

  it('debounces scheduled conversion requests through the runtime timer', () => {
    vi.useFakeTimers();

    const runtime = createImageRuntime();
    const controller = createImageController({
      store: createMockStore(),
      dom: {
        rotateValEl: { textContent: '' },
        zoomLabelEl: { textContent: '' },
      } as never,
      runtime,
      output: createOutputRuntime(),
      pica: { resize: vi.fn() },
      clearStatus: vi.fn(),
      showError: vi.fn(),
      clearHistogramView: vi.fn(),
      clearSnap: vi.fn(),
    });

    controller.requestConvert(50);
    const firstTimer = runtime.convertTimer;
    controller.requestConvert(10);

    expect(firstTimer).not.toBe(runtime.convertTimer);

    vi.useRealTimers();
  });
});

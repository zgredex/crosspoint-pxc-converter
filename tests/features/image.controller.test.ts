import { describe, expect, it, vi } from 'vitest';

import { initialAppState } from '../../src/app/state';
import type { AppStore } from '../../src/app/store';
import { createImageRuntime } from '../../src/app/runtime/imageRuntime';
import { createOutputRuntime } from '../../src/app/runtime/outputRuntime';
import { createImageController } from '../../src/features/image/controller';

function createMockWorker() {
  return {
    setBaseRaster: vi.fn(),
    process: vi.fn(),
    onResult: vi.fn(),
    terminate: vi.fn(),
  };
}

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
      worker: createMockWorker(),
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
      worker: createMockWorker(),
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
      worker: createMockWorker(),
      clearStatus: vi.fn(),
      showError: vi.fn(),
      clearHistogramView: vi.fn(),
      clearSnap: vi.fn(),
    });

    controller.rebuildGammaLut();

    expect(runtime.gammaLut).not.toBeNull();
    expect(runtime.gammaLut?.[255]).toBe(255);
  });

  it('cancels previous rAF before scheduling a new one', () => {
    const rafIds: number[] = [];
    let nextId = 0;
    const mockRaf = (cb: FrameRequestCallback) => { const id = ++nextId; rafIds.push(id); return id; };
    const mockCaf = (id: number) => { const idx = rafIds.indexOf(id); if (idx >= 0) rafIds.splice(idx, 1); };
    vi.stubGlobal('requestAnimationFrame', mockRaf);
    vi.stubGlobal('cancelAnimationFrame', mockCaf);

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
      worker: createMockWorker(),
      clearStatus: vi.fn(),
      showError: vi.fn(),
      clearHistogramView: vi.fn(),
      clearSnap: vi.fn(),
    });

    controller.requestConvert();
    const firstTimer = runtime.convertTimer;
    controller.requestConvert();

    expect(firstTimer).not.toBe(runtime.convertTimer);
    expect(firstTimer).toBe(1);
    expect(runtime.convertTimer).toBe(2);

    vi.unstubAllGlobals();
  });
});

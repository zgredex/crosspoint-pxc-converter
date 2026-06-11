import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/infra/canvas/previewRenderer', () => ({ renderIndexedPreview: vi.fn() }));
vi.mock('../../src/infra/canvas/gbSourceRenderer', () => ({ renderGbSourceCanvas: vi.fn() }));

import { initialAppState } from '../../src/app/state';
import type { AppStore } from '../../src/app/store';
import { createGbRuntime } from '../../src/app/runtime/gbRuntime';
import { createOutputRuntime } from '../../src/app/runtime/outputRuntime';
import { createGbController } from '../../src/features/gb/controller';

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

describe('gb controller', () => {
  it('updates GB rotation state', () => {
    const store = createMockStore();
    const elements = {} as unknown as Parameters<typeof createGbController>[0]['elements'];

    const controller = createGbController({
      store,
      elements,
      runtime: createGbRuntime(),
      output: createOutputRuntime(),
      host: {
        clearStatus: vi.fn(),
        showError: vi.fn(),
        clearHistogramView: vi.fn(),
        resetSession: vi.fn(),
      },
      validateGbBytes: vi.fn(),
    });

    controller.setRotation(180);

    expect(store.actions).toContainEqual({ type: 'gb/setRotation', rotation: 180 });
  });

  it('updates GB zoom state', () => {
    const store = createMockStore();
    const controller = createGbController({
      store,
      elements: {} as never,
      runtime: createGbRuntime(),
      output: createOutputRuntime(),
      host: {
        clearStatus: vi.fn(),
        showError: vi.fn(),
        clearHistogramView: vi.fn(),
        resetSession: vi.fn(),
      },
      validateGbBytes: vi.fn(),
    });

    controller.setZoom(3);

    expect(store.actions).toContainEqual({ type: 'gb/setZoom', zoom: 3 });
  });

  it('buildOutput clamps outputScale to device max and dispatches gbSetOutputScale', () => {
    // Art: 160×400 at rotation=0 on X4 (480×800)
    // maxScale = min(floor(480/160), floor(800/400)) = min(3, 2) = 2
    // state has outputScale=3 → should be clamped to 2
    const state = {
      ...initialAppState,
      gb: {
        ...initialAppState.gb,
        outputScale: 3,
        dims: { width: 160, height: 400 },
      },
    };
    const store = createMockStore(state);

    const runtime = createGbRuntime();
    // 160×400 indexed pixel buffer (values 0–3)
    runtime.pixels = new Uint8Array(160 * 400);

    const controller = createGbController({
      store,
      elements: {} as never,
      runtime,
      output: createOutputRuntime(),
      host: {
        clearStatus: vi.fn(),
        showError: vi.fn(),
        clearHistogramView: vi.fn(),
        resetSession: vi.fn(),
      },
      validateGbBytes: vi.fn(),
    });

    controller.buildOutput();

    expect(store.actions).toContainEqual({ type: 'gb/setOutputScale', outputScale: 2 });
  });
});

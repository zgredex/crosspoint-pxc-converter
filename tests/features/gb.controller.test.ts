import { describe, expect, it, vi } from 'vitest';

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
    const dom = {
      rotateValEl: { textContent: '' },
      gbScaleVal: { textContent: '' },
      zoomLabelEl: { textContent: '' },
    } as unknown as Parameters<typeof createGbController>[0]['dom'];

    const controller = createGbController({
      store,
      dom,
      runtime: createGbRuntime(),
      output: createOutputRuntime(),
      clearStatus: vi.fn(),
      showError: vi.fn(),
      clearHistogramView: vi.fn(),
      validateGbBytes: vi.fn(),
      syncUi: vi.fn(),
    });

    controller.setRotation(180);

    expect(store.actions).toContainEqual({ type: 'gb/setRotation', rotation: 180 });
  });

  it('updates GB zoom state', () => {
    const store = createMockStore();
    const controller = createGbController({
      store,
      dom: {
        rotateValEl: { textContent: '' },
        gbScaleVal: { textContent: '' },
        zoomLabelEl: { textContent: '' },
      } as never,
      runtime: createGbRuntime(),
      output: createOutputRuntime(),
      clearStatus: vi.fn(),
      showError: vi.fn(),
      clearHistogramView: vi.fn(),
      validateGbBytes: vi.fn(),
      syncUi: vi.fn(),
    });

    controller.setZoom(3);

    expect(store.actions).toContainEqual({ type: 'gb/setZoom', zoom: 3 });
  });
});

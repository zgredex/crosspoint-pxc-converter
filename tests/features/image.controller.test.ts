import { describe, expect, it, vi } from 'vitest';

import { actions } from '../../src/app/actions';
import { reducer } from '../../src/app/reducer';
import { initialAppState } from '../../src/app/state';
import type { AppStore } from '../../src/app/store';
import { createImageRuntime, type MutableImageRuntime } from '../../src/app/runtime/imageRuntime';
import { createOutputRuntime } from '../../src/app/runtime/outputRuntime';
import { createImageController } from '../../src/features/image/controller';
import type { WorkerOutMessage } from '../../src/infra/worker/workerProtocol';

const {
  renderImageBaseRasterMock,
  renderHistogramMock,
  renderIndexedPreviewMock,
  mockContext2d,
} = vi.hoisted(() => ({
  renderImageBaseRasterMock: vi.fn<(...args: unknown[]) => Promise<void>>(),
  renderHistogramMock: vi.fn(),
  renderIndexedPreviewMock: vi.fn(),
  mockContext2d: {
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([0, 0, 0, 255]) })),
    fillText: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high',
  } as unknown as CanvasRenderingContext2D,
}));

vi.mock('../../src/features/image/service', () => ({
  renderImageBaseRaster: renderImageBaseRasterMock,
}));

vi.mock('../../src/infra/canvas/histogramRenderer', () => ({
  renderHistogram: renderHistogramMock,
}));

vi.mock('../../src/infra/canvas/previewRenderer', () => ({
  renderIndexedPreview: renderIndexedPreviewMock,
}));

vi.mock('../../src/infra/canvas/context', () => ({
  getContext2d: vi.fn(() => mockContext2d),
  createCanvas: vi.fn((width: number, height: number) => ({ width, height })),
}));

function createMockWorker() {
  let resultHandler: ((result: Extract<WorkerOutMessage, { type: 'result' }>) => void) | null = null;
  return {
    setBaseRaster: vi.fn(),
    process: vi.fn(),
    onResult: vi.fn((callback: (result: Extract<WorkerOutMessage, { type: 'result' }>) => void) => {
      resultHandler = callback;
    }),
    terminate: vi.fn(),
    emitResult(result: Extract<WorkerOutMessage, { type: 'result' }>) {
      resultHandler?.(result);
    },
  };
}

function createMockStore(state = initialAppState): AppStore & { actions: unknown[] } {
  const actions: unknown[] = [];
  let currentState = state;
  return {
    actions,
    getState() {
      return currentState;
    },
    dispatch(action) {
      actions.push(action);
      currentState = reducer(currentState, action);
    },
    subscribe() {
      return () => {};
    },
  };
}

function createMockElements() {
  return {
    previewCanvas: { width: 0, height: 0 } as unknown as HTMLCanvasElement,
    histogramCanvas: { width: 0, height: 0 } as unknown as HTMLCanvasElement,
    sourceCanvas: { width: 0, height: 0 } as unknown as HTMLCanvasElement,
    workCanvas: { width: 0, height: 0 } as unknown as HTMLCanvasElement,
    sourceFrame: {
      style: {},
      scrollLeft: 0,
      scrollTop: 0,
      getBoundingClientRect: () => ({ left: 0, top: 0 }),
    } as unknown as HTMLDivElement,
    cropBox: { style: {} } as unknown as HTMLDivElement,
  } as Parameters<typeof createImageController>[0]['elements'];
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function stubHtmlImageElement() {
  class MockImage {
    naturalWidth: number;
    naturalHeight: number;
    src: string;

    constructor(width = 100, height = 100) {
      this.naturalWidth = width;
      this.naturalHeight = height;
      this.src = '';
    }
  }

  vi.stubGlobal('HTMLImageElement', MockImage);
  return MockImage;
}

describe('image controller', () => {
  it('updates rotation state', () => {
    const store = createMockStore();
    const elements = {} as unknown as Parameters<typeof createImageController>[0]['elements'];

    const controller = createImageController({
      store,
      elements,
      runtime: createImageRuntime(),
      output: createOutputRuntime(),
      pica: { resize: vi.fn() },
      worker: createMockWorker(),
      host: {
        clearStatus: vi.fn(),
        showError: vi.fn(),
        clearHistogramView: vi.fn(),
        resetSession: vi.fn(),
      },
      clearSnap: vi.fn(),
    });

    controller.setRotation(90);

    expect(store.actions).toContainEqual({ type: 'image/setRotation', rotation: 90 });
  });

  it('updates zoom state', () => {
    const store = createMockStore();
    const elements = {} as unknown as Parameters<typeof createImageController>[0]['elements'];

    const controller = createImageController({
      store,
      elements,
      runtime: createImageRuntime(),
      output: createOutputRuntime(),
      pica: { resize: vi.fn() },
      worker: createMockWorker(),
      host: {
        clearStatus: vi.fn(),
        showError: vi.fn(),
        clearHistogramView: vi.fn(),
        resetSession: vi.fn(),
      },
      clearSnap: vi.fn(),
    });

    controller.setZoom(2);

    expect(store.actions).toContainEqual({ type: 'image/setEditorZoom', editorZoom: 2 });
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
      elements: {} as never,
      runtime,
      output: createOutputRuntime(),
      pica: { resize: vi.fn() },
      worker: createMockWorker(),
      host: {
        clearStatus: vi.fn(),
        showError: vi.fn(),
        clearHistogramView: vi.fn(),
        resetSession: vi.fn(),
      },
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

  it('ignores stale worker results after unload', () => {
    const MockImage = stubHtmlImageElement();
    const worker = createMockWorker();
    const store = createMockStore({
      ...initialAppState,
      loadedType: 'image',
    });
    const runtime = createImageRuntime();
    runtime.loadedImg = new MockImage() as unknown as HTMLImageElement;
    runtime.processVersion = 1;

    const controller = createImageController({
      store,
      elements: createMockElements(),
      runtime,
      output: createOutputRuntime(),
      pica: { resize: vi.fn() },
      worker,
      host: {
        clearStatus: vi.fn(),
        showError: vi.fn(),
        clearHistogramView: vi.fn(),
        resetSession: vi.fn(() => {
          store.dispatch(actions.setLoadedType(null));
        }),
      },
      clearSnap: vi.fn(),
    });

    controller.unloadImage();
    worker.emitResult({
      type: 'result',
      indexedPixels: new Uint8Array([0, 1, 2, 3]).buffer,
      histogram: new Float32Array([1, 2, 3]).buffer,
      version: 1,
    });

    expect(store.actions).not.toContainEqual({ type: 'output/setReady', pxcReady: true, bmpReady: true });
    expect(renderIndexedPreviewMock).not.toHaveBeenCalled();
    expect(renderHistogramMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('does not apply auto-level updates after unload', async () => {
    const MockImage = stubHtmlImageElement();
    const deferred = createDeferred<void>();
    renderImageBaseRasterMock.mockImplementationOnce(() => deferred.promise);

    const store = createMockStore({
      ...initialAppState,
      loadedType: 'image',
      image: {
        ...initialAppState.image,
        sourceDims: { width: 100, height: 100 },
      },
    });
    const runtime = createImageRuntime();
    runtime.loadedImg = new MockImage(100, 100) as unknown as HTMLImageElement;

    const controller = createImageController({
      store,
      elements: createMockElements(),
      runtime,
      output: createOutputRuntime(),
      pica: { resize: vi.fn() },
      worker: createMockWorker(),
      host: {
        clearStatus: vi.fn(),
        showError: vi.fn(),
        clearHistogramView: vi.fn(),
        resetSession: vi.fn(() => {
          store.dispatch(actions.setLoadedType(null));
        }),
      },
      clearSnap: vi.fn(),
    });

    const autoLevelsPromise = controller.autoLevels();
    controller.unloadImage();
    deferred.resolve();
    await autoLevelsPromise;

    expect(store.actions).not.toContainEqual(expect.objectContaining({ type: 'image/setBlackPoint' }));
    expect(store.actions).not.toContainEqual(expect.objectContaining({ type: 'image/setWhitePoint' }));
    expect(store.actions).not.toContainEqual(expect.objectContaining({ type: 'image/setGamma' }));

    vi.unstubAllGlobals();
  });

  it('zeros runtime geometry fields on unload', () => {
    const MockImage = stubHtmlImageElement();
    const store = createMockStore({
      ...initialAppState,
      loadedType: 'image',
    });
    const runtime = createImageRuntime();
    const mutable = runtime as MutableImageRuntime;
    runtime.loadedImg = new MockImage() as unknown as HTMLImageElement;
    mutable.displayScale = 2.5;
    mutable.workScale = 1.8;
    mutable.dispImgW = 500;
    mutable.dispImgH = 400;
    mutable.boxW = 200;
    mutable.boxH = 150;
    mutable.boxX = 100;
    mutable.boxY = 75;

    const controller = createImageController({
      store,
      elements: createMockElements(),
      runtime,
      output: createOutputRuntime(),
      pica: { resize: vi.fn() },
      worker: createMockWorker(),
      host: {
        clearStatus: vi.fn(),
        showError: vi.fn(),
        clearHistogramView: vi.fn(),
        resetSession: vi.fn(),
      },
      clearSnap: vi.fn(),
    });

    controller.unloadImage();

    expect(runtime.displayScale).toBe(1);
    expect(runtime.workScale).toBe(1);
    expect(runtime.dispImgW).toBe(0);
    expect(runtime.dispImgH).toBe(0);
    expect(runtime.boxW).toBe(0);
    expect(runtime.boxH).toBe(0);
    expect(runtime.boxX).toBe(0);
    expect(runtime.boxY).toBe(0);
    expect(runtime.loadedImg).toBeNull();

    vi.unstubAllGlobals();
  });
});

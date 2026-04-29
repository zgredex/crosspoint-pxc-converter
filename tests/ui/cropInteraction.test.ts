import { afterEach, describe, expect, it, vi } from 'vitest';

import { setupCropInteraction } from '../../src/ui/cropInteraction';

type Listener = (event: Event) => void;

class FakeEventHub {
  private listeners = new Map<string, Map<EventListenerOrEventListenerObject, Listener>>();

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const callback: Listener = typeof listener === 'function'
      ? listener
      : event => listener.handleEvent(event as Event);
    const set = this.listeners.get(type) ?? new Map<EventListenerOrEventListenerObject, Listener>();
    set.set(listener, callback);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const set = this.listeners.get(type);
    if (!set) return;
    set.delete(listener);
  }

  emit(type: string, event: Event): void {
    const set = this.listeners.get(type);
    if (!set) return;
    for (const callback of set.values()) callback(event);
  }
}

function createClassList() {
  return {
    remove: vi.fn(),
    toggle: vi.fn(),
  };
}

function mouseEvent(x: number, y: number, preventDefault?: () => void): MouseEvent {
  return {
    clientX: x,
    clientY: y,
    preventDefault: preventDefault ?? vi.fn(),
  } as unknown as MouseEvent;
}

describe('setupCropInteraction', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('compensates drag deltas with frame scroll movement', () => {
    const fakeWindow = Object.assign(new FakeEventHub(), {
      setTimeout: vi.fn(() => 1),
    });
    vi.stubGlobal('window', fakeWindow);

    const cropBox = Object.assign(new FakeEventHub(), {
      style: {},
      classList: createClassList(),
    }) as unknown as HTMLDivElement;
    const sourceCanvas = Object.assign(new FakeEventHub(), {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 1, height: 1 }),
    }) as unknown as HTMLCanvasElement;
    const sourceFrame = Object.assign(new FakeEventHub(), {
      scrollLeft: 10,
      scrollTop: 5,
      clientWidth: 100,
      clientHeight: 100,
    }) as unknown as HTMLDivElement;
    const snapGuideH = { style: {}, classList: createClassList() } as unknown as HTMLDivElement;
    const snapGuideV = { style: {}, classList: createClassList() } as unknown as HTMLDivElement;

    const boxState = {
      dispImgW: 500,
      dispImgH: 400,
      boxW: 100,
      boxH: 80,
      boxX: 40,
      boxY: 30,
    };
    const applyCropBox = vi.fn();
    const nudgeCropBoxIntoView = vi.fn();

    setupCropInteraction({
      cropBox,
      sourceCanvas,
      sourceFrame,
      snapGuideH,
      snapGuideV,
      snapThreshold: 0,
      wheelZoomK: 0.0015,
      isImageLoaded: () => true,
      getEditorZoom: () => 1,
      applyEditorZoom: vi.fn(),
      getMode: () => 'crop',
      getBoxState: () => boxState,
      setBoxPosition: (x, y) => {
        boxState.boxX = x;
        boxState.boxY = y;
      },
      applyCropBox,
      nudgeCropBoxIntoView,
      scheduleConvert: vi.fn(),
    });

    (cropBox as unknown as FakeEventHub).emit('mousedown', mouseEvent(100, 100));
    sourceFrame.scrollLeft = 30;
    sourceFrame.scrollTop = 25;
    fakeWindow.emit('mousemove', mouseEvent(112, 109));

    expect(boxState.boxX).toBe(72);
    expect(boxState.boxY).toBe(59);
    expect(applyCropBox).toHaveBeenCalledWith(false);
    expect(nudgeCropBoxIntoView).toHaveBeenCalledWith(0);
  });

  it('locks crop box visibility when source frame scrolls', () => {
    const fakeWindow = Object.assign(new FakeEventHub(), {
      setTimeout: vi.fn(() => 1),
    });
    vi.stubGlobal('window', fakeWindow);

    const cropBox = Object.assign(new FakeEventHub(), {
      style: {},
      classList: createClassList(),
    }) as unknown as HTMLDivElement;
    const sourceCanvas = Object.assign(new FakeEventHub(), {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 1, height: 1 }),
    }) as unknown as HTMLCanvasElement;
    const sourceFrame = Object.assign(new FakeEventHub(), {
      scrollLeft: 10,
      scrollTop: 5,
      clientWidth: 100,
      clientHeight: 100,
    }) as unknown as HTMLDivElement;
    const snapGuideH = { style: {}, classList: createClassList() } as unknown as HTMLDivElement;
    const snapGuideV = { style: {}, classList: createClassList() } as unknown as HTMLDivElement;
    const nudgeCropBoxIntoView = vi.fn();

    setupCropInteraction({
      cropBox,
      sourceCanvas,
      sourceFrame,
      snapGuideH,
      snapGuideV,
      snapThreshold: 0,
      wheelZoomK: 0.0015,
      isImageLoaded: () => true,
      getEditorZoom: () => 1,
      applyEditorZoom: vi.fn(),
      getMode: () => 'crop',
      getBoxState: () => ({
        dispImgW: 500,
        dispImgH: 400,
        boxW: 100,
        boxH: 80,
        boxX: 0,
        boxY: 0,
      }),
      setBoxPosition: vi.fn(),
      applyCropBox: vi.fn(),
      nudgeCropBoxIntoView,
      scheduleConvert: vi.fn(),
    });

    (sourceFrame as unknown as FakeEventHub).emit('scroll', {} as Event);

    expect(nudgeCropBoxIntoView).toHaveBeenCalledWith(0);
  });

  it('suppresses Space scrolling only while dragging', () => {
    const fakeWindow = Object.assign(new FakeEventHub(), {
      setTimeout: vi.fn(() => 1),
    });
    vi.stubGlobal('window', fakeWindow);

    const cropBox = Object.assign(new FakeEventHub(), {
      style: {},
      classList: createClassList(),
    }) as unknown as HTMLDivElement;
    const sourceCanvas = Object.assign(new FakeEventHub(), {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 1, height: 1 }),
    }) as unknown as HTMLCanvasElement;
    const sourceFrame = Object.assign(new FakeEventHub(), {
      scrollLeft: 0,
      scrollTop: 0,
      clientWidth: 100,
      clientHeight: 100,
    }) as unknown as HTMLDivElement;
    const snapGuideH = { style: {}, classList: createClassList() } as unknown as HTMLDivElement;
    const snapGuideV = { style: {}, classList: createClassList() } as unknown as HTMLDivElement;

    setupCropInteraction({
      cropBox,
      sourceCanvas,
      sourceFrame,
      snapGuideH,
      snapGuideV,
      snapThreshold: 0,
      wheelZoomK: 0.0015,
      isImageLoaded: () => true,
      getEditorZoom: () => 1,
      applyEditorZoom: vi.fn(),
      getMode: () => 'crop',
      getBoxState: () => ({
        dispImgW: 500,
        dispImgH: 400,
        boxW: 100,
        boxH: 80,
        boxX: 0,
        boxY: 0,
      }),
      setBoxPosition: vi.fn(),
      applyCropBox: vi.fn(),
      nudgeCropBoxIntoView: vi.fn(),
      scheduleConvert: vi.fn(),
    });

    const duringDragPrevent = vi.fn();
    const afterDragPrevent = vi.fn();

    (cropBox as unknown as FakeEventHub).emit('mousedown', mouseEvent(100, 100));
    fakeWindow.emit('keydown', {
      code: 'Space',
      key: ' ',
      preventDefault: duringDragPrevent,
    } as unknown as KeyboardEvent);
    fakeWindow.emit('mouseup', {} as MouseEvent);
    fakeWindow.emit('keydown', {
      code: 'Space',
      key: ' ',
      preventDefault: afterDragPrevent,
    } as unknown as KeyboardEvent);

    expect(duringDragPrevent).toHaveBeenCalledTimes(1);
    expect(afterDragPrevent).not.toHaveBeenCalled();
  });

  it('suppresses scroll navigation keys while hovering crop editor', () => {
    const fakeWindow = Object.assign(new FakeEventHub(), {
      setTimeout: vi.fn(() => 1),
    });
    vi.stubGlobal('window', fakeWindow);

    const cropBox = Object.assign(new FakeEventHub(), {
      style: {},
      classList: createClassList(),
    }) as unknown as HTMLDivElement;
    const sourceCanvas = Object.assign(new FakeEventHub(), {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 1, height: 1 }),
    }) as unknown as HTMLCanvasElement;
    const sourceFrame = Object.assign(new FakeEventHub(), {
      scrollLeft: 0,
      scrollTop: 0,
      clientWidth: 100,
      clientHeight: 100,
    }) as unknown as HTMLDivElement;
    const snapGuideH = { style: {}, classList: createClassList() } as unknown as HTMLDivElement;
    const snapGuideV = { style: {}, classList: createClassList() } as unknown as HTMLDivElement;

    setupCropInteraction({
      cropBox,
      sourceCanvas,
      sourceFrame,
      snapGuideH,
      snapGuideV,
      snapThreshold: 0,
      wheelZoomK: 0.0015,
      isImageLoaded: () => true,
      getEditorZoom: () => 1,
      applyEditorZoom: vi.fn(),
      getMode: () => 'crop',
      getBoxState: () => ({
        dispImgW: 500,
        dispImgH: 400,
        boxW: 100,
        boxH: 80,
        boxX: 0,
        boxY: 0,
      }),
      setBoxPosition: vi.fn(),
      applyCropBox: vi.fn(),
      nudgeCropBoxIntoView: vi.fn(),
      scheduleConvert: vi.fn(),
    });

    const whileHoverPrevent = vi.fn();
    const afterLeavePrevent = vi.fn();

    (sourceFrame as unknown as FakeEventHub).emit('mouseenter', {} as Event);
    fakeWindow.emit('keydown', {
      key: 'ArrowDown',
      preventDefault: whileHoverPrevent,
    } as unknown as KeyboardEvent);

    (sourceFrame as unknown as FakeEventHub).emit('mouseleave', {} as Event);
    fakeWindow.emit('keydown', {
      key: 'ArrowDown',
      preventDefault: afterLeavePrevent,
    } as unknown as KeyboardEvent);

    expect(whileHoverPrevent).toHaveBeenCalledTimes(1);
    expect(afterLeavePrevent).not.toHaveBeenCalled();
  });
});

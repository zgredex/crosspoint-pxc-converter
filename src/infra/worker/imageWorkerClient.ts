import type { WorkerOutMessage, WorkerSettings } from './workerProtocol';

export type WorkerErrorEvent = Extract<WorkerOutMessage, { type: 'error' }>;
export type WorkerResultEvent = Extract<WorkerOutMessage, { type: 'result' }>;

export type ImageWorkerClient = {
  setBaseRaster(buffer: SharedArrayBuffer, width: number, height: number, version: number): void;
  process(settings: WorkerSettings, version: number): void;
  onResult(callback: (result: WorkerResultEvent) => void): void;
  onError(callback: (error: WorkerErrorEvent) => void): void;
  terminate(): void;
};

export function createImageWorkerClient(): ImageWorkerClient {
  const worker = new Worker(
    new URL('./imageWorker.ts', import.meta.url),
    { type: 'module' },
  );

  let resultCallback: ((result: WorkerResultEvent) => void) | null = null;
  let errorCallback: ((error: WorkerErrorEvent) => void) | null = null;
  let terminated = false;

  worker.addEventListener('message', (e: MessageEvent<WorkerOutMessage>) => {
    if (terminated) return;
    if (e.data.type === 'result' && resultCallback) {
      resultCallback(e.data);
      return;
    }
    if (e.data.type === 'error' && errorCallback) {
      errorCallback(e.data);
    }
  });

  // Surface unexpected worker crashes (e.g. parse errors, OOM) that bypass the protocol.
  worker.addEventListener('error', (event) => {
    if (terminated || !errorCallback) return;
    errorCallback({
      type: 'error',
      phase: 'process',
      version: -1,
      message: event.message || 'worker crashed',
    });
  });

  return {
    setBaseRaster(buffer, width, height, version) {
      worker.postMessage({ type: 'set-base-raster', buffer, width, height, version });
    },
    process(settings, version) {
      worker.postMessage({ type: 'process', settings, version });
    },
    onResult(callback) {
      resultCallback = callback;
    },
    onError(callback) {
      errorCallback = callback;
    },
    terminate() {
      terminated = true;
      resultCallback = null;
      errorCallback = null;
      worker.terminate();
    },
  };
}

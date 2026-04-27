import type { DitherMode } from '../../domain/dither';
import type { WorkerSettings, WorkerOutMessage } from './imageWorker';

export type ImageWorkerClient = {
  setBaseRaster(buffer: SharedArrayBuffer, width: number, height: number, version: number): void;
  process(settings: WorkerSettings, version: number): void;
  onResult(callback: (result: Extract<WorkerOutMessage, { type: 'result' }>) => void): void;
  terminate(): void;
};

export function createImageWorkerClient(): ImageWorkerClient {
  const worker = new Worker(
    new URL('./imageWorker.ts', import.meta.url),
    { type: 'module' },
  );

  let resultCallback: ((result: Extract<WorkerOutMessage, { type: 'result' }>) => void) | null = null;

  worker.addEventListener('message', (e: MessageEvent<WorkerOutMessage>) => {
    if (e.data.type === 'result' && resultCallback) {
      resultCallback(e.data);
    }
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
    terminate() {
      worker.terminate();
    },
  };
}

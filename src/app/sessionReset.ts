import { actions } from './actions';
import { getContext2d } from '../infra/canvas/context';
import { clearOutputBytes, type OutputRuntime } from './runtime/outputRuntime';
import type { AppStore } from './store';

type ResetSessionDeps = {
  store: AppStore;
  output: OutputRuntime;
  previewCanvas: HTMLCanvasElement;
  fileInput: HTMLInputElement;
  clearStatus: () => void;
};

export function resetSession(deps: ResetSessionDeps): void {
  deps.clearStatus();
  deps.store.dispatch(actions.setLoadedType(null));
  clearOutputBytes(deps.output);
  deps.store.dispatch(actions.outputClear());
  deps.store.dispatch(actions.outputSetBaseName('sleep'));

  const { targetW, targetH } = deps.store.getState().device;
  getContext2d(deps.previewCanvas).clearRect(0, 0, targetW, targetH);
  deps.fileInput.value = '';
}

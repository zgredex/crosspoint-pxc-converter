import { actions } from './actions';
import type { AppStore } from './store';

export function clearStatus(store: AppStore): void {
  store.dispatch(actions.uiClearMessage());
}

export function showError(store: AppStore, message: string): void {
  store.dispatch(actions.uiSetMessage('error', message));
}

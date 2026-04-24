import type { AppAction } from './actions';
import { reducer } from './reducer';
import { initialAppState, type AppState } from './state';

type Listener = () => void;

export type AppStore = {
  getState(): AppState;
  dispatch(action: AppAction): void;
  subscribe(listener: Listener): () => void;
};

export function createStore(initialState: AppState = initialAppState): AppStore {
  let state = initialState;
  const listeners = new Set<Listener>();

  return {
    getState() {
      return state;
    },
    dispatch(action) {
      state = reducer(state, action);
      listeners.forEach(listener => listener());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const store = createStore();

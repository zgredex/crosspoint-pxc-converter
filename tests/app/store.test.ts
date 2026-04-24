import { describe, expect, it, vi } from 'vitest';

import { actions } from '../../src/app/actions';
import { createStore } from '../../src/app/store';

describe('app store', () => {
  it('dispatches actions and notifies subscribers', () => {
    const store = createStore();
    const listener = vi.fn();

    const unsubscribe = store.subscribe(listener);
    store.dispatch(actions.imageSetDitherMode('bayer'));

    expect(store.getState().image.ditherMode).toBe('bayer');
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    store.dispatch(actions.imageSetDitherMode('fs'));
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

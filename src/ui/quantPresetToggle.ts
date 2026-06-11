import { DEFAULT_QUANT_PRESET, QUANT_PRESET_LABELS, type QuantPreset } from '../domain/quantize';
import { actions } from '../app/actions';
import type { AppStore } from '../app/store';

const STORAGE_KEY = 'quantPreset';
const VALID: ReadonlyArray<QuantPreset> = ['pr1614', 'master'];

function isValidPreset(v: unknown): v is QuantPreset {
  return typeof v === 'string' && (VALID as ReadonlyArray<string>).includes(v);
}

function loadStoredPreset(): QuantPreset {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (isValidPreset(raw)) return raw;
  } catch {
    // localStorage unavailable (private mode / SSR) — fall through to default
  }
  return DEFAULT_QUANT_PRESET;
}

function persistPreset(p: QuantPreset): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, p);
  } catch {
    // best-effort persistence
  }
}

function labelFor(p: QuantPreset): string {
  return `Quant: ${QUANT_PRESET_LABELS[p]}`;
}

let toastEl: HTMLDivElement | null = null;
let toastTimer: number | null = null;

function showToast(message: string): void {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.setAttribute('role', 'status');
    toastEl.style.cssText = [
      'position:fixed',
      'left:50%',
      'bottom:24px',
      'transform:translateX(-50%)',
      'padding:8px 14px',
      'background:rgba(20,20,20,0.88)',
      'color:#f5f5f5',
      'font:13px/1.3 system-ui,-apple-system,Segoe UI,sans-serif',
      'border-radius:999px',
      'pointer-events:none',
      'z-index:9999',
      'opacity:0',
      'transition:opacity 140ms ease-out',
    ].join(';');
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = message;
  requestAnimationFrame(() => {
    if (toastEl) toastEl.style.opacity = '1';
  });
  if (toastTimer !== null) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    if (toastEl) toastEl.style.opacity = '0';
  }, 1600);
}

export type InstallQuantPresetToggleDeps = {
  store: AppStore;
  requestReprocess: () => void;
};

export function installQuantPresetToggle(deps: InstallQuantPresetToggleDeps): void {
  const initial = loadStoredPreset();
  if (initial !== deps.store.getState().quantPreset) {
    deps.store.dispatch(actions.setQuantPreset(initial));
  }

  window.addEventListener('keydown', (e) => {
    if (!e.shiftKey) return;
    if (!(e.ctrlKey || e.metaKey)) return;
    const isQ = e.code === 'KeyQ' || (typeof e.key === 'string' && e.key.toLowerCase() === 'q');
    if (!isQ) return;
    e.preventDefault();

    const current = deps.store.getState().quantPreset;
    const next: QuantPreset = current === 'pr1614' ? 'master' : 'pr1614';
    deps.store.dispatch(actions.setQuantPreset(next));
    persistPreset(next);
    showToast(labelFor(next));
    deps.requestReprocess();
  });
}

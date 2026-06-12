# Architecture conformance audit — `code-map.md` vs. `src/`

Audit date: 2026-05-02. Findings grouped by severity. Line/column references are exact.

User decisions on remediation (2026-05-03): tighten code (not contract) for findings 1–4 and 9; doc-drift findings 5–8 deferred.

---

# Part 1 — Findings

## Definite contract violations

### 1. `infra/canvas/histogramRenderer.ts:4-5` — infra mutates app-runtime state

```ts
export function clearHistogram(canvas: HTMLCanvasElement, runtime: { lastHistogram: Float32Array | null }): void {
  runtime.lastHistogram = null;
```

- Section 2 forbids infra from "store knowledge" or "business rules".
- Section 5 says `lastHistogram` is written only by the worker result handler (and cleared by `unloadImage`). Right now an infra helper sets it to `null`.

---

### 2. `app/appController.ts:2` (and `:36`) — app imports from ui

```ts
import type { AppDom } from '../ui/dom';
…
type AppControllerDeps = { … dom: AppDom; … };
```

- The layering chain `domain ← infra ← app ← features ← ui` forbids `app → ui`.
- The section-2 wiring exception only whitelists *feature* imports for `bootstrap`/`appController`/`loaderRouter`, not ui.
- `AppDom` is only used in `resizeOutputCanvases` for `workCanvas` and `previewCanvas`.

---

### 3. Box geometry written outside `applyGeometry` in three feature paths

Section 5 / section 12 trap: "Don't write to `runtime.displayScale` / `workScale` / `dispImg{W,H}` / `box{X,Y,W,H}` outside `applyGeometry`"; the only blessed exception is *drag handlers* moving `boxX/boxY` via `setBoxPosition`. Current code:

| Location | What it does | Why it's a violation |
| --- | --- | --- |
| `features/image/controller.ts:159-163` | `setRotation` rotates the crop box via `setBoxRect` (commit `7c21336`) | Writes boxW/H too; not a drag handler |
| `features/image/controller.ts:177`, `:185` | `toggleMirrorH/V` move box via `setBoxPosition` | Mirror is not a drag handler |
| `features/image/controller.ts:513` | `fitDeviceAspectToCurrentBox` rewrites rect via `setBoxRect` | Not a drag handler |

---

### 4. `app/appController.ts:54` writes output bytes from a non-GB module

Section 5: "`output.{pxcBytes,bmpBytes}` are written only via `setOutputBytes`/`clearOutputBytes` … and only by the GB controller."

Today `appController.clearOutput()` calls `clearOutputBytes(deps.output)` directly when handling a device change with no active load. (`sessionReset.ts:17` also calls it, but sessionReset is at least the documented "shared unload ritual".)

---

## Documentation drift (code is fine; `code-map.md` is stale) — DEFERRED

### 5. Two modules absent from section 6 (Module index)

- `src/app/controllerHost.ts` — `ControllerHost` type passed into both feature controllers (`clearStatus`, `showError`, `clearHistogramView`, `resetSession`).
- `src/infra/worker/workerProtocol.ts` — `WorkerSettings`, `WorkerInMessage`, `WorkerOutMessage`. The doc still shows the protocol as "`imageWorker.ts` ↔ `imageWorkerClient.ts`" (section 3), but it now lives in its own file and both ends import it.

### 6. Section 9 `ImageRuntime` table is missing `sessionVersion`

Used as a cancellation guard in `loadImageFile` / async `convert` checkpoints (`controller.ts:118-120`, `:245-253`, `:405-418`, `:458`); bumped via `bumpImageSession`.

### 7. Section 6 "Key exports" for `domain/geometry.ts` is incomplete

Doc lists `computeEditorGeometry, buildImageRenderPlan, getImageAnalysisRegion, fitOffset`. The file also exports and the codebase consumes:

- `BoxRect`, `ResizeHandle`, `ASPECT_SNAP_THRESHOLD`
- `clampCropBox`, `isDeviceAspect`, `snapBoxToDeviceAspect`
- `fitDeviceAspectInside`, `resizeCropBox`, `displayBoxToSourceRect`

The reuse register (section 10) should also list these so future code doesn't reinvent crop-box clamp/aspect-snap math inline.

### 8. Section 2 wiring exception is narrower than reality

It blesses `bootstrap`/`appController`/`loaderRouter` to import "feature factories/types". `bootstrap.ts:16-28` actually pulls in 11 modules from `ui/*`:

`createDom`, `bindStoreControls`, `bindDownloadButtons`, `bindFileInput`, `bindGbScaleControls`, `bindImageControls`, `bindRotationControls`, `bindZoomControls`, `setupPreviewZoom`, `renderStoreState`, `setupImageCropInteraction`.

This is the only sane way to wire DOM bindings, but the doc should explicitly extend the wiring exception to ui imports for `bootstrap` (and only `bootstrap` — `appController` and `loaderRouter` shouldn't need them, see finding 2).

---

## Borderline

### 9. `ui/bindings.ts:110` reads `store.getState().image.mode` directly

The litmus test in section 2: "ui — am I about to read `store.getState()` directly? Stop; take a getter via deps."

- `bindings.ts` and `previewZoom.ts:16/24/26` reach into `deps.store.getState()` rather than wrapping each query as a getter the way `imageCropBridge.ts:29-47` does.
- Functionally fine (store still arrives via deps); strictly: doesn't follow the litmus.

---

## Clean

- No cross-feature imports (`features/image` ↔ `features/gb`).
- No `addEventListener` outside `ui/` (the three hits in `infra/` are worker `message` and `window 'resize'`, both legitimate).
- No `domain/` or `infra/` imports of higher layers.
- Pica is reachable only from `features/image/service.ts` (output) and `features/image/controller.ts:autoLevels` — the editor preview path uses `drawImage` only (`controller.ts:267`).
- Section-4 hot-path forbidden ops (`await`, pica, new SAB) are absent from `applyEditorZoom` / `applyGeometry` / `applyCropBoxToDom`.
- `setOutputBytes` only called from `features/gb/controller.ts:102`.

---

# Part 2 — Fix plan (findings 1–4 and 9)

## Context

User chose to tighten the code (not the contract) for all real violations. After these fixes, every layering and mutation rule in `code-map.md` sections 2 and 5 holds without exceptions, and the section-2 ui-litmus ("take a getter via deps; never read `store.getState()` directly") is satisfied across `ui/`. The doc-drift findings (5–8) are out of scope.

## Files modified

- `src/infra/canvas/histogramRenderer.ts` (drop runtime mutation)
- `src/features/image/controller.ts` (clear `lastHistogram` in `unloadImage`; reroute rotate/mirror/fit-aspect through `applyGeometry`)
- `src/app/appController.ts` (drop `AppDom`; drop `clearOutputBytes` call)
- `src/app/bootstrap.ts` (pass two canvas refs instead of `dom` to `createAppController`; update `clearHistogram` and `setupPreviewZoom` calls)
- `src/ui/bindings.ts` (add a `getMode` getter, remove direct `store.getState()`)
- `src/ui/previewZoom.ts` (replace `store` with three getters)
- `src/app/runtime/imageRuntime.ts` (`setBoxRect` becomes drag-only after rotation/mirror/fit are rerouted; rename optional)

No changes to `domain/`, the worker, or anything in `app/runtime/*` beyond the optional rename.

---

## Finding 1 — `infra/canvas/histogramRenderer.ts:clearHistogram` mutates runtime

**Goal:** infra stops touching runtime; runtime clearing happens at the controller layer.

1. In `src/infra/canvas/histogramRenderer.ts:4`, change the signature to `clearHistogram(canvas: HTMLCanvasElement)` and drop the `runtime.lastHistogram = null` line. Keep the `clearRect` call.
2. In `src/features/image/controller.ts` `unloadImage` (around line 209 next to `lastIndexedPixels = null`), add `deps.runtime.lastHistogram = null;`. This makes `unloadImage` the canonical clearer of both result fields.
3. In `src/app/bootstrap.ts:51-53`, `clearHistogramView` calls `clearHistogram(histogramCanvas)` with one arg. The `imageRuntime` parameter goes away.

**Reuse:** the existing `unloadImage` is already the documented single-source-of-truth for clearing image-pipeline runtime; we're just adding one missing line.

---

## Finding 2 — `app/appController.ts` imports `AppDom` from `ui/`

**Goal:** appController uses two canvas refs, not the whole DOM bag.

1. In `src/app/appController.ts`:
   - Drop `import type { AppDom } from '../ui/dom';` (line 2).
   - In `AppControllerDeps`, replace `dom: AppDom;` with `workCanvas: HTMLCanvasElement;` and `previewCanvas: HTMLCanvasElement;`.
   - In `resizeOutputCanvases` (lines 45-51), use `deps.workCanvas` / `deps.previewCanvas` directly.
2. In `src/app/bootstrap.ts:121-129`, change `createAppController({...})`: replace `dom` with `workCanvas: dom.workCanvas, previewCanvas: dom.previewCanvas`.

**Pattern reused:** mirrors `ImageControllerElements` / `GbControllerElements` in `src/features/image/controller.ts:55-62` and `src/features/gb/controller.ts` — the section-12 trap rule for features, applied here to app.

---

## Finding 3 — rotate / mirror / fit-aspect write box geometry outside `applyGeometry`

**Goal:** `commitGeometry` (called only from `applyGeometry`) becomes the only writer of `box{X,Y,W,H}` outside drag handlers' `setBoxPosition` (and the resize-drag's existing `setBoxRect`).

### Approach
Extend `applyGeometry` with an optional `boxOverride` so callers that need a non-default box (rotation, mirror, fit-to-aspect) can request it without writing the box themselves.

1. In `src/features/image/controller.ts`, modify the local `applyGeometry` signature (around line 290):
   ```
   function applyGeometry(
     src, sourceW, sourceH, geom, anchor: ScrollAnchor,
     options?: { forceCenter?: boolean; boxOverride?: BoxRect }
   ): void
   ```
   - `BoxRect` already exists in `src/domain/geometry.ts:136`; import it.
   - Replace the existing `forceCenter` parameter with `options.forceCenter`.
   - Inside applyGeometry, if `options?.boxOverride` is present, skip the `prevCenter*` math; pass the override's `{x, y, w, h}` straight into `commitGeometry` (instead of the computed `boxX`/`boxY`/`boxW`/`boxH`).

2. Update `resetEditor` (line 365) to accept an optional `boxOverride` param and forward it through unchanged behavior:
   - `applyGeometry(src, sourceW, sourceH, geom, { kind: 'box' }, { forceCenter, boxOverride });`

3. Replace the three direct-write call sites:
   - **`setRotation` (lines 153-167):** keep the rotated-box computation. Instead of calling `setBoxRect`, pass the rotated rect as `boxOverride` through `dispatchAndRetransform → refreshTransformedSource → resetEditor`. Concretely, give `dispatchAndRetransform` an optional `boxOverride` param and thread it down to `resetEditor`.
   - **`toggleMirrorH/V` (lines 174-188):** same pattern — compute the mirrored rect (current code mutates only `boxX`/`boxY`, so width/height stay), pass as `boxOverride`.
   - **`fitDeviceAspectToCurrentBox` (line 505):** instead of `setBoxRect` + `applyCropBoxToDom` + `requestConvert`, call `applyGeometry` directly with `boxOverride: fitted`. The current `applyCropBoxToDom` and scroll behavior is already done inside `applyGeometry`.

4. After steps 1–3, `setBoxRect` is no longer called from rotate/mirror/fit. The remaining caller is `imageCropBridge.ts:50` → `cropInteraction.ts:190` (resize drag), which is legitimate. Optional cleanup: rename `setBoxRect` → `setBoxRectFromDrag` to make the drag-only intent explicit.

5. Remove `setBoxRect` from imports in `src/features/image/controller.ts:10`.

**Reuse:**
- `commitGeometry` (`src/app/runtime/imageRuntime.ts:41`) is already the canonical writer.
- `BoxRect` (`src/domain/geometry.ts:136`) and `fitDeviceAspectInside` (`src/domain/geometry.ts:174`) stay as-is.

---

## Finding 4 — `app/appController.ts:54` clears output bytes from a non-GB module

**Goal:** `clearOutputBytes` is called only by GB controller (or session-clear ritual `sessionReset.ts`).

1. In `src/app/appController.ts`:
   - Delete the `clearOutput` helper (lines 53-56).
   - Delete the `clearOutputBytes` import on line 4 (keep `OutputRuntime` type).
   - In `handleDeviceChange` (line 73), replace `clearOutput();` with just `deps.store.dispatch(actions.outputClear());`.

**Why this is safe:** `output.pxcBytes`/`bmpBytes` are only ever set by the GB controller's `setOutputBytes`. They start `null` (initial state) and are nulled on every unload via `sessionReset` (called from `unloadGb` and `unloadImage` via `host.resetSession`). When `handleDeviceChange` reaches the fall-through branch, no image or gb is loaded, which means an unload already ran — bytes are already `null`. Dispatching `outputClear()` is enough to keep store-side `output.pxcReady` flag in sync.

---

## Finding 9 — `ui/` reads `store.getState()` directly

**Goal:** ui modules take getters via deps; only renders pull state.

1. **`src/ui/bindings.ts:110`** — replace `store.getState().image.mode` with a getter:
   - In `BindingDeps`, add `getMode: () => 'crop' | 'fit';`.
   - In bootstrap, pass `getMode: () => store.getState().image.mode`.
   - Replace the inline `store.getState()` read with `getMode()`.
   - The `dispatch` calls already go through `store` from deps; those are fine per section-2 litmus (the rule is about reads).

2. **`src/ui/previewZoom.ts`** — replace the three `deps.store.getState()` reads (lines 16, 24, 26) with three getters:
   - `getPreviewReady: () => boolean`
   - `getDeviceWidth: () => number` and `getDeviceHeight: () => number` (or one `getDevice: () => { targetW, targetH }`)
   - Drop the `store: AppStore` dep entirely; drop the `import type { AppStore }` line.

3. In `src/app/bootstrap.ts:145-150`, update the `setupPreviewZoom({...})` call to wire `() => store.getState().output.pxcReady`, `() => store.getState().device.targetW`, `() => store.getState().device.targetH`. Same pattern as `mountHistogramAutoResize` at lines 85-89.

**Reuse:** `mountHistogramAutoResize` at `src/infra/canvas/histogramRenderer.ts:24-28` already exemplifies this pattern (it takes `getHistogram` and `getTotalPixels` rather than the store). `imageCropBridge.ts:29-47` is the in-`ui/` reference.

---

## Verification

End-to-end checks (manual, in-browser via `npm run dev`):

1. **Wheel zoom** still anchored under cursor; no jank — finding 3 paths through `applyEditorZoom` are unchanged.
2. **Rotate cw/ccw with a crop box set** — box rotates with image and stays over the same source content (regression-test for the rotate change in `setRotation`).
3. **Mirror H/V** — box mirrors correctly; cropped area stays consistent.
4. **Fit-device-aspect button** — box snaps to device aspect, scroll behavior unchanged.
5. **Auto-levels** still works (writes nothing in this plan but exercises the convert pipeline).
6. **Tone/contrast/gamma sliders** — sub-frame, no SAB rebuild (cache-hit path unchanged).
7. **Device change with no file loaded** — no errors; output state reset.
8. **Load image → unload → load GB → unload** — histogram canvas clears correctly (regression-test for finding 1).
9. **Preview-zoom magnifier** appears on hover only when output is ready, follows cursor (finding 9 regression).

Automated:
- `npm test` — vitest covers `domain/*`, `app/store`, `app/reducer`, `features/{image,gb}/service`, `features/image/cropBox`. None of these files change, but the suite catches accidental regressions in callers.
- `npm run build` — `tsc --noEmit` will catch the signature changes (especially `applyGeometry`, `clearHistogram`, `AppControllerDeps`, `setupPreviewZoom`).

## Out of scope

- Findings 5–8 (doc drift in `code-map.md`). Tracked separately if needed.
- The `setBoxRect` → `setBoxRectFromDrag` rename (step 4 of finding 3) is recommended but optional; if churn is undesired, leave it as-is once non-drag callers are gone.

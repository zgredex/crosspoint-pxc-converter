# Aspect-ratio-lock toggle for crop mode

## Context

Today the crop box's aspect ratio is forced to the active device's AR (480:800 on X4, 528:792 on X3). That is the right default — the output uses every pixel of the device — but it makes it impossible to crop a tall slice of a wide source, or any other framing the user wants. We're adding a toggle that, when off, lets the user resize crop width and height independently. When the resulting crop AR doesn't match the device, the output is letterboxed onto the device target using the existing 3×3 position grid + background-fill machinery — i.e. crop borrows the same letterbox pipeline that fit mode uses today, instead of duplicating it.

Constraints baked into the design:

- **No upscaling.** Pica's job is to *down*scale. The minimum crop size in source pixels must be large enough that fitting it into the device target produces scale ≤ 1. With independent W and H, that condition is `min(targetW/cropSrcW, targetH/cropSrcH) ≤ 1`, i.e. at least one of `cropSrcW ≥ targetW` or `cropSrcH ≥ targetH` must hold.
- **Bounded by source.** `cropSrcW ≤ sourceW`, `cropSrcH ≤ sourceH`. When one axis hits source max, only that axis is pinned — the other remains free (per user choice).
- **Architectural purity.** All clamp/constraint math lives in `domain/`, all DOM/canvas in `infra/`/`ui/`, the controller orchestrates. The render plan is unified so fit and crop share one letterbox path (no parallel implementations).

UX (per user choices):
- Resize via 4 edge handles + 4 corner handles on the crop box (mainstream crop-tool pattern).
- Toggle lives in the existing `#scaleSection` panel under the Fit/Crop pills, styled like the Invert / Dither toggles.
- 3×3 fit-align grid becomes active in crop mode whenever the toggle is off **and** the crop AR doesn't match the device AR.

Default: locked.

---

## Design summary

Five threads, mostly small except #3 and #5:

1. **State**: add `aspectRatioLocked: boolean` (default `true`) to `ImageState`. Add an action + reducer case. Reducer also clears the lock as a no-op when device changes (the lock semantics don't change with device, but the box dims do).

2. **HTML + CSS**: insert a toggle in `#scaleSection`; insert 8 handle `<div>`s into `#cropBox`. Add `.crop-handle.*` CSS for the handles and a `.crop-box.unlocked` modifier so handles only show when unlocked + crop mode.

3. **Domain (pure)**: in `src/domain/geometry.ts`:
   - **Unify `ImageRenderPlan`.** Replace the two-shape union with one shape: `{ srcX, srcY, srcW, srcH, fittedWidth, fittedHeight, offsetX, offsetY }`. Fit mode sets `srcX=0, srcY=0, srcW=sourceW, srcH=sourceH`. Crop mode sets them to the box. Both end up "scale `(srcW × srcH)` of the source down to `(fittedWidth × fittedHeight)` and draw at `(offsetX, offsetY)` on the device canvas." This kills the dual-shape branching and is the natural fit for crop-with-letterbox.
   - **Extend `buildImageRenderPlan`** to accept `boxW`, `boxH` (source-pixel crop dims) instead of deriving them from `workScale`, and an `aspectRatioLocked` flag. When locked: behave exactly as today (cropW/H = `targetW/H / workScale`, output fills target). When unlocked: derive `(fittedWidth, fittedHeight)` by fitting the crop AR into the device target the same way fit-mode does, then call `fitOffset` with `fitAlign`.
   - **Add `clampCropBox`**: pure function that takes `(boxSrcW, boxSrcH, sourceW, sourceH, targetW, targetH, axisHint?)` and returns clamped source-pixel dims that satisfy both the source bound and the no-upscale rule. `axisHint` (`'w' | 'h' | 'both'`) lets resize gestures express which axis is being driven so the function clamps the *other* axis when needed (e.g., shrinking W below `targetW` forces H ≥ `targetH`).
   - **Update `getImageAnalysisRegion`** to use the unified shape — it just reads `offsetX/Y` + `fittedWidth/Height`, which after unification both modes have. Removes the `kind`-switch.
   - Currently `computeEditorGeometry` also encodes the AR-locked assumption via `workScale` and `maxZoom`. Two changes:
     - When `aspectRatioLocked` is false in crop mode, `workScale` and `maxZoom` should fall back to fit semantics (`fitScale`, `maxZoom = 1` — the editor is just "show the source 1:1 up to its native pixels"). Actually clearer: when unlocked, the editor treats the source itself as the canvas; the crop box just selects a sub-rect. `workScale` becomes irrelevant for box-sizing in that mode (we hold W/H in source pixels directly via the runtime).

4. **Service / worker path**: `src/features/image/service.ts:renderImageBaseRaster` already does background fill + drawImage at offset for fit. After plan unification, the fit and crop paths converge to a single code path — read source rect, downscale into a fitted canvas, drawImage at offset. ~15 LOC removed.

5. **Crop interaction (`src/ui/cropInteraction.ts` + new handle wiring)**:
   - Add 8 handle elements (DOM created in HTML, looked up via `dom.ts`).
   - On `mousedown`/`touchstart` on a handle: enter resize mode with handle direction (`n/s/e/w/ne/nw/se/sw`).
   - On move: convert pointer delta from display pixels to source pixels (divide by `displayScale`); apply to `boxW`/`boxH` (and `boxX`/`boxY` when the handle moves the top or left edge); call `clampCropBox` from domain; update runtime via `setBoxPosition` + a new `setBoxSize` runtime helper; commit DOM via `applyCropBoxToDom`. Same rAF-debounced `scheduleConvert` as today's drag.
   - On end: same as drag-end (clear snap, fire `onCropRegionChanged`).
   - When toggle is **on** (locked): handles are CSS-hidden and pointer-events:none — drag-position behavior unchanged.
   - Clicks on handles must `event.stopPropagation()` so they don't fall through to the existing whole-box drag listener.

6. **Toggle behavior** (in `features/image/controller.ts`, dispatched from `bindings.ts`):
   - **Lock → Unlock**: keep current `boxW/H/X/Y`. The first user action (handle drag) starts diverging from the device AR.
   - **Unlock → Lock**: snap the box back to device AR centred on the current box centre. Reuse `applyGeometry` with `forceCenter=false` after the toggle dispatch — `applyGeometry` already computes the AR-locked size and recentres around the previous centre. (One edit needed: `applyGeometry` currently always uses the AR-locked formula; that's what we want for the lock-back path. The unlocked path skips this part — see #3.)

---

## Concrete edits

### State
- `src/app/state.ts` — add `aspectRatioLocked: boolean` to `ImageState`; default `true` in `initialImageState`.
- `src/app/actions.ts` — add `image/setAspectRatioLocked` action + creator `imageSetAspectRatioLocked(value: boolean)`.
- `src/app/reducer.ts` — handle the new case (plain set). Also: when handling `image/resetAll`, reset `aspectRatioLocked: true`. (No need to touch `device/setKey`.)

### Domain (pure)
- `src/domain/geometry.ts`:
  - Replace the discriminated `ImageRenderPlan` union with one shape (see Design #3).
  - Update `buildImageRenderPlan` signature: take `aspectRatioLocked: boolean`, `boxW: number`, `boxH: number` (display-pixel box dims, like today), plus existing params. Add a `displayScale` divide on `boxW`/`boxH` to get source-pixel crop dims when unlocked.
  - Add `clampCropBox({ boxSrcW, boxSrcH, sourceW, sourceH, targetW, targetH, driving })` returning `{ boxSrcW, boxSrcH }` clamped per the no-upscale + source rules. `driving: 'w' | 'h' | 'both'` decides which axis to constrain when the candidate violates no-upscale.
  - Update `getImageAnalysisRegion` to read unified plan fields — drops the `kind` switch.
  - Update `computeEditorGeometry` to take `aspectRatioLocked`. When false in crop mode: behave like fit for editor scales (`workScale = fitScale`, `maxZoom = 1`). The editor canvas just shows the whole source at display scale; the crop box is a free sub-rect inside it.

### Service / worker
- `src/features/image/service.ts` — collapse the fit/crop branches into a single read-rect → downscale → drawImage-at-offset path, driven by the unified plan.

### Runtime
- `src/app/runtime/imageRuntime.ts` — add `setBoxSize(runtime, w, h)` setter alongside `setBoxPosition`, both writing only `boxW/H`. Keep the rule: these and `commitGeometry` are the only writers to `box*`. (The `code-map.md` mutation rule already allows this carve-out for drag handlers.)

### Controller
- `src/features/image/controller.ts`:
  - Plumb `aspectRatioLocked` through `geometryFor` → `computeEditorGeometry` and `buildImageRenderPlan` (used by `convert` and `autoLevels`).
  - In `applyGeometry`: when locked, current AR-derived `boxW/H` formula. When unlocked, *skip* that override — preserve the existing runtime `boxW/H` (or initialise to current AR-locked size on first unlock, which falls out naturally because previous frames left them at AR-locked values).
  - Add a small `notifyAspectRatioLockChanged()` (or fold into existing `setMode`-style flow): on lock-back, re-run `applyGeometry` with the locked formula so the box snaps to AR; on unlock, leave runtime values alone, just trigger a `requestConvert`. Both paths invalidate the base raster (the plan changed) — call `invalidateBaseRaster()` already used by background/fitAlign changes.

### UI
- `index.html`:
  - Inside `#scaleSection`, after the `.pill-group`, add a `.toggle-row` (same markup as Invert) with `id="aspectRatioLockToggle"` and label "Aspect ratio".
  - Inside `#cropBox`, add 8 child `<div>`s with classes `crop-handle crop-handle--{n,s,e,w,ne,nw,se,sw}` and `data-handle="…"`.
  - Update the help-tip on the Scale heading to mention the lock briefly.
- `src/styles/app.css`:
  - `.crop-handle` base style (8×8 px, absolute positioned, white fill + dark border, cursor by direction).
  - `.crop-handle--n/s/e/w/…` placement.
  - `#cropBox:not(.unlocked) .crop-handle { display: none; }` and `pointer-events: none` so locked behaviour is unchanged.
  - Reuse existing `.toggle/.toggle-track` for the new switch (no new CSS).
- `src/ui/dom.ts`:
  - Add `aspectRatioLockToggle: HTMLInputElement`.
  - Add `cropHandles: NodeListOf<HTMLDivElement>` (or 8 named refs — array is fine, we read `data-handle`).
- `src/ui/render.ts`:
  - Mirror checkbox: `dom.aspectRatioLockToggle.checked = state.image.aspectRatioLocked`.
  - Toggle `#cropBox.unlocked` class based on `state.image.mode === 'crop' && !state.image.aspectRatioLocked`.
  - **fit-align gate** (line 51): change to enable `posSection` when `mode === 'fit'` OR (`mode === 'crop' && !aspectRatioLocked`). Always show when crop+unlocked — the position grid is harmless when AR happens to match (the empty letterbox is just zero-width). Saves a "matches device" check.
  - Keep position grid disabled (visually muted) when none of those conditions hold — same `disabled` toggle.
- `src/ui/bindings.ts`:
  - Add a `change` listener on `aspectRatioLockToggle` mirroring `invertToggle`'s pattern: dispatch `imageSetAspectRatioLocked`, call `deps.invalidateBaseRaster()`, call `scheduleConvert()`, plus a new `deps.onAspectRatioLockChanged()` that hits `controller.notifyAspectRatioLockChanged()` so `applyGeometry` runs the lock-back snap.
- `src/ui/cropInteraction.ts`:
  - Extend `CropInteractionDeps` with `getAspectRatioLocked: () => boolean`, `setBoxSize: (w, h) => void`. Import `clampCropBox` directly from `domain/geometry.ts` (ui → domain is allowed by the layer chain).
  - New `onHandleStart/Move/End` handlers attached to each handle. Direction-aware delta: `n` moves only `boxY` and `boxH`, `e` only `boxW`, `ne` both, etc. Translate display-pixel delta to source pixels via `displayScale`. Call `clampCropBox`. Commit via `setBoxPosition`/`setBoxSize` then `applyCropBox(false)`.
  - On `mousedown`/`touchstart` on a handle, `event.stopPropagation()` so the existing whole-box drag listener doesn't fire.

---

## Critical files

- `src/app/state.ts`, `src/app/actions.ts`, `src/app/reducer.ts`
- `src/domain/geometry.ts` (largest pure-code change: plan unification + clamp helper)
- `src/app/runtime/imageRuntime.ts` (add `setBoxSize`)
- `src/features/image/service.ts` (collapse fit/crop branches — DRY win)
- `src/features/image/controller.ts` (`applyGeometry`, `geometryFor`, new lock-change notifier)
- `src/ui/dom.ts`, `src/ui/render.ts`, `src/ui/bindings.ts`, `src/ui/cropInteraction.ts`
- `src/styles/app.css` (handle styles)
- `index.html` (toggle row + 8 handle divs)
- Tests:
  - `tests/domain/geometry.test.ts` (or new) — unit-test `clampCropBox` for all four edges of the no-upscale rule + source-bound clamping.
  - Update `tests/features/image.controller.test.ts` if it asserts plan shape.
- `code-map.md`:
  - Section 3 "Single-source rules" — add `clampCropBox` row, update `buildImageRenderPlan` row.
  - Section 5 "Mutation rules" — note `setBoxSize` as a co-writer alongside `setBoxPosition` and `commitGeometry`.
  - Section 9 — confirm `boxW`/`boxH` writer list.
  - Section 11 fluidity playbook — add "Crop resize handle drag" row mirroring "Crop drag" (sub-frame, no pica, no SAB).

---

## Verification

1. `npm run build` — TypeScript clean. Plan-shape change ripples through several files; the compiler is the safety net.
2. `npm test` — existing 67 pass + new `clampCropBox` tests pass.
3. `npm run dev`:
   - Load a 4000×3000 image. Default state: AR-locked, behaves exactly as before.
   - Flip the toggle. Drag E handle: width grows up to source W; once at source W, width pins. H still freely resizable.
   - Shrink W below device target W: at the boundary where `min(targetW/W, targetH/H) = 1`, further shrink is rejected.
   - Resize until crop AR ≠ device AR. Confirm: position grid (3×3) becomes active; output preview shows letterbox with chosen background; clicking different positions moves the letterboxed image.
   - Toggle back to locked: box snaps back to device AR centred on previous box centre. fit-align grid disables again.
   - Wheel-zoom while AR-unlocked: editor zoom still works; box stays unchanged in source-pixel terms (display dims update). No upscaling.
   - Auto-levels works: re-runs on resize via `notifyCropRegionChanged` (already wired for drag/zoom; resize ends should fire the same hook).
4. Switch device X4 ↔ X3 with AR unlocked: box dims stay in source pixels, `clampCropBox` re-runs with new target — if the previous size now violates no-upscale, it gets clamped on next `applyGeometry`/convert pass.
5. Mirror / rotate with AR unlocked: existing `forceCenter` behaviour preserves the box; verify W/H are swapped correctly on 90°/270° rotation (today they're recomputed from device AR — with the new path, swap `boxW`/`boxH` in source pixels too if currently unlocked).

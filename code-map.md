# Code map — crosspoint-pxc-converter

> Read this before any non-trivial change. The first six sections are the contract; the rest is reference.

**Sections**: [What this is](#1-what-this-is) · [Layering](#2-layering-contract-architectural-purity) · [Single-source rules](#3-single-source-rules-no-duplication) · [Fluidity hot paths](#4-fluidity-hot-paths-do-not-regress) · [Mutation rules](#5-mutation-rules) · [Module index](#6-module-index) · [Data flow](#7-data-flow) · [Concurrency](#8-concurrency--versioning) · [Runtime objects](#9-runtime-objects) · [Reuse register](#10-reuse-register) · [Fluidity playbook](#11-fluidity-playbook) · [Architectural traps](#12-architectural-traps--concrete-donts) · [Test coverage](#13-test-coverage-map)

---

## 1. What this is

A browser-only converter from arbitrary images / Game Boy Printer captures (`.2bpp`, `.bin`, `.gb`, `.txt`) to:

- `.pxc` — XTeink e-paper raster format (4 levels of gray, packed 2bpp).
- `.bmp` — 8-bit grayscale BMP.
- `.bmp` — Game Boy palette BMP (when the source is a GB capture).

No backend. No framework. Plain DOM + a hand-rolled flux-style store. The dither/tone pipeline runs in a Web Worker over a SharedArrayBuffer (so COOP/COEP headers are required in production — see `public/_headers`). Pica (Lanczos) is used for high-quality downscaling on the *output* path only.

---

## 2. Layering contract (architectural purity)

Strict, one-directional import graph. Each layer may only import from layers further left in this chain:

```
domain  ←  infra  ←  app  ←  features  ←  ui
```

| Layer | Allowed | Forbidden |
| --- | --- | --- |
| `domain/` | Pure TS only. Math, encoders, parsers, geometry. | DOM, store, runtime, browser globals, async I/O. |
| `infra/` | Browser/canvas/worker/file-IO adapters. | App logic, store knowledge, business rules. |
| `app/` | Store, reducer, runtime objects, top-level controllers (orchestration only — wires features together). | Direct DOM event wiring. |
| `features/{image,gb}/` | Feature controllers + wiring. Mutates feature runtime + DOM through provided refs. | `addEventListener` directly. Cross-feature imports (image must not import from gb and vice versa). |
| `ui/` | DOM event wiring (`addEventListener`), pure render of state, DOM lookup helpers. | Knowledge of store/runtime. Takes everything via deps callbacks. |

**Litmus test for each layer:**
- `domain/` — would this run in node without DOM? If no, wrong layer.
- `infra/` — does this know about app state or business logic? If yes, wrong layer.
- `features/` — am I about to call `el.addEventListener(...)`? Stop; bridge through `ui/`. Am I about to import from `ui/`? Stop; the bridge belongs in `ui/`, not here.
- `ui/` — am I about to read `store.getState()` directly? Stop; take a getter via deps.

**Wiring exception:** `app/bootstrap.ts`, `app/appController.ts`, and `app/loaderRouter.ts` may import feature factories/types to compose the runtime graph — they are the wiring layer, sitting *above* features for composition while still owning the store/runtime contract. The "app must not import from features" reading of the chain applies to non-wiring app modules (`store`, `reducer`, `state`, `actions`, `messages`, `validation`, `sessionReset`, `runtime/*`).

---

## 3. Single-source rules (no duplication)

For each piece of logic, exactly one canonical home. **Adding a parallel implementation is the failure mode this section prevents.**

| Logic | Canonical home |
| --- | --- |
| Editor scale math (`displayScale`, `workScale`, `maxZoom`, clamped zoom, dispImg dims) | `domain/geometry.ts:computeEditorGeometry` |
| Crop region / fit offsets in source-pixel coordinates | `domain/geometry.ts:buildImageRenderPlan` (used by convert AND autoLevels) |
| Image source rotation/mirroring | `features/image/source.ts:buildRotatedSource` + `getSourceImage` |
| Source natural dimensions (display label) | `state.image.sourceDims` set by `features/image/controller.ts:loadImageFile` from `loadedImg.naturalWidth/Height`; GB side reuses `state.gb.dims` set by `features/gb/controller.ts:decodeGbDraw`. Rendered into `sourceLabel` by `ui/render.ts`. |
| Source-canvas redraw (editor preview, **not** output) | `features/image/controller.ts:redrawSourceCanvas` — native `drawImage`, never pica |
| Geometry commit (writing scales / box / canvas size / frame size to runtime+DOM) | `features/image/controller.ts:applyGeometry` — both `resetEditor` and `applyEditorZoom` route through it; differ only by `ScrollAnchor` |
| Pica / Lanczos resampling | `infra/canvas/picaResize.ts:stepDownscaleAndResize`, called only from `features/image/service.ts:renderImageBaseRaster` and `features/image/controller.ts:autoLevels`. **Never in the editor preview.** |
| Tone mapping | `domain/tone.ts:buildToneLut` — single 256-entry LUT (commit `954638b`). Don't reintroduce per-pixel branching. |
| Render of state → DOM | `ui/render.ts:renderStoreState` — pure function; subscribed once by the store in `app/bootstrap.ts`. |
| Output encoding | `domain/formats/{pxc,bmpGray,bmpGb}.ts` |
| GB tile decode | `domain/gb/decode2bpp.ts` |
| GB Printer text parsing | `domain/gb/parsePrinterTxt.ts` |
| GB pixel rotation | `domain/gb/rotatePixels.ts` |
| GB source canvas painting | `infra/canvas/gbSourceRenderer.ts:renderGbSourceCanvas` |
| Histogram drawing | `infra/canvas/histogramRenderer.ts:renderHistogram` |
| Indexed-pixel preview painting | `infra/canvas/previewRenderer.ts:renderIndexedPreview` |
| File download | `infra/browser/downloads.ts:triggerDownload` |
| Shared session-reset ritual (clearStatus, clear output bytes/state, clear preview, reset file input) | `app/sessionReset.ts:resetSession` — called by both controllers' unload paths |
| File reading | `infra/browser/imageLoader.ts:{readFileAsDataUrl, readFileAsArrayBuffer, readFileAsText, loadImageFromDataUrl}` |
| Clipboard image read | `infra/browser/clipboard.ts` |
| Auto-levels analysis | `domain/tone.ts:computeAutoLevels` over `buildLuminanceBuffer` + `buildUintHistogram` |
| Worker process protocol | `infra/worker/imageWorker.ts` (the worker) ↔ `infra/worker/imageWorkerClient.ts` (the host) |

---

## 4. Fluidity hot paths (do not regress)

Three user interactions must stay sub-frame. Anything on these paths that adds latency is a regression.

### Wheel / pinch zoom — sub-frame, sync
```
wheel event
  → ui/cropInteraction.ts (wheel listener)
  → features/image/controller.ts:applyEditorZoom
    → domain/geometry.ts:computeEditorGeometry  (pure, fast)
    → applyGeometry (sync; mutates runtime + redraws canvas via drawImage)
  → requestConvert (rAF-debounced; runs in next frame, parallel with worker)
```
**Forbidden on this path:** `await`, pica, `getImageData`, `new SharedArrayBuffer`, full output convert, layout-thrashing reads after writes.

### Crop drag — sub-frame, sync
```
mousemove/touchmove
  → ui/cropInteraction.ts:onDragMove
  → features/image/cropBox.ts:applyCropBoxToDom  (style writes only, optional auto-scroll)
  → requestConvert (rAF)
```
**Forbidden on this path:** source-canvas redraw, pica, anything that scales with source size.

### Tone / contrast / gamma slider — cache hit
```
input event
  → ui/bindings.ts (slider handler)
  → store.dispatch(...)
  → requestConvert (rAF)
  → features/image/controller.ts:convert
    → rasterDirty=false → skip raster rebuild (cache hit)
    → worker.process(settings, version)
  → onResult → renderIndexedPreview + renderHistogram
```
**Forbidden on this path:** `rasterDirty=true` (re-runs pica), changing the SharedArrayBuffer.

The convert pipeline is rAF-debounced (`requestConvert` cancels the in-flight rAF and re-schedules). Stale results are dropped via `processVersion`.

---

## 5. Mutation rules

- **All app state** flows through `actions` + `reducer`. Components subscribe via `store.subscribe(render)`. Never mutate `state` directly.
- **All large mutable objects** (canvases, timers, indexed pixel buffers, base-raster buffers, generation counters, raw GB bytes, decoded pixel arrays, encoded output byte buffers) live in `app/runtime/{image,gb,output}Runtime.ts`. They are *not* in the store.
- **`runtime.displayScale` / `workScale` / `dispImgW` / `dispImgH` / `box{X,Y,W,H}`** are written **only** by `applyGeometry` (and zeroed by `unloadImage`). Don't write to them anywhere else.
- **`runtime.cachedBaseRaster` / `sharedBufferVersion`** are written only by `convert` (image controller). Cleared by `unloadImage`.
- **`output.{pxcBytes,bmpBytes}`** are written only via `setOutputBytes` / `clearOutputBytes` from `outputRuntime.ts` — and only by the GB controller (the image path encodes lazily on download).

---

## 6. Module index

| Path | Layer | Responsibility | Key exports |
| --- | --- | --- | --- |
| `src/main.ts` | entry | Imports `app/bootstrap`, runs at startup | — |
| `src/app/bootstrap.ts` | app | Wires DOM, runtime, controllers, bindings; subscribes render | (side-effecting) |
| `src/app/store.ts` | app | Hand-rolled flux store | `createStore`, `store`, `AppStore` |
| `src/app/state.ts` | app | App state shape + initial values | `AppState`, `initialAppState`, sub-state types |
| `src/app/actions.ts` | app | Action creators | `actions`, `AppAction` |
| `src/app/reducer.ts` | app | Pure reducer | `reducer` |
| `src/app/messages.ts` | app | Status banner helpers | `showError`, `clearStatus` |
| `src/app/validation.ts` | app | GB byte validation rules | `validateGbBytes` |
| `src/app/loaderRouter.ts` | app | Routes a File to image vs gb controller | `createLoaderRouter` |
| `src/app/appController.ts` | app | Top-level orchestration (device/mode/bg switches, zoom, rotate, download) | `createAppController`, `AppController` |
| `src/app/sessionReset.ts` | app | Shared unload ritual (clear status, output, preview, file input) | `resetSession` |
| `src/app/runtime/imageRuntime.ts` | app | Mutable image-pipeline state (canvases, scales, box, caches, timers, versions) | `ImageRuntime`, `createImageRuntime` |
| `src/app/runtime/gbRuntime.ts` | app | Mutable GB state (raw bytes, decoded pixels, palette remap) | `GbRuntime`, `createGbRuntime` |
| `src/app/runtime/outputRuntime.ts` | app | Encoded output bytes | `OutputRuntime`, `createOutputRuntime`, `setOutputBytes`, `clearOutputBytes`, `hasOutput` |
| `src/domain/geometry.ts` | domain | Editor scales + render plan | `computeEditorGeometry`, `buildImageRenderPlan`, `getImageAnalysisRegion`, `fitOffset` |
| `src/domain/tone.ts` | domain | Tone LUT + luminance + auto-levels | `buildToneLut`, `buildLuminanceBuffer`, `computeAutoLevels` |
| `src/domain/histogram.ts` | domain | Histograms (Float32, Uint) | `buildHistogram`, `buildUintHistogram` |
| `src/domain/dither.ts` | domain | Floyd-Steinberg / Atkinson / blue-noise dither → 4-level indexed | `ditherToIndexedGray`, `DitherMode` |
| `src/domain/blueNoise.ts` | domain | Pre-computed blue-noise threshold matrix | (matrix data) |
| `src/domain/quantize.ts` | domain | 4-level quantization helpers | quantize fns |
| `src/domain/devices.ts` | domain | XTeink device specs | `DEVICES`, `DEFAULT_XT`, `DeviceKey` |
| `src/domain/formats/pxc.ts` | domain | `.pxc` encoder | `encodePxc` |
| `src/domain/formats/bmpGray.ts` | domain | 8-bit grayscale BMP encoder | `encodeGrayBmp` |
| `src/domain/formats/bmpGb.ts` | domain | GB-palette BMP encoder | `encodeGbBmp`, `GbPaletteKey` |
| `src/domain/gb/decode2bpp.ts` | domain | 2bpp tile → flat pixel array | `decode2bpp` |
| `src/domain/gb/parsePrinterTxt.ts` | domain | Parse GB Printer text logs | `parsePrinterTxt` |
| `src/domain/gb/rotatePixels.ts` | domain | Rotate flat pixel buffer | `rotatePixels` |
| `src/domain/gb/constants.ts` | domain | Tile / palette constants | constants |
| `src/infra/browser/imageLoader.ts` | infra | File → DataURL / ArrayBuffer / text / Image | `readFile*`, `loadImageFromDataUrl` |
| `src/infra/browser/downloads.ts` | infra | Trigger blob download | `triggerDownload` |
| `src/infra/browser/clipboard.ts` | infra | Read image from clipboard | clipboard helpers |
| `src/infra/canvas/context.ts` | infra | 2D context helpers | `getContext2d`, `createCanvas` |
| `src/infra/canvas/picaResize.ts` | infra | Pica wrapper + stepped downscale | `createPicaResizer`, `resizeWithPica`, `stepDownscaleAndResize` |
| `src/infra/canvas/previewRenderer.ts` | infra | Indexed-pixel → ImageData → canvas | `renderIndexedPreview` |
| `src/infra/canvas/histogramRenderer.ts` | infra | Histogram bars + auto-resize | `renderHistogram`, `clearHistogram`, `mountHistogramAutoResize` |
| `src/infra/canvas/gbSourceRenderer.ts` | infra | GB source canvas painter | `renderGbSourceCanvas` |
| `src/infra/worker/imageWorker.ts` | infra | Worker entry: tone LUT + histogram + dither | (worker) |
| `src/infra/worker/imageWorkerClient.ts` | infra | Worker host adapter | `createImageWorkerClient`, `ImageWorkerClient` |
| `src/features/image/controller.ts` | features | Image-pipeline orchestration | `createImageController`, `ImageController` |
| `src/features/image/source.ts` | features | Rotated/mirrored source canvas | `buildRotatedSource`, `getSourceImage`, `srcW`, `srcH`, `SourceImage` |
| `src/features/image/service.ts` | features | Output base-raster render (uses pica) | `renderImageBaseRaster` |
| `src/features/image/cropBox.ts` | features | Crop-box DOM commit + auto-scroll | `applyCropBoxToDom` |
| `src/ui/imageCropBridge.ts` | ui | Bridge: store/runtime + cropBox helpers → `setupCropInteraction` deps | `setupImageCropInteraction` |
| `src/features/gb/controller.ts` | features | GB-pipeline orchestration | `createGbController`, `GbController` |
| `src/features/gb/service.ts` | features | GB view + output artifact builders | `buildGbSourceView`, `buildGbOutputArtifacts`, `buildGbFileInfo`, `selectGbDisplayScale` |
| `src/ui/dom.ts` | ui | DOM lookup once at startup | `createDom`, `AppDom` |
| `src/ui/render.ts` | ui | Pure render of state → DOM | `renderStoreState` |
| `src/ui/bindings.ts` | ui | Bind sliders / pill groups to store | `bindStoreControls` |
| `src/ui/fileInput.ts` | ui | File input + drop zone + paste | `bindFileInput` |
| `src/ui/imageControls.ts` | ui | Image-mode buttons (mirror, change) | `bindImageControls` |
| `src/ui/gbControls.ts` | ui | GB scale buttons | `bindGbScaleControls` |
| `src/ui/rotationControls.ts` | ui | Rotate buttons | `bindRotationControls` |
| `src/ui/zoomControls.ts` | ui | Zoom +/− buttons | `bindZoomControls` |
| `src/ui/downloadButtons.ts` | ui | Download buttons | `bindDownloadButtons` |
| `src/ui/cropInteraction.ts` | ui | Source-frame DOM events: drag, click, wheel zoom | `setupCropInteraction` |
| `src/ui/previewZoom.ts` | ui | Preview canvas magnifier overlay | `setupPreviewZoom` |

---

## 7. Data flow

### Image load → preview (full path)
```
File picker
  → ui/fileInput.ts → loaderRouter.loadFile
  → imageController.loadImageFile
      readFileAsDataUrl → loadImageFromDataUrl → runtime.loadedImg
      dispatch imageSetSourceDims({width, height})  ← natural pixel dims for the source label
  → resetEditor
      buildRotatedSource (if any rotation/mirror) → runtime.rotatedSrc
      computeEditorGeometry  (pure)
      applyGeometry (sync)
        - sets runtime scales/box/dispImg dims
        - redrawSourceCanvas (drawImage, no pica)
        - sourceFrame styling
        - applyCropBoxToDom (with scrollIntoView)
      requestConvert (rAF)
  → convert
      buildImageRenderPlan
      renderImageBaseRaster (pica) → workCanvas → runtime.cachedBaseRaster
      copy → SharedArrayBuffer → worker.setBaseRaster (sharedBufferVersion++)
      worker.process(settings, processVersion)
  → worker (imageWorker.ts)
      buildToneLut → per-pixel luminance+LUT → Float32 buffer
      buildHistogram → Float32Array
      ditherToIndexedGray → Uint8Array
      postMessage({ type: 'result', indexedPixels, histogram, version })
  → workerClient.onResult → controller's onResult callback (in main thread)
      checks version === processVersion (else drops)
      runtime.lastIndexedPixels / lastHistogram
      renderIndexedPreview (previewCanvas)
      renderHistogram (histogramCanvas)
      store.dispatch(outputSetReady)
```

### Wheel zoom (fluidity-critical, sub-frame)
```
wheel
  → ui/cropInteraction.ts wheel listener
  → applyEditorZoom(targetZoom, clientX, clientY)
      computeEditorGeometry  (pure, ~10 µs)
      applyGeometry (sync DOM/runtime commit)
        ScrollAnchor = { kind: 'point', clientX, clientY }
        capture sourcePx/Py before zoom
        commit new scales / box
        redrawSourceCanvas (drawImage; ~ms even on huge images)
        applyCropBoxToDom with scrollIntoView=false
        frame.scrollLeft/Top set so anchor source pixel stays under cursor
      store.dispatch(imageSetEditorZoom) if changed
      requestConvert (rAF)
```

### Tone slider (cache hit)
```
input
  → bindings.ts → store.dispatch(image/setBlackPoint|...)
  → render() repaints DOM
  → requestConvert (rAF)
  → convert
      rasterDirty === false → skip raster rebuild
      processVersion++
      worker.process(settings, version)   ← only message; no SAB resize
  → result → preview + histogram
```

### GB load → preview
```
File picker (binary or .txt)
  → loaderRouter
  → gbController.loadBinaryFile  OR  loadPrinterText
      readFileAsArrayBuffer / parsePrinterTxt → runtime.rawBytes (+ paletteRemap)
      validateGbBytes
      dispatch fileInfo
      initGb
        decode2bpp(rawBytes, 20) → runtime.pixels + dims
        drawGbSource → renderGbSourceCanvas (gbCanvas)
        buildOutput
          buildGbOutputArtifacts → indexedPixels + pxcBytes + bmpBytes
          renderIndexedPreview (previewCanvas)
          setOutputBytes (output.pxcBytes/bmpBytes)
          outputSetReady
```

---

## 8. Concurrency / versioning

Three monotonically-increasing counters guard async paths.

- **`processVersion`** (`runtime.processVersion`) — incremented per `worker.process` call. The worker echoes the version back; the result handler drops messages whose `version !== runtime.processVersion`. Prevents stale dither output from an interrupted run from overwriting a fresh one.
- **`sharedBufferVersion`** (`runtime.sharedBufferVersion`) — incremented when a new SharedArrayBuffer is sent to the worker (i.e., raster was rebuilt). The worker uses the most recently sent buffer; this version is informational on the host side.
- **`autoLevelsGen`** (`runtime.autoLevelsGen`) — incremented per `autoLevels()` call. The async pica + getImageData chain checks `gen !== runtime.autoLevelsGen` after each `await` to abort when superseded.
- **`convertTimer`** (`runtime.convertTimer`) — the rAF id of the in-flight convert schedule. `requestConvert` cancels and re-schedules.
- **`processing` / `processRequested`** — single-flight gate around the worker. While `processing`, additional `requestConvert` calls only set `processRequested`; on result, if `processRequested`, schedule the next convert.

---

## 9. Runtime objects

### `ImageRuntime` (`app/runtime/imageRuntime.ts`)
| Field | Type | Owner / writer | Reader |
| --- | --- | --- | --- |
| `loadedImg` | `HTMLImageElement \| null` | `loadImageFile` / `unloadImage` | many |
| `rotatedSrc` | `HTMLCanvasElement \| null` | `buildRotatedSource` | `getSourceImage` |
| `displayScale` | `number` | `applyGeometry` only | `applyGeometry`, `buildImageRenderPlan`, `applyCropBoxToDom` |
| `workScale` | `number` | `applyGeometry` only | `applyGeometry`, `buildImageRenderPlan` |
| `dispImgW` / `dispImgH` | `number` | `applyGeometry` only | `applyCropBoxToDom`, source canvas size |
| `boxX` / `boxY` / `boxW` / `boxH` | `number` | `applyGeometry`, drag handlers | `applyCropBoxToDom`, `buildImageRenderPlan` |
| `lastHistogram` | `Float32Array \| null` | worker result handler | `mountHistogramAutoResize` |
| `lastIndexedPixels` | `Uint8Array \| null` | worker result handler | preview render, download path |
| `cachedBaseRaster` | `Uint8ClampedArray \| null` | `convert` (when `rasterDirty`) | next `convert` calls; SAB copy |
| `sharedBufferVersion` | `number` | `convert` after SAB copy | (informational) |
| `processVersion` | `number` | `convert` (incremented per worker dispatch) | `worker.onResult` (dropping stale) |
| `convertTimer` | `number \| null` | `requestConvert` / scheduled rAF | `requestConvert` (cancel) |
| `autoLevelsGen` | `number` | `autoLevels` | `autoLevels` async checkpoints |

### `GbRuntime` (`app/runtime/gbRuntime.ts`)
| Field | Type | Owner / writer | Reader |
| --- | --- | --- | --- |
| `rawBytes` | `Uint8Array \| null` | `loadBinaryFile` / `loadPrinterText` / `unloadGb` | `decode2bpp`, `dispatchFileInfo` |
| `pixels` | `Uint8Array \| null` | `decode2bpp` (via `decodeGbDraw`) | `drawGbSource`, `buildOutput`, `scaleUp/Down` |
| `paletteRemap` | `number[] \| null` | `loadPrinterText` (from parsed shades) | `renderGbSourceCanvas`, `buildGbOutputArtifacts` |

### `OutputRuntime` (`app/runtime/outputRuntime.ts`)
| Field | Type | Owner / writer | Reader |
| --- | --- | --- | --- |
| `pxcBytes` | `Uint8Array \| null` | `setOutputBytes` (GB path) / `clearOutputBytes` | `downloadPxc` (GB path) |
| `bmpBytes` | `Uint8Array \| null` | `setOutputBytes` (GB path) / `clearOutputBytes` | `downloadBmp` (GB path) |

> Image path: outputs are encoded lazily in `appController.downloadPxc`/`downloadBmp` from `runtime.lastIndexedPixels`. Only the GB path stashes pre-encoded bytes in `OutputRuntime`.

---

## 10. Reuse register

Before writing X, use Y:

| Task | Use | Path |
| --- | --- | --- |
| Compute editor scales for a new view | `computeEditorGeometry` | `domain/geometry.ts` |
| Compute crop region in source pixels | `buildImageRenderPlan` | `domain/geometry.ts` |
| Resize a canvas before output | `stepDownscaleAndResize` | `infra/canvas/picaResize.ts` |
| Apply tone (gamma/black/white/contrast/invert) | `buildToneLut` | `domain/tone.ts` — never per-pixel branches |
| Auto-detect black/white points | `computeAutoLevels` (over `buildLuminanceBuffer` + `buildUintHistogram`) | `domain/tone.ts` |
| Dither a Float32 buffer to 4-level indexed | `ditherToIndexedGray` | `domain/dither.ts` |
| Build a histogram | `buildHistogram` (Float32) / `buildUintHistogram` (luminance Uint8) | `domain/histogram.ts` |
| Draw a histogram | `renderHistogram` | `infra/canvas/histogramRenderer.ts` |
| Paint indexed-pixel preview | `renderIndexedPreview` | `infra/canvas/previewRenderer.ts` |
| Paint GB source canvas | `renderGbSourceCanvas` | `infra/canvas/gbSourceRenderer.ts` |
| Encode output bytes | `domain/formats/{pxc,bmpGray,bmpGb}.ts` |
| Decode 2bpp tiles | `decode2bpp` | `domain/gb/decode2bpp.ts` |
| Parse GB Printer .txt log | `parsePrinterTxt` | `domain/gb/parsePrinterTxt.ts` |
| Rotate flat GB pixel buffer | `rotatePixels` | `domain/gb/rotatePixels.ts` |
| Read a File | `readFileAsDataUrl` / `readFileAsArrayBuffer` / `readFileAsText` | `infra/browser/imageLoader.ts` |
| Trigger a download | `triggerDownload` | `infra/browser/downloads.ts` |
| Run the shared unload cleanup (status, output bytes/state, preview, file input) | `resetSession` | `app/sessionReset.ts` |
| Look up DOM elements | `createDom` once at bootstrap | `ui/dom.ts` |
| Bind a slider/pill to the store | `bindStoreControls` | `ui/bindings.ts` |
| Show a status banner | `showError` / `clearStatus` | `app/messages.ts` |
| Validate GB bytes | `validateGbBytes` | `app/validation.ts` |

---

## 11. Fluidity playbook

For each interaction, the path it MUST take, and what is forbidden on it.

| Interaction | Path kind | Allowed on this path | Forbidden on this path |
| --- | --- | --- | --- |
| Wheel / pinch zoom | sync, sub-frame | `computeEditorGeometry`, `applyGeometry`, `redrawSourceCanvas` (drawImage), set scroll, `requestConvert` (rAF) | `await`, pica, `getImageData`, new SAB, full convert inline |
| Crop drag | sync, sub-frame | style writes via `applyCropBoxToDom`, `requestConvert` (rAF) | source-canvas redraw, pica, anything O(sourceW×sourceH) |
| Crop click-to-position | sync | same as drag | same as drag |
| Tone / contrast / gamma slider | cache-hit convert | `requestConvert`, worker `process` against existing SAB | `rasterDirty=true`, re-running pica, sending a new SAB |
| Black/white-point slider | cache-hit convert | same as tone slider | same |
| Auto-levels button | async, generation-guarded | pica + `getImageData` allowed | dispatching tone changes after `autoLevelsGen` advances |
| Mode change (crop ↔ fit) | full rebuild | `resetEditor` → full applyGeometry + raster rebuild | — |
| Rotation / mirror | full rebuild | rebuilds `rotatedSrc` + `resetEditor` | — |
| Device change | full rebuild | resizes output canvases + `resetEditor` | — |
| File load | full pipeline | everything | — |

**Principle:** only the first three rows must be sub-frame. Everything else can pay the rebuild cost.

---

## 12. Architectural traps — concrete don'ts

Lessons from past changes, stated as bans:

- **Don't `addEventListener` from `features/`.** Wire callbacks through `ui/cropInteraction.ts` (or another `ui/` module) and pass them via deps. The wheel-zoom handler used to live under `features/`; it was moved into `ui/cropInteraction.ts`, and the bridge that adapts store/runtime to it lives in `ui/imageCropBridge.ts`.
- **Don't import from `ui/` inside `features/`.** Feature controllers must not type against `AppDom` or pull from `ui/*`. Take individual element refs through deps (see `ImageControllerElements` / `GbControllerElements`).
- **Don't write to `runtime.displayScale` / `workScale` / `dispImg{W,H}` / `box{X,Y,W,H}` outside `applyGeometry`** (drag handlers may move boxX/boxY through `setBoxPosition` → `applyCropBoxToDom`, which is also fine since those are the box's only writer pair).
- **Don't reintroduce pica into the source preview redraw.** `redrawSourceCanvas` uses native `drawImage` with `imageSmoothingQuality='high'`. Pica there is what made wheel zoom feel laggy; the output pipeline still uses pica via `renderImageBaseRaster`.
- **Don't bypass `rasterDirty`.** The SharedArrayBuffer copy is the dominant per-convert cost. Sliders that don't change the raster must keep `rasterDirty=false`.
- **Don't dispatch `imageSetEditorZoom` directly from UI.** Go through `applyEditorZoom` (clamps to `maxZoom`, anchors scroll, runs `applyGeometry`) or `setZoom` (which calls `resetEditor`).
- **Don't make `resetEditor` await anything user-visible.** It currently `awaits` nothing of consequence; keep it that way.
- **Don't add framework abstractions** (`useState`, signals, Solid/React/Vue) — the app is plain DOM + a hand-rolled store. The bootstrap is one file, the render is one pure function.
- **Don't import from `app/` or `features/` inside `domain/`.** The litmus test: would this run in node without DOM? If no, it's wrong.
- **Don't import across feature boundaries.** `features/image/*` must not import from `features/gb/*` and vice versa.
- **Don't compute scales inline.** If you find yourself writing `Math.min(targetW/sourceW, targetH/sourceH)` or `Math.max(...)` in feature code, reuse `computeEditorGeometry`.
- **Don't add per-pixel branches in tone math.** Bake everything into the LUT (commit `954638b`).
- **Don't mutate state outside the reducer.** The store is the only writer.
- **Don't rasterize bigger than needed.** `stepDownscaleAndResize` halves until the source is within 2× the target, then pica-resizes once. Skipping that path causes visible quality loss on very large sources.

---

## 13. Test coverage map

| Area | Tested? | Why |
| --- | --- | --- |
| `domain/*` (geometry, tone, dither, histogram, quantize, formats, gb/*) | Yes (vitest) | Pure, no DOM. Add tests for new pure functions here. |
| `app/store.ts`, `app/reducer.ts` | Yes | Pure. Add tests for new actions. |
| `features/{image,gb}/controller.ts` | Partial — public API tested with mocked store/dom/runtime | Add a test for any new public method. Async paths tested by faking rAF. |
| `features/image/service.ts`, `features/image/cropBox.ts` | Yes | Pure-ish (canvas in, canvas out / runtime in, style out) |
| `features/gb/service.ts` | Yes | Pure builders. |
| `infra/*` | No | Browser/canvas/worker/file IO; not worth jsdom + canvas polyfills. |
| `ui/*` | No | DOM event wiring. Verified manually via `npm run dev`. |
| `app/bootstrap.ts` | No | Wiring. Verified manually. |

When in doubt about whether to add a test: if the function would run in node without a DOM polyfill, write a test. Otherwise, verify in the browser.

---

## Appendix — run, build, deploy

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server at http://localhost:5173 |
| `npm test` | Vitest run, all suites |
| `npm run build` | `tsc --noEmit && vite build` → `dist/` |
| `npx wrangler pages deploy dist --project-name=crosspoint-pxc-converter --branch=main` | Deploy `dist/` to Cloudflare Pages |

Production requires `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp` for SharedArrayBuffer; see `public/_headers`.

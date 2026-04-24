# CrossPoint Converter Purist Refactor Plan

## 1. Executive Summary

This document is the complete architecture and execution plan for converting the current single-file application into a maintainable, typed, modular frontend.

The chosen path is:

- `Vite`
- `TypeScript`
- `Vitest`
- frameworkless frontend architecture
- reducer-driven state management
- pure domain modules
- isolated browser and canvas adapters
- separate image and GB feature modules

This is an architecture-first migration. Small behavioral fixes are explicitly allowed during the refactor, but the primary objective is structural correctness, testability, and long-term maintainability.

The canonical product files during the migration are:

- `index.html`
- `README.md`

The following file is intentionally excluded from the migration surface:

- `gb.html`

## 2. Locked Decisions

These decisions are already made and should not be reopened unless a serious blocker appears.

- Use the purist path.
- Use `Vite` as the build and dev server.
- Use `TypeScript` with strict settings.
- Use `Vitest` for unit and integration tests.
- Do not add browser E2E tests in the first pass.
- Do not add `ESLint` or `Prettier` in the first pass.
- Keep the app frameworkless.
- Preserve the existing UI and behavior as much as possible.
- Allow small fixes during the migration.
- Keep deployment compatible with static hosting and Cloudflare Pages.
- Treat `index.html` as the runtime source of truth and `README.md` as the specification and product documentation.

## 3. Current State Audit

### 3.1 Repository Surface

Tracked files:

- `index.html`
- `README.md`

Observed local-only or untracked files exist in the working tree, but they are not part of the canonical migration plan.

### 3.2 Current App Shape

The application is a browser-only static tool implemented almost entirely in `index.html`.

The file currently contains:

- page markup
- all styles inline
- all application logic inline
- DOM querying and event listeners
- global mutable state
- image processing pipeline
- GB processing pipeline
- output encoders
- canvas rendering logic
- clipboard handling
- download handling

### 3.3 Current Functional Areas in `index.html`

The file already contains natural seams, even though they are not modularized yet.

Current major areas:

- global constants and state: `index.html:1007-1085`
- DOM references and event wiring: `index.html:1087-1433`
- file loading and mode detection: `index.html:1435-1482`
- image editor reset and crop mechanics: `index.html:1484-1625`
- scheduling, luminance, quantization, auto-levels, histogram: `index.html:1627-1824`
- image conversion pipeline: `index.html:1835-2088`
- GB UI mode transitions: `index.html:2094-2148`
- GB decode and parsing: `index.html:2150-2225`
- GB source and output generation: `index.html:2226-2332`
- native-palette GB BMP encoding: `index.html:2334-2379`
- shared output encoding and loupe/download handling: `index.html:2417-2559`

### 3.4 Current Architectural Problems

The current code works, but it is structurally impure in several important ways.

Primary issues:

- Global mutable state is spread across many top-level variables.
- UI event handlers directly manipulate business state and trigger business logic.
- Business logic directly reads and writes DOM state.
- Domain logic, browser APIs, and rendering logic are mixed in one file.
- Image mode and GB mode live in the same orchestration layer.
- Output encoders are embedded beside UI code instead of existing as stable, testable modules.
- Canvas rendering and transformation logic are entangled.
- There is no test suite to lock processing behavior before refactoring.
- There is no typed contract for state, actions, or module boundaries.

### 3.5 Current Behavioral Gaps Already Identified

These mismatches should be corrected during migration.

- `README.md` says GB input can be pasted, but the current paste handler only supports pasted images.
- `README.md` says GB output uses the background color for unused screen area, but GB mode hides the visible background control while still depending on `fitBg` internally.
- Invalid input, corrupt input, and load failures are not surfaced clearly to the user.
- Code and UI mix `palette` and `pallet` naming in GB printer-related logic.

## 4. Refactor Objectives

### 4.1 Primary Objectives

- Remove inline application logic from `index.html`.
- Establish clean architectural boundaries.
- Move business logic into pure typed modules.
- Centralize state in a reducer-driven store.
- Split image and GB behavior into feature modules.
- Create a test suite that locks processing and encoding behavior.
- Keep output compatibility with existing `.pxc` and `.bmp` behavior.
- Maintain static-host deployability.

### 4.2 Secondary Objectives

- Improve developer ergonomics.
- Make behavior easier to reason about and change safely.
- Reduce risk of regressions when adding new image-processing features.
- Make README and behavior match closely.

### 4.3 Non-Goals

- No React rewrite.
- No framework migration.
- No visual redesign as part of architecture work.
- No browser E2E test suite in phase 1.
- No lint/format tooling in the first pass.
- No continued maintenance path for `gb.html`.

## 5. Target Architecture

### 5.1 High-Level Design

The target architecture is a feature-oriented, frameworkless frontend organized into four major layers.

Layers:

- `domain/`
- `features/`
- `infra/`
- `ui/`

App composition and state live in `app/`.

### 5.2 Layer Responsibilities

#### `domain/`

This is the pure computation layer.

Rules:

- no DOM access
- no canvas element access
- no browser APIs
- no side effects
- no mutable shared state

Owns:

- device definitions
- geometry math
- tone mapping
- gamma LUT creation
- contrast and invert transforms
- quantization thresholds
- dithering algorithms
- histogram computation
- `.pxc` encoding
- grayscale `.bmp` encoding
- GB native-palette `.bmp` encoding
- GB 2BPP decoding
- GB printer text parsing
- indexed pixel rotation

#### `features/`

This is the use-case layer.

Owns:

- image-mode workflow
- GB-mode workflow
- per-feature state contracts
- feature-specific orchestration over domain modules

Rules:

- can use domain modules
- should not manipulate DOM
- should not know about raw browser event objects

#### `infra/`

This is the adapter layer.

Owns:

- file input handling
- clipboard handling
- image loading
- browser downloads
- canvas writes
- pica integration

Rules:

- may use browser APIs
- should not own product rules
- should expose simple typed functions to the rest of the app

#### `ui/`

This is the DOM layer.

Owns:

- DOM references
- rendering visible state
- binding UI events to actions
- translating state into classes, labels, visibility, and control values

Rules:

- no encoding logic
- no image processing logic
- no file parsing logic
- no global state mutation

#### `app/`

This is the application composition layer.

Owns:

- `AppState`
- actions
- reducer
- store
- selectors
- coordinating effects

## 6. Target Repository Structure

```text
index.html
package.json
package-lock.json
tsconfig.json
vite.config.ts

src/
  main.ts

  app/
    state.ts
    actions.ts
    reducer.ts
    store.ts
    selectors.ts
    effects.ts

  domain/
    devices.ts
    geometry.ts
    tone.ts
    quantize.ts
    dither.ts
    histogram.ts
    types.ts
    formats/
      pxc.ts
      bmpGray.ts
      bmpGb.ts
    gb/
      decode2bpp.ts
      parsePrinterTxt.ts
      rotatePixels.ts

  features/
    image/
      state.ts
      actions.ts
      service.ts
      types.ts
    gb/
      state.ts
      actions.ts
      service.ts
      types.ts

  infra/
    browser/
      fileInput.ts
      clipboard.ts
      imageLoader.ts
      downloads.ts
    canvas/
      picaResize.ts
      previewRenderer.ts
      histogramRenderer.ts
      gbSourceRenderer.ts

  ui/
    dom.ts
    bindings.ts
    render.ts
    view-model.ts

  styles/
    app.css
    controls.css
    modes.css

tests/
  domain/
    devices.test.ts
    geometry.test.ts
    tone.test.ts
    quantize.test.ts
    histogram.test.ts
    dither.test.ts
    formats.pxc.test.ts
    formats.bmpGray.test.ts
    formats.bmpGb.test.ts
    gb.decode2bpp.test.ts
    gb.parsePrinterTxt.test.ts
    gb.rotatePixels.test.ts
  features/
    image.service.test.ts
    gb.service.test.ts
  fixtures/
    gb/
    printer/
    image/
```

## 7. Technology and Tooling Plan

### 7.1 Runtime and Build

Use:

- `Vite` for local dev and build output
- npm-managed `pica` instead of the CDN script

Rationale:

- static output remains easy to host
- module graph becomes explicit
- TypeScript integration is straightforward
- build remains lightweight

### 7.2 TypeScript Configuration

Required characteristics:

- `strict: true`
- `noImplicitAny: true`
- `exactOptionalPropertyTypes: true` if practical
- modern browser target
- DOM lib enabled

Rationale:

- the app has many stateful and numeric transformations
- strict typing will prevent accidental contract drift during migration

### 7.3 Testing

Use:

- `Vitest`

Test levels in phase 1:

- pure domain unit tests
- feature service integration tests

Out of scope in phase 1:

- browser-level E2E tests
- screenshot regression tests

### 7.4 Deployment

Target deployment model:

- static host
- Cloudflare Pages compatible

Planned build contract:

- build command: `npm run build`
- output directory: `dist`

## 8. App State Design

### 8.1 Root State

```ts
type AppState = {
  mode: 'idle' | 'image' | 'gb';
  device: DeviceState;
  image: ImageState;
  gb: GbState;
  output: OutputState;
  ui: UiState;
};
```

### 8.2 Device State

```ts
type DeviceState = {
  key: 'x3' | 'x4';
  width: number;
  height: number;
  totalPixels: number;
};
```

### 8.3 Image State

```ts
type ImageState = {
  status: 'empty' | 'loading' | 'ready' | 'error';
  sourceUrl: string | null;
  naturalWidth: number;
  naturalHeight: number;
  rotation: 0 | 90 | 180 | 270;
  mirrorH: boolean;
  mirrorV: boolean;
  mode: 'crop' | 'fit';
  fitAlign: 'tl' | 'tc' | 'tr' | 'ml' | 'mc' | 'mr' | 'bl' | 'bc' | 'br';
  background: 'black' | 'white';
  editorZoom: number;
  displayScale: number;
  workScale: number;
  cropBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  tone: {
    blackPoint: number;
    whitePoint: number;
    gamma: number;
    contrast: number;
    invert: boolean;
  };
  dither: {
    enabled: boolean;
    mode: 'fs' | 'atk' | 'jjn' | 'stucki' | 'burkes' | 'bayer' | 'zhou-fang';
  };
  histogram: Uint32Array | null;
};
```

### 8.4 GB State

```ts
type GbState = {
  status: 'empty' | 'loading' | 'ready' | 'error';
  inputKind: '2bpp' | 'printer-txt' | null;
  rawBytes: Uint8Array | null;
  pixels: Uint8Array | null;
  width: number;
  height: number;
  paletteKey: 'dmg' | 'pocket' | 'bw' | 'sgb';
  paletteRemap: number[] | null;
  invert: boolean;
  rotation: 0 | 90 | 180 | 270;
  sourceZoom: number;
  outputScale: number;
  background: 'black' | 'white';
  fileInfo: {
    name: string;
    sizeBytes: number;
    tileCount: number;
    trailingBytes: number;
  } | null;
};
```

### 8.5 Output State

```ts
type OutputState = {
  baseName: string;
  pxcBytes: Uint8Array | null;
  bmpBytes: Uint8Array | null;
  indexedPixels: Uint8Array | null;
};
```

### 8.6 UI State

```ts
type UiState = {
  errorMessage: string | null;
  isDraggingCrop: boolean;
  cropDidDrag: boolean;
  snapHorizontal: boolean;
  snapVertical: boolean;
  zoomLoupeVisible: boolean;
  loadingMessage: string | null;
};
```

## 9. Action Model

Actions should be explicit and typed. The app should stop relying on direct top-level mutation.

### 9.1 App-Level Actions

- `setDevice`
- `clearError`
- `setMode`
- `setOutputBaseName`

### 9.2 Image Actions

- `imageLoadStarted`
- `imageLoadSucceeded`
- `imageLoadFailed`
- `imageUnload`
- `imageSetMode`
- `imageSetRotation`
- `imageToggleMirrorH`
- `imageToggleMirrorV`
- `imageSetEditorZoom`
- `imageSetCropBox`
- `imageSetFitAlign`
- `imageSetBackground`
- `imageSetBlackPoint`
- `imageSetWhitePoint`
- `imageSetGamma`
- `imageResetTone`
- `imageAutoLevelsApplied`
- `imageSetContrast`
- `imageResetContrast`
- `imageSetInvert`
- `imageSetDitherEnabled`
- `imageSetDitherMode`
- `imageSetHistogram`

### 9.3 GB Actions

- `gbLoadStarted`
- `gbLoadSucceeded`
- `gbLoadFailed`
- `gbUnload`
- `gbSetPalette`
- `gbSetPaletteRemap`
- `gbSetInvert`
- `gbSetRotation`
- `gbSetSourceZoom`
- `gbSetOutputScale`
- `gbSetBackground`
- `gbSetFileInfo`

### 9.4 Output Actions

- `outputSetPreviewIndexedPixels`
- `outputSetPxcBytes`
- `outputSetBmpBytes`
- `outputClear`

### 9.5 UI Actions

- `uiSetError`
- `uiSetLoading`
- `uiSetDragging`
- `uiSetSnapState`
- `uiSetLoupeVisible`

## 10. Domain Module Specifications

This section defines what each pure module should own and what should move there from the current file.

### 10.1 `src/domain/devices.ts`

Purpose:

- own supported device dimensions and helper functions

Current source material:

- `index.html:1007-1014`

Exports:

```ts
export type DeviceKey = 'x3' | 'x4';
export type DeviceSpec = { key: DeviceKey; width: number; height: number; totalPixels: number };
export const DEVICES: Record<DeviceKey, DeviceSpec>;
export function getDevice(key: DeviceKey): DeviceSpec;
```

### 10.2 `src/domain/geometry.ts`

Purpose:

- own pure fit/crop geometry
- own crop clamping and alignment math

Current source material:

- `fitOffset`: `index.html:1825-1829`
- crop box behavior concepts from `index.html:1499-1556`

Exports:

```ts
export function fitOffset(...): { x: number; y: number };
export function clampCropBox(...): CropBox;
export function preserveCropCenter(...): CropBox;
export function computeDisplayScale(...): number;
export function computeWorkScale(...): number;
```

### 10.3 `src/domain/tone.ts`

Purpose:

- own grayscale and tone transforms

Current source material:

- `lum`: `index.html:1633-1635`
- gamma LUT: `index.html:1248-1253`
- tone mapping and contrast/invert flow: `index.html:1872-1899`
- auto-level histogram selection logic: `index.html:1645-1697`

Exports:

```ts
export function lum(r: number, g: number, b: number): number;
export function buildGammaLut(gamma: number): Float32Array;
export function applyBlackWhitePoints(...): Float32Array;
export function applyGammaLut(...): Float32Array;
export function applyContrast(...): Float32Array;
export function applyInvert(...): Float32Array;
export function autoLevelsFromHistogram(...): { blackPoint: number; whitePoint: number };
```

### 10.4 `src/domain/quantize.ts`

Purpose:

- own palette constants and four-level quantization

Current source material:

- `GRAY_DISP`: `index.html:1020-1023`
- `quantize`: `index.html:1637-1643`

Exports:

```ts
export const GRAY_DISP = [0, 85, 170, 255] as const;
export function quantize(v: number): 0 | 1 | 2 | 3;
```

### 10.5 `src/domain/dither.ts`

Purpose:

- own all ordered and error-diffusion algorithms

Current source material:

- `index.html:1907-2073`

Exports:

```ts
export type DitherMode = 'fs' | 'atk' | 'jjn' | 'stucki' | 'burkes' | 'bayer' | 'zhou-fang';
export function ditherToIndexedGray(buffer: Float32Array, width: number, height: number, mode: DitherMode): Uint8Array;
export function quantizeWithoutDither(buffer: Float32Array): Uint8Array;
```

### 10.6 `src/domain/histogram.ts`

Purpose:

- own histogram computation and zone analysis

Current source material:

- histogram generation: `index.html:1901-1905`
- histogram visualization prep concepts: `index.html:1713-1818`

Exports:

```ts
export function buildHistogram(values: Float32Array): Uint32Array;
export function computeZoneStats(hist: Uint32Array, totalPixels: number): HistogramZoneStats;
export function binHistogram(hist: Uint32Array, bucketSize: number): Float32Array;
```

### 10.7 `src/domain/formats/pxc.ts`

Purpose:

- own PXC encoding

Current source material:

- `index.html:2418-2429`

Exports:

```ts
export function encodePxc(q: Uint8Array, width: number, height: number): Uint8Array;
```

### 10.8 `src/domain/formats/bmpGray.ts`

Purpose:

- own grayscale indexed BMP encoding

Current source material:

- `index.html:2431-2490`

Exports:

```ts
export function encodeGrayBmp(q: Uint8Array, width: number, height: number): Uint8Array;
```

### 10.9 `src/domain/formats/bmpGb.ts`

Purpose:

- own GB native-palette BMP encoding

Current source material:

- `index.html:2334-2379`

Exports:

```ts
export type GbPaletteKey = 'dmg' | 'pocket' | 'bw' | 'sgb';
export const GB_PALETTES: Record<GbPaletteKey, ReadonlyArray<readonly [number, number, number]>>;
export function encodeGbBmp(q: Uint8Array, width: number, height: number, paletteKey: GbPaletteKey): Uint8Array;
```

### 10.10 `src/domain/gb/decode2bpp.ts`

Purpose:

- decode tile bytes into row-major pixel indices

Current source material:

- `index.html:2153-2174`

Exports:

```ts
export function decode2bpp(bytes: Uint8Array, tilesWide: number): {
  pixels: Uint8Array;
  width: number;
  height: number;
};
```

### 10.11 `src/domain/gb/parsePrinterTxt.ts`

Purpose:

- parse printer logs and extract bytes and palette remap

Current source material:

- `index.html:2176-2206`

Exports:

```ts
export function parsePrinterTxt(text: string): {
  bytes: Uint8Array;
  paletteRemap: number[] | null;
};
```

Notes:

- rename internal terminology from `pallet` to `paletteRemap`
- preserve output behavior while standardizing naming

### 10.12 `src/domain/gb/rotatePixels.ts`

Purpose:

- rotate indexed GB pixel grids

Current source material:

- `index.html:2208-2224`

Exports:

```ts
export function rotatePixels(
  pixels: Uint8Array,
  width: number,
  height: number,
  rotation: 0 | 90 | 180 | 270,
): {
  pixels: Uint8Array;
  width: number;
  height: number;
};
```

## 11. Feature Module Specifications

### 11.1 `src/features/image/service.ts`

Purpose:

- define the image-mode use case as a typed workflow

Responsibilities:

- take typed image inputs and settings
- request resize work from `infra/canvas/picaResize`
- build grayscale luminance buffer
- apply tone transforms
- compute histogram
- quantize or dither
- return preview/output artifacts

Input contract should include:

- device size
- source image/canvas
- crop or fit settings
- rotation and mirror state
- tone settings
- dither settings

Output contract should include:

- indexed output pixels
- histogram
- encoded `.pxc`
- encoded grayscale `.bmp`

### 11.2 `src/features/gb/service.ts`

Purpose:

- define the GB-mode use case as a typed workflow

Responsibilities:

- load bytes from already normalized input
- optionally parse printer text input
- decode 2BPP
- rotate pixels
- apply palette remap and invert
- compute output placement and scale
- produce preview/output artifacts

Output contract should include:

- source-view indexed pixel data
- preview indexed pixel data
- encoded `.pxc`
- encoded GB native-palette `.bmp`
- file info metadata

### 11.3 Feature Separation Rules

Image feature can know about:

- image source raster
- crop and fit rules
- tone controls
- histogram
- dithering

GB feature can know about:

- printer logs
- 2BPP bytes
- GB palette selection
- integer GB output scale

Image feature must not own:

- printer parsing
- tile decoding

GB feature must not own:

- luminance histogram generation
- gamma and contrast controls
- image dithering algorithms

## 12. Infrastructure Adapter Specifications

### 12.1 `src/infra/browser/fileInput.ts`

Purpose:

- normalize drop and file-picker inputs into typed file payloads

Responsibilities:

- expose helpers for drag/drop and input file extraction
- perform no business branching beyond extracting files

### 12.2 `src/infra/browser/clipboard.ts`

Purpose:

- normalize clipboard paste events

Responsibilities:

- support pasted images
- support pasted plain text for GB printer logs
- eventually support typed file-like normalization into app actions

This module will be used to close the current README mismatch around pasted GB input.

### 12.3 `src/infra/browser/imageLoader.ts`

Purpose:

- isolate `FileReader` and `Image` loading

Responsibilities:

- load binary file into `Uint8Array`
- load text file into `string`
- load image file into `HTMLImageElement` or equivalent runtime object
- surface errors explicitly

### 12.4 `src/infra/browser/downloads.ts`

Purpose:

- isolate `Blob`, object URL, and anchor-based download mechanics

Current source material:

- `index.html:2529-2544`

### 12.5 `src/infra/canvas/picaResize.ts`

Purpose:

- isolate `pica` initialization and resize options

Current source material:

- `index.html:1832-1833`
- resize calls in `index.html:1850-1853`, `index.html:1860-1864`, and `index.html:1511`

### 12.6 `src/infra/canvas/previewRenderer.ts`

Purpose:

- render indexed preview pixels to preview canvas

Current source material:

- image preview writes: `index.html:2075-2083`
- GB preview writes: `index.html:2316-2323`

### 12.7 `src/infra/canvas/histogramRenderer.ts`

Purpose:

- own the canvas drawing of the histogram panel

Current source material:

- `index.html:1702-1823`

Important rule:

- keep data calculation in `domain/histogram.ts`
- keep actual canvas drawing here

### 12.8 `src/infra/canvas/gbSourceRenderer.ts`

Purpose:

- render the pixelated GB source canvas

Current source material:

- `index.html:2264-2292`

## 13. UI Layer Design

### 13.1 `src/ui/dom.ts`

Purpose:

- centralize all DOM element lookups

Benefits:

- one source of truth for element IDs
- less repeated `document.getElementById`
- easier refactor if markup changes

### 13.2 `src/ui/bindings.ts`

Purpose:

- bind DOM events to store actions and effects

Responsibilities:

- button clicks
- sliders
- toggles
- drag/drop
- crop drag interactions
- paste handling
- download clicks

Important rule:

- event handlers should dispatch actions or invoke effect functions
- they should not perform processing pipelines inline

### 13.3 `src/ui/render.ts`

Purpose:

- render current store state to the DOM

Responsibilities:

- show and hide mode sections
- sync control values
- sync active button states
- update labels
- update warnings and errors
- trigger renderer adapters when output state changes

### 13.4 Rendering Strategy

This app does not need a virtual DOM.

The rendering model should be:

1. store updates
2. render function reads state
3. render updates DOM in a deterministic way
4. canvas renderer adapters draw from explicit data inputs

## 14. CSS and Markup Strategy

### 14.1 Markup Strategy

Keep the current HTML structure as stable as possible in the early phases.

Rationale:

- reduces UI regression risk
- allows architecture refactor without visual churn
- keeps DOM IDs stable during migration

### 14.2 CSS Extraction Plan

Move the current inline styles into:

- `src/styles/app.css`
- `src/styles/controls.css`
- `src/styles/modes.css`

Suggested split:

- `app.css` for page shell, layout, typography, panels, responsive rules
- `controls.css` for buttons, pills, sliders, toggles, zoom loupe, file info cards
- `modes.css` for image-mode and GB-mode differences

### 14.3 CSS Goals

- no styling logic inside JS except truly dynamic style values
- keep CSS selectors aligned with current DOM to minimize risk

## 15. Detailed Migration Map from Current Code

This section maps current `index.html` responsibilities to future modules.

### 15.1 Constants and Basic State

Move:

- `DEVICES` -> `src/domain/devices.ts`
- `GRAY_DISP` -> `src/domain/quantize.ts`

Replace with store state:

- `targetW`, `targetH`, `totalPixels`
- `loadedType`
- image globals
- GB globals
- output globals
- UI drag and snap globals

### 15.2 Rotation and Mirror

Move image rotation geometry helper behavior into:

- `src/features/image/service.ts`
- `src/domain/geometry.ts` where math is pure

Retain canvas work in:

- `src/infra/canvas/picaResize.ts`
- feature-level orchestration

### 15.3 Tone Range and Contrast

Move:

- gamma LUT generation
- black and white point mapping
- contrast transform
- invert transform
- auto-level selection

Destination:

- `src/domain/tone.ts`

### 15.4 Histogram

Split:

- data calculation -> `src/domain/histogram.ts`
- canvas drawing -> `src/infra/canvas/histogramRenderer.ts`

### 15.5 Dithering

Move all algorithms to:

- `src/domain/dither.ts`

### 15.6 File Loading

Split:

- browser I/O -> `src/infra/browser/imageLoader.ts`
- mode detection and dispatch -> `src/app/effects.ts`

### 15.7 GB Parsing and Decoding

Move:

- printer text parsing -> `src/domain/gb/parsePrinterTxt.ts`
- 2BPP decode -> `src/domain/gb/decode2bpp.ts`
- indexed rotation -> `src/domain/gb/rotatePixels.ts`

### 15.8 Encoders

Move:

- `encodePxc` -> `src/domain/formats/pxc.ts`
- grayscale BMP encoder -> `src/domain/formats/bmpGray.ts`
- GB BMP encoder -> `src/domain/formats/bmpGb.ts`

### 15.9 Preview and Source Rendering

Move:

- preview canvas writes -> `src/infra/canvas/previewRenderer.ts`
- GB source canvas writes -> `src/infra/canvas/gbSourceRenderer.ts`

### 15.10 Downloads

Move:

- `triggerDownload` -> `src/infra/browser/downloads.ts`

### 15.11 Paste Handling

Move:

- current paste listener -> `src/infra/browser/clipboard.ts`

Enhance:

- image paste
- text paste for GB printer logs
- explicit input normalization and error handling

## 16. Testing Plan

### 16.1 Test Philosophy

The highest risk in this refactor is not the toolchain. The highest risk is output drift.

Therefore the test plan focuses first on deterministic behavior in pure modules and feature workflows.

### 16.2 Domain Test Matrix

Required tests:

- `devices.test.ts`
  - returns expected dimensions for `x3` and `x4`
- `quantize.test.ts`
  - exact threshold behavior at 41, 42, 126, 127, 211, 212
- `tone.test.ts`
  - gamma LUT monotonicity
  - no-op behavior at gamma `1.0`
  - contrast no-op at `0`
  - invert transforms `0 -> 255` and `255 -> 0`
- `histogram.test.ts`
  - correct 256-bin counts
  - correct zone percentages
- `dither.test.ts`
  - output range is only `0-3`
  - deterministic results for fixed buffers
  - algorithm-specific sanity cases
- `formats.pxc.test.ts`
  - exact byte output for known tiny images
- `formats.bmpGray.test.ts`
  - valid headers, palette, and pixel packing
- `formats.bmpGb.test.ts`
  - valid headers, chosen palette, and pixel packing
- `gb.decode2bpp.test.ts`
  - correct tile decode for known fixture
- `gb.parsePrinterTxt.test.ts`
  - bytes extracted correctly
  - palette remap extracted correctly
  - malformed JSON lines do not break parsing
- `gb.rotatePixels.test.ts`
  - correct output dimensions and indices for 90, 180, 270

### 16.3 Feature Integration Test Matrix

Required tests:

- `image.service.test.ts`
  - fit mode pipeline produces output bytes
  - crop mode pipeline produces output bytes
  - histogram returned for image mode
  - no histogram required from GB mode
  - toggling dither changes indexed output deterministically
- `gb.service.test.ts`
  - binary 2BPP input yields expected dimensions
  - printer text input yields remapped output
  - palette selection changes BMP palette bytes only where expected
  - output scale and background placement are correct

### 16.4 Fixtures Plan

Add fixtures for:

- a tiny grayscale raster representation for image-domain tests
- a small 2BPP tile sample
- a small printer log sample with a known palette register
- expected byte arrays for `.pxc`
- expected BMP header snapshots

### 16.5 Future Test Expansion

Deferred until after architecture stabilizes:

- browser E2E tests
- interaction regression tests
- screenshot tests

## 17. Detailed Phase Plan

This section is the operational migration plan.

### Phase 0: Baseline and Safety Setup

Objective:

- prepare the codebase for migration without changing architecture yet

Tasks:

1. Confirm current app behavior manually for key flows.
2. Identify any immediately blocking issues in current `index.html`.
3. Capture representative outputs for a few known sample inputs once fixtures are available.

Definition of done:

- baseline understanding is sufficient to compare future outputs

### Phase 1: Toolchain Bootstrap

Objective:

- establish the Vite + TS + Vitest foundation

Files to create:

- `package.json`
- `tsconfig.json`
- `vite.config.ts`
- `src/main.ts`

Dependencies to add:

- runtime: `pica`
- dev: `vite`, `typescript`, `vitest`

Scripts to add:

- `dev`
- `build`
- `test`

Definition of done:

- `npm install` succeeds
- `npm run dev` serves the app
- `npm run build` produces `dist`
- `npm run test` runs a placeholder or initial suite successfully

### Phase 2: Shell Conversion

Objective:

- move runtime entry out of `index.html` and into `src/main.ts`

Tasks:

1. Keep current markup intact.
2. Remove inline runtime script from `index.html`.
3. Replace with Vite module entry.
4. Move inline CSS into `src/styles/*.css`.
5. Import CSS from `src/main.ts`.

Definition of done:

- the app still loads through Vite
- DOM structure and visual layout remain close to current behavior
- all inline logic has been relocated out of the HTML file

### Phase 3: Lowest-Risk Domain Extraction

Objective:

- extract deterministic, low-risk pure logic first

Priority order:

1. `src/domain/devices.ts`
2. `src/domain/quantize.ts`
3. `src/domain/formats/pxc.ts`
4. `src/domain/formats/bmpGray.ts`
5. `src/domain/formats/bmpGb.ts`
6. `src/domain/gb/decode2bpp.ts`
7. `src/domain/gb/parsePrinterTxt.ts`
8. `src/domain/gb/rotatePixels.ts`

Why this order:

- easiest to isolate
- minimal DOM coupling
- highest value for future tests

Definition of done:

- app compiles with extracted modules imported from `src/main.ts`
- pure modules no longer exist inline in main runtime file

### Phase 4: Core Test Safety Net

Objective:

- lock down encoded formats and GB logic before broader orchestration changes

Tasks:

1. Add tests for all phase 3 modules.
2. Add representative fixtures.
3. Confirm encoded output stability.

Definition of done:

- core pure modules are test-covered
- outputs for fixtures are stable and reproducible

### Phase 5: Tone, Histogram, Geometry, and Dither Extraction

Objective:

- move the remaining computational logic into pure modules

Tasks:

1. Extract `geometry.ts`.
2. Extract `tone.ts`.
3. Extract `histogram.ts`.
4. Extract `dither.ts`.
5. Add tests for each.

Definition of done:

- image processing math is no longer embedded in the runtime entry file
- histogram data calculation is pure and testable
- dithering algorithms are isolated and tested

### Phase 6: Store and Reducer Introduction

Objective:

- eliminate app-wide mutable globals

Tasks:

1. Define `AppState` and sub-state contracts.
2. Add action types.
3. Add root reducer.
4. Add a simple store implementation with subscribe/getState/dispatch.
5. Migrate reset and device-switch behavior into reducer-driven state transitions.

Definition of done:

- global top-level mutable variables are removed or reduced to local adapter internals only
- device and mode transitions flow through typed actions

### Phase 7: Feature Extraction

Objective:

- split image and GB orchestration into separate modules

Tasks:

1. Create `features/image/service.ts`.
2. Create `features/gb/service.ts`.
3. Move image workflow from the monolith into the image feature.
4. Move GB workflow from the monolith into the GB feature.
5. Keep shared code only in domain modules.

Definition of done:

- image and GB processing are structurally separate
- app composition layer selects the active feature instead of mixing the two inline

### Phase 8: Adapter Extraction

Objective:

- isolate browser and canvas effects

Tasks:

1. Add browser adapters for file input, clipboard, image loading, downloads.
2. Add canvas adapters for preview, histogram, GB source, and pica resizing.
3. Remove direct browser API usage from features and reducers.

Definition of done:

- feature modules consume typed inputs and outputs rather than raw browser APIs

### Phase 9: UI Layer Rewrite

Objective:

- reduce UI to binding and rendering only

Tasks:

1. Centralize DOM refs in `dom.ts`.
2. Move all event registration to `bindings.ts`.
3. Move all DOM state syncing and visibility logic to `render.ts`.
4. Ensure render uses store state as its single source of truth.

Definition of done:

- UI event handlers are thin
- UI rendering is deterministic from current state
- business logic no longer lives in event handlers

### Phase 10: Allowed Product Fixes During Migration

Objective:

- resolve known mismatches while architecture work is underway

Tasks:

1. Add pasted GB printer text support.
2. Expose or clarify GB background color behavior so docs and runtime match.
3. Add visible invalid-input and decode-failure handling.
4. Standardize naming from `pallet` to `paletteRemap` or equivalent internal naming.

Definition of done:

- user-visible behavior better matches `README.md`
- errors are visible and actionable

### Phase 11: Documentation Update

Objective:

- bring `README.md` in line with the new developer and runtime architecture

Tasks:

1. Add local development instructions.
2. Add build instructions.
3. Add test instructions.
4. Ensure user-facing behavior documentation still matches the app.

Definition of done:

- `README.md` works for both users and contributors

## 18. Detailed First Implementation Slice

This is the exact first slice to execute next. It is intentionally narrow and safe.

### Slice 1: Introduce Tooling

Tasks:

1. Add `package.json` with `vite`, `typescript`, `vitest`, and `pica`.
2. Add `tsconfig.json`.
3. Add `vite.config.ts`.
4. Add `src/main.ts`.
5. Update `index.html` to load the module entry.

Output:

- the app can run through Vite without changing its high-level UI yet

### Slice 2: Move Styles Out of HTML

Tasks:

1. Create `src/styles/app.css`.
2. Create `src/styles/controls.css`.
3. Create `src/styles/modes.css`.
4. Move the current inline CSS into those files.
5. Import them from `src/main.ts`.

Output:

- `index.html` becomes a shell with no inline CSS dependency for app behavior

### Slice 3: Extract and Test the Lowest-Risk Pure Modules

Tasks:

1. Add `src/domain/devices.ts`.
2. Add `src/domain/quantize.ts`.
3. Add `src/domain/formats/pxc.ts`.
4. Add `src/domain/formats/bmpGray.ts`.
5. Add `src/domain/formats/bmpGb.ts`.
6. Add `src/domain/gb/decode2bpp.ts`.
7. Add `src/domain/gb/parsePrinterTxt.ts`.
8. Add `src/domain/gb/rotatePixels.ts`.
9. Add tests for each.

Output:

- the most stable and critical processing modules become independent and verified

### Slice 4: Swap Main Runtime to Consume Extracted Modules

Tasks:

1. Replace inline implementations in the runtime entry with imports from extracted modules.
2. Verify app behavior still matches current expectations.
3. Keep store/reducer work deferred until after this slice is stable.

Output:

- modular domain logic is live in production path before state-layer refactor begins

## 19. Rollout Checkpoints

These checkpoints should be used to verify the migration is on track.

### Checkpoint A

- Vite app runs
- CSS moved out
- no inline runtime script in `index.html`

### Checkpoint B

- pure encoders and GB parsers extracted
- tests passing for those modules

### Checkpoint C

- tone, histogram, geometry, and dither extracted
- tests passing for those modules

### Checkpoint D

- global mutable state removed in favor of store and reducer

### Checkpoint E

- image and GB are feature-separated
- browser APIs isolated
- UI reduced to binding/render only

### Checkpoint F

- README updated
- app builds cleanly
- architecture target reached

## 20. Risk Register

### Risk 1: Output Drift in Encoders

Description:

- moving binary format code can accidentally change byte layout

Mitigation:

- write exact golden tests before making broader refactors around the same code

### Risk 2: Output Drift in Dithering and Tone Pipeline

Description:

- subtle numeric or ordering changes can visibly alter output

Mitigation:

- extract tone and dither into pure modules and test representative buffers
- preserve processing order exactly during initial extraction

### Risk 3: UI Regression While Moving Styles and DOM Bindings

Description:

- layout and event wiring are currently tightly coupled

Mitigation:

- keep DOM structure stable
- avoid markup redesign in early phases
- move CSS first without changing selectors

### Risk 4: Half-Modularized State

Description:

- a common failure mode is splitting files while leaving hidden shared mutable state

Mitigation:

- introduce a real reducer and store instead of pretending modules alone solve architecture

### Risk 5: Scope Creep

Description:

- trying to redesign UX, architecture, tests, and docs simultaneously will slow delivery

Mitigation:

- sequence work exactly by phase
- only allow the explicitly identified small fixes during migration

## 21. Acceptance Criteria

The migration is complete only when all of the following are true.

- `index.html` has no inline application logic.
- CSS is externalized.
- `src/` contains all runtime logic.
- pure processing logic lives in `domain/`.
- image and GB feature workflows live in separate modules.
- browser APIs and canvas logic are isolated in `infra/`.
- state is reducer-driven and typed.
- no app-wide mutable globals remain.
- core domain modules have automated tests.
- feature service integration tests exist.
- app builds to static output with `Vite`.
- `README.md` documents the new workflow and remains behaviorally accurate.

## 22. Recommended Immediate Execution Order

The next implementation should proceed in this exact order.

1. Bootstrap `Vite + TypeScript + Vitest`.
2. Move runtime entry into `src/main.ts`.
3. Move CSS into `src/styles/*.css`.
4. Extract the lowest-risk pure modules.
5. Add tests for those modules.
6. Swap the runtime to import those modules.
7. Only then begin store/reducer work.

This order gives the best balance of safety, clarity, and forward progress.

## 23. Definition of Success

Success is not just that the app still works.

Success means:

- a new contributor can identify where any concern belongs
- pure logic is easy to test in isolation
- image and GB features are independently understandable
- browser APIs are not leaking into the business layer
- new features can be added without re-entering a 2500-line monolith
- the repo is clearly on a sustainable path rather than just being split into multiple files with the same old coupling

## 24. Final Recommendation

Do not compromise the architecture by doing a cosmetic file split.

The correct implementation path is:

1. establish tooling
2. extract pure logic first
3. test those modules
4. centralize state with a reducer
5. separate features
6. isolate adapters
7. slim the UI layer to rendering and event translation only

That is the shortest path to actual architectural purity rather than superficial modularity.

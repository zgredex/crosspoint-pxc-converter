# CrossPoint PXC Converter

**[crosspoint-pxc-converter.pages.dev](https://crosspoint-pxc-converter.pages.dev)**

A browser-based converter that turns images and Game Boy 2BPP captures into sleep-screen wallpapers for the [CrossPoint](https://github.com/crosspoint-reader/crosspoint-reader) e-reader firmware running on XTeink devices. Inputs go in as PNG, JPG, WebP, BMP, GIF, `.2bpp`, `.bin`, `.gb`, or GB-Printer `.txt` logs; outputs come out as `.pxc` (CrossPoint native) or `.bmp` (4-bit indexed). Every step runs locally in the browser — no upload, no server.

---

## Devices

| Device | Resolution |
|--------|-----------|
| **X4** | 480×800 |
| **X3** | 528×792 |

The selected device controls the output canvas size for both export formats.

---

## PXC format

PXC is CrossPoint's native wallpaper format. It stores 2 bits per pixel — four grey levels mapped one-to-one to the e-ink display's physical states.

| Value | Display level | sRGB |
|-------|--------------|------|
| `0`   | Black        | 0    |
| `1`   | Dark grey    | 85   |
| `2`   | Light grey   | 170  |
| `3`   | White        | 255  |

**File layout**

```
Bytes 0–1   Width  (uint16 LE)
Bytes 2–3   Height (uint16 LE)
Bytes 4+    Pixel data — 2 bits per pixel, MSB first, row-major.
            Each byte holds 4 pixels: [p0 p1 p2 p3] in bits [7:6 5:4 3:2 1:0].
            Each row is ceil(width / 4) bytes; rows are not packed across
            boundaries.
```

| Device | File size |
|--------|----------|
| X4     | 96,004 bytes |
| X3     | 104,548 bytes |

---

## BMP format

The BMP export uses BMP3 (`BITMAPINFOHEADER`), 4-bit indexed colour, with a 4-entry palette.

- **Image mode** — greyscale palette `#000000 #555555 #AAAAAA #FFFFFF`, matching the four e-ink levels and ImageMagick's `-colorspace Gray -dither FloydSteinberg -remap palette.png -define bmp:format=bmp3 -type Palette` pipeline.
- **Game Boy mode** — palette pulled from the selected colour scheme (DMG, Pocket, B&W, or SGB) so the BMP previews correctly in any colour-aware viewer.

---

## Where to put the file on the device

| Path on SD card    | Effect                                  |
|--------------------|-----------------------------------------|
| `/sleep.pxc`       | Single static sleep screen (PXC)        |
| `/sleep.bmp`       | Single static sleep screen (BMP)        |
| `/.sleep/name.pxc` | Member of the rotating wallpaper pool   |
| `/.sleep/name.bmp` | Member of the rotating wallpaper pool   |

CrossPoint picks at random from `/.sleep/` when multiple files are present. PXC and BMP files mix freely in the same pool.

---

## Features

### Input

- Drag-and-drop, click-to-browse, or paste from the clipboard (`Ctrl+V` / `Cmd+V`).
- The loader inspects the file extension and routes automatically:
  - `.png`, `.jpg`, `.jpeg`, `.webp`, `.bmp`, `.gif` → image mode.
  - `.2bpp`, `.bin`, `.gb` → Game Boy binary mode.
  - `.txt` (or pasted text) → Game Boy Printer log parser.
- Bad inputs (decode failure, malformed GB byte stream, unrecognised text payload) surface as an inline status banner.

### Source editor

- **Crop / Fit modes** — crop selects a viewport that fills the device exactly; fit letterboxes the whole source. The crop window snaps when its centre aligns with the source centre.
- **Fit alignment** — 3×3 grid (top-left through bottom-right) controls placement of the letterboxed image. The unused area fills with the chosen background colour (white or black).
- **Rotation** — 90° clockwise / counter-clockwise steps.
- **Mirror** — horizontal and vertical flips, applied independently.
- **Zoom** — continuous slider from 1× to a per-image maximum (capped so the source never upscales beyond its native pixels), plus mouse-wheel zoom anchored at the cursor.
- **Scrollable viewport** — the source panel pans when the zoomed image exceeds its frame; scroll position is preserved during zoom changes.
- **Source label** — displays the loaded asset's natural pixel dimensions, e.g. `Source · 1920×1080 — drag or click to reposition`.

### Scaling

Downscaling runs **Lanczos3** through [pica](https://github.com/nodeca/pica). For sources more than 2× the device target, the pipeline halves the image with high-quality bilinear smoothing until it lands within 2× of the target, then performs a single Lanczos3 pass to land exactly on the target dimensions. The same scaling path drives the editor preview and the export, so what shows on screen reflects the final output.

### Tone pipeline

Controls run in this processing order: black/white-point map → gamma → contrast → invert → dither.

| Control | Description |
|---------|-------------|
| **Black / White points** | 0–255 sliders that linearly remap the input range. Each clamps against the other so they cannot cross. |
| **Gamma** | 0.30–5.00, default 1.00. Applies `Vout = Vin^(1/γ)` after the black/white remap. γ > 1 lifts shadows (brighter, more shadow detail); γ < 1 compresses shadows (darker, more highlight detail). |
| **Contrast** | ±100 linear adjustment, pivoting at midpoint (128). |
| **Invert** | Inverts luminance after tone mapping, before dithering. |
| **Auto** | Sets black and white points from histogram percentile clipping; resets gamma to 1.00. |
| **Reset all** | Restores black, white, and gamma to defaults. |

### Dithering

Every error-diffusion algorithm uses BT.601 luminance in sRGB space and quantises against the palette `[0, 85, 170, 255]`, matching ImageMagick's `-colorspace Gray` pipeline.

| Algorithm | Notes |
|-----------|-------|
| **Floyd-Steinberg** | Classic 4-neighbour kernel (`7/5/3/1 ÷ 16`). Balanced general-purpose default. |
| **Atkinson** | Distributes only 6/8 of the error across 6 neighbours. Preserves highlights, produces lighter results — popular for manga. |
| **Jarvis (JJN)** | 3-row, 12-neighbour kernel (`÷ 48`). Wider error spread, less banding, softer edges. |
| **Stucki** | JJN-family weights (`÷ 42`). Slightly sharper than Jarvis. |
| **Burkes** | 2-row Stucki (`÷ 32`). Faster than the 3-row variants while staying sharp. |
| **Bayer** | 4×4 ordered (threshold) dithering. No error bleeding; produces a regular crosshatch suited to flat illustration with hard edges. |
| **Blue Noise** | 64×64 pre-computed blue-noise threshold matrix. Ordered like Bayer but with high-frequency noise distribution; clean look on photographic content without the directional bias of error diffusion. |
| **Zhou-Fang** | JJN kernel with serpentine scanning and intensity-dependent coefficient + threshold modulation (Zhou & Fang, SIGGRAPH 2003). Eliminates the "worm" artifacts of single-direction JJN. Strong choice for photographic content on e-ink. |

A toggle disables dithering altogether for hard-quantised output.

### Histogram

A live tone-distribution panel renders alongside the preview:

- 256-bin luminance histogram of the post-tone pre-dither buffer.
- Four coloured zones corresponding to the four output levels, each labelled with the percentage of pixels that fall into it.
- A solid palette colour strip below for unambiguous level identification.
- Threshold markers drawn at 42, 127, and 212 — the boundaries between adjacent output levels.

### Game Boy mode

Game Boy binaries (`.2bpp`, `.bin`, `.gb`) and GB-Printer text logs (`.txt` files or pasted text) decode through a 2-bits-per-pixel tile reader at 20 tiles wide.

| Control | Description |
|---------|-------------|
| **Output scale** | Integer pixel-perfect multiplier (1×, 2×, 3×, …) up to the maximum that still fits inside the device target. The scaled tile art centres on the canvas. |
| **Background** | White or black fill behind the centred tile art. |
| **BMP palette** | Colour scheme used for the `.bmp` export: DMG (green), Pocket (sepia/grey), B&W (greyscale), SGB (purple/orange). The `.pxc` export is always greyscale. |
| **Invert** | Flips GB colour indices (`0↔3`, `1↔2`) before conversion. |
| **Rotation** | 90° clockwise / counter-clockwise. |

The GB-Printer text-log parser reads hex byte lines and extracts the `PRNT` palette register, applying the captured grey levels automatically. The GB Printer palette readout reports the register value and the per-shade mapping in the file-info panel.

**GB index → PXC level**

| GB index | Meaning   | PXC level      |
|----------|-----------|----------------|
| 0        | Lightest  | 3 (white)      |
| 1        | Light     | 2 (light grey) |
| 2        | Dark      | 1 (dark grey)  |
| 3        | Darkest   | 0 (black)      |

### Preview

- The output preview canvas updates live on every control change.
- A 3.5× zoom loupe follows the cursor over the preview for pixel-level inspection.

### Export

- **Download .pxc** — CrossPoint native format.
- **Download .bmp** — 4-bit indexed BMP3 (greyscale palette in image mode, GB colour palette in GB mode).

---

## Development

```bash
npm install
npm run dev      # local dev server
npm run build    # type-check and produce static dist/
npm run test     # vitest run
```

The build output in `dist/` is plain static files — HTML, JS chunks, CSS, and a worker bundle.

### Hosting requirements

The dither pipeline runs in a Web Worker over a `SharedArrayBuffer`. Browsers allow that only inside a cross-origin-isolated context, so production hosting must serve the app with these response headers:

- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

`public/_headers` ships the correct values for hosts that read that file format. On other hosts, configure the equivalent response-header rules in the host's own configuration.

---

## Architecture

The codebase is plain DOM plus a hand-rolled flux-style store, organised into a one-directional layer chain:

- **`src/domain/`** — pure logic with no DOM: geometry, tone, dithering, histogram, format encoders, GB decoders.
- **`src/infra/`** — browser, canvas, worker, and file-IO adapters.
- **`src/app/`** — store, reducer, runtime containers, top-level orchestration, loader routing, shared cleanup helpers.
- **`src/features/{image,gb}/`** — feature controllers and helpers wired through deps.
- **`src/ui/`** — DOM lookup, store-driven render, event bindings, crop interaction, preview loupe.

`code-map.md` carries the full architectural contract: layer rules, single-source-of-truth registry, fluidity hot paths, and runtime-object documentation. Read it before non-trivial changes.

---

## Related

- [CrossPoint firmware](https://github.com/crosspoint-reader/crosspoint-reader) — the e-reader firmware this tool targets.

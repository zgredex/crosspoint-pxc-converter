# CrossPoint PXC Converter

**[crosspoint-pxc-converter.pages.dev](https://crosspoint-pxc-converter.pages.dev)**

A browser-based image converter for creating sleep screen wallpapers for the [CrossPoint](https://github.com/crosspoint-reader/crosspoint-reader) open-source e-reader firmware running on XTeink devices. Converts images (PNG, JPG, WebP, BMP, GIF) **and Game Boy 2BPP files** into **PXC** and **BMP** formats. No upload, no server — all processing happens locally in your browser.

---

## PXC Format

PXC is CrossPoint's native wallpaper format. It stores an image at 2 bits per pixel, giving four gray levels that map directly to the e-ink display's physical states:

| Value | Display level | sRGB |
|-------|--------------|------|
| `0`   | Black        | 0    |
| `1`   | Dark grey    | 85   |
| `2`   | Light grey   | 170  |
| `3`   | White        | 255  |

**File layout:**

```
Bytes 0–1   Width  (uint16 LE)
Bytes 2–3   Height (uint16 LE)
Bytes 4+    Pixel data — 2 bits per pixel, MSB first, row-major
            Each byte holds 4 pixels: [p0 p1 p2 p3] in bits [7:6 5:4 3:2 1:0]
```

| Device | Resolution | File size |
|--------|-----------|-----------|
| X4     | 480×800   | 96,004 bytes |
| X3     | 528×792   | 104,652 bytes |

---

## BMP Format

The BMP export uses BMP3 (BITMAPINFOHEADER), 4-bit indexed colour.

- **Image mode** — 4-entry grayscale palette matching the four e-ink levels (`#000000 #555555 #AAAAAA #FFFFFF`). Compatible with ImageMagick's `-colorspace Gray -dither FloydSteinberg -remap palette.png -define bmp:format=bmp3 -type Palette` pipeline.
- **Game Boy mode** — 4-entry palette using the selected GB colour scheme (DMG, Pocket, B&W, or SGB), so the BMP previews correctly on any viewer that shows colour.

---

## Where to put the file

| Path on SD card    | Effect                                  |
|--------------------|-----------------------------------------|
| `/sleep.pxc`       | Single static sleep screen (PXC)        |
| `/sleep.bmp`       | Single static sleep screen (BMP)        |
| `/.sleep/name.pxc` | Rotated wallpaper pool (multiple files) |

CrossPoint picks from `/.sleep/` at random if multiple files are present.

---

## Features

### Device support
- **X4** — 480×800
- **X3** — 528×792

### Image input
- Drag and drop, click to browse, or **paste from clipboard** (Ctrl+V / Cmd+V)
- Auto-detects file type: images go to image mode, `.2bpp` / `.bin` / `.gb` / `.txt` go to Game Boy mode

### Source editor (image mode)
- **Crop mode** — drag or click to reposition the crop window; snap guides appear when aligned to centre
- **Fit mode** — letterbox with configurable alignment (3×3 grid) and background colour (black or white)
- **Rotation** — 90° CW / CCW steps
- **Mirror** — flip horizontal or vertical
- **Zoom controls** — 0.5×, 0.75×, 1×, 1.5×, 2×, 3×, 4× zoom for precise crop positioning on high-res images
- Scrollable/pannable source view — navigate large images without scaling them down

### Tone pipeline (image mode)
Controls are arranged in processing order:

| Control | Description |
|---------|-------------|
| **Tone Range** | Black point and white point sliders remap the input luminance range. **Auto** button sets them automatically via histogram percentile clipping. |
| **Contrast** | ±100 linear contrast adjustment, pivot at midpoint. |
| **Invert** | Invert luminance before dithering. |
| **Dither** | Toggle + algorithm selector (see below). |

### Dithering (image mode)
All error-diffusion algorithms use BT.601 luminance in sRGB space and quantise against sRGB palette values `[0, 85, 170, 255]`, matching ImageMagick's `-colorspace Gray` pipeline.

| Algorithm | Notes |
|-----------|-------|
| **Floyd-Steinberg** | Classic 4-neighbour kernel (`7/5/3/1 ÷ 16`). Good general balance. |
| **Atkinson** | Distributes only 6/8 of the error across 6 neighbours. Preserves highlights, produces lighter images — popular for manga. |
| **Jarvis (JJN)** | 3-row, 12-neighbour kernel (`÷ 48`). Spreads error wider, reduces banding at the cost of softer edges. |
| **Stucki** | JJN-family with adjusted weights (`÷ 42`). Slightly sharper than Jarvis. |
| **Burkes** | 2-row version of Stucki (`÷ 32`). Faster and still sharp. |
| **Bayer** | 4×4 ordered (threshold) dithering. No error bleeding, produces a regular crosshatch pattern. Good for flat illustrations with hard edges. |
| **Zhou-Fang** | JJN kernel with **serpentine scanning** — rows alternate left→right and right→left. Eliminates the directional "worm" artifacts that single-direction JJN produces. Generally the best choice for photographic content on e-ink. |

### Histogram (image mode)
Live tone distribution panel showing:
- 256-bin luminance histogram of the processed image (after tone mapping, contrast, and invert — before dithering)
- Four coloured zones corresponding to the display's four grey levels, each showing the percentage of pixels mapping to that output level
- Solid palette colour strip (black / dark grey / light grey / white) for unambiguous zone identification
- Threshold markers at 42, 127, 212

### Game Boy 2BPP mode
Drop or paste a Game Boy 2BPP binary (`.2bpp`, `.bin`, `.gb`) or a **GB Printer text log** (`.txt`) to enter GB mode. The app auto-detects the file type.

| Control | Description |
|---------|-------------|
| **Output scale** | Integer pixel-perfect scaling of the GB art on the sleep screen: 1×, 2×, 3× … up to the maximum that fits the target resolution. The image is centred; unused area fills with the background colour. |
| **BMP palette** | Colour palette used for the `.bmp` export: DMG (green), Pocket (sepia), B&W (greyscale), SGB (purple/orange). The `.pxc` output is always greyscale. |
| **Invert** | Flip GB colour indices (0↔3, 1↔2) before conversion. |
| **Rotation** | 90° CW / CCW steps, same as image mode. |

**GB Printer text log** support: paste the serial log from a GB Printer capture tool. The parser reads hex byte lines and extracts the `PRNT` pallet register to apply the correct colour mapping automatically.

**GB → e-ink mapping:**

| GB index | Meaning | PXC level |
|----------|---------|-----------|
| 0 | Lightest | 3 (white) |
| 1 | Light    | 2 (light grey) |
| 2 | Dark     | 1 (dark grey) |
| 3 | Darkest  | 0 (black) |

### Preview
- Live preview updates on every change
- 3.5× zoom loupe follows the cursor for pixel-level inspection

### Export
- **Download .pxc** — CrossPoint native format
- **Download .bmp** — 4-bit indexed BMP (greyscale palette in image mode; GB colour palette in GB mode)

---

## Related

- [CrossPoint firmware](https://github.com/crosspoint-reader/crosspoint-reader) — the e-reader firmware this tool targets

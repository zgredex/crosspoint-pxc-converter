# PR 1614 Image Rendering Handoff

Comparison target:
- Base branch: `crosspoint-pr-1614-LUT` (`97cf9edf`)
- Feature branch: `feature/pr-1614-image-rendering` (`d36ba372`)
- Merge base: `ba4a361d`

Important boundary:
- I did not find a branch-to-branch diff in `open-x4-sdk/` or `lib/hal/HalDisplay*`.
- The meaningful drift is in firmware-side render orchestration, image decode/cache behavior, and sleep-screen handling.

## 1. EPUB image-page rendering is no longer the same control flow

Main file:
- `src/activities/reader/EpubReaderActivity.cpp`

Key code points:
- `renderContents()` image-page branching: lines `1482-1549`
- image-quality mode selection: lines `1417-1419`, `1485-1486`

Meaningful divergence:
- On `crosspoint-pr-1614-LUT`, image pages only went into factory grayscale when text anti-aliasing was on.
- On `feature/pr-1614-image-rendering`, image pages always count as grayscale work, even when text AA is off.
- `EIQ_HIGH` now explicitly selects the factory-LUT path.

Why this matters:
- LUT tuning is no longer being exercised under the same caller behavior.
- The PR branch may look "correct" in isolation, but your branch is invoking it under different preconditions.

## 2. Normal-quality EPUB image pages now do extra FAST refreshes

Main file:
- `src/activities/reader/EpubReaderActivity.cpp`

Key code points:
- image bounding-box blank + refresh sequence: lines `1490-1511`

Meaningful divergence:
- Your branch adds a "blank image area -> FAST_REFRESH -> re-render -> FAST_REFRESH" path for non-high-quality image pages.
- That path does not exist on `crosspoint-pr-1614-LUT`.

Why this matters:
- This is one of the strongest ghosting-calibration differences.
- Even if the LUT tables are identical, the display is now being driven through a different refresh sequence before and after image content is restored.

Commit waypoint:
- `490f88bb` `fix: restore double-FAST_REFRESH for Normal-mode EPUB image pages`

## 3. EPUB image decode/cache behavior now has two quality lanes

Main files:
- `lib/Epub/Epub/blocks/ImageBlock.cpp`
- `lib/Epub/Epub/converters/ImageToFramebufferDecoder.h`
- `lib/Epub/Epub/converters/JpegToFramebufferConverter.cpp`
- `lib/Epub/Epub/converters/PngToFramebufferConverter.cpp`

Key code points:
- quality-specific cache suffixes: `ImageBlock.cpp` lines `22-30`
- quality-aware cache selection: `ImageBlock.cpp` lines `109-143`
- decoder config flag: `ImageToFramebufferDecoder.h` line `21`
- JPEG high-quality dither use: `JpegToFramebufferConverter.cpp` callback uses `useHighQualityDither`
- PNG high-quality dither use: `PngToFramebufferConverter.cpp` callback uses `useHighQualityDither`

Meaningful divergence:
- Image cache is no longer a single `.pxc` lane.
- High-quality EPUB rendering writes `.high.pxc` alongside normal `.pxc`.
- JPEG and PNG decode now choose different Bayer threshold behavior depending on reader image quality.

Why this matters:
- The developer should not assume a single cached pixel output anymore.
- If they are comparing behavior across branches, they need to know which cache lane and dither lane was active.

Commit waypoint:
- `c537c172` `feat: add EPUB Image Quality setting (Normal/High)`

## 4. The grayscale plumbing now supports different power-down behavior

Main file:
- `lib/GfxRenderer/GfxRenderer.cpp`

Key code points:
- `displayBuffer(...)`: lines `1118-1124`
- `displayGrayBuffer(...)`: lines `1127-1134`
- `renderGrayscale(...)`: lines `1422-1477`
- `renderGrayscaleSinglePass(...)`: lines `1479-1544`

Meaningful divergence:
- Your branch adds an explicit `turnOffScreen` parameter through both BW and grayscale display paths.
- Sleep/image callers can now choose whether the panel powers off immediately after those flushes.

Why this matters:
- The LUT branch and your branch are not just using different image logic; they can also end a render in different panel power states.
- That can change visible flash/ghosting behavior around sleep images and grayscale transitions.

## 5. Single-pass factory grayscale now treats text differently

Main file:
- `lib/GfxRenderer/GfxRenderer.cpp`

Key code points:
- 2-bit glyph rendering logic in `renderCharImpl(...)`: lines `106-124`

Meaningful divergence:
- In the single-pass factory path, text can be collapsed to solid black when `GRAY2_LSB` is active and a secondary framebuffer is present.

Why this matters:
- This changes how text and image grayscale coexist on the same render.
- If the developer is tuning LUT/image output visually, this text-side behavior can affect perceived results even without changing the LUT arrays.

Commit waypoint:
- `4cb11585` `fix: process images even when text anti-aliasing is off`

## 6. Sleep handling diverged far beyond simple custom-image rendering

Main file:
- `src/activities/boot_sleep/SleepActivity.cpp`

Key code points:
- sleep entry snapshot decision: lines `389-425`
- grayscale custom BMP path: lines `643-667`
- overlay mode renderer: lines `841-1071`

Meaningful divergence:
- Your branch adds overlay sleep mode, reading-stats sleep mode, pinned sleep-image selection, PNG overlay decoding, and framebuffer snapshot/rebuild logic.
- `crosspoint-pr-1614-LUT` does not have this overlay compositor path.

Why this matters:
- If the developer sees crashes only on your branch, sleep handling is one of the highest-probability drift areas.
- The sleep path now does substantially more heap allocation, file I/O, and framebuffer preservation/restoration work.

Commit waypoints:
- `133edeb1` `feat: add transparent sleep screen`
- `3535f228` `feat: add sleep screen option for reading stats`
- `0d42d1fe` `fix: drop redundant BW pre-render in renderBitmapSleepScreen`
- `b814db97` `fix: clean preflash for PXC/BMP grayscale sleep wallpapers`
- `35833323` `fix: page overlay sleep mode only had single bw refresh, causing dark images`

## 7. Overlay sleep mode can rebuild the reader page before compositing

Main files:
- `src/activities/boot_sleep/SleepActivity.cpp`
- `src/activities/reader/EpubReaderActivity.cpp`
- `src/activities/reader/TxtReaderActivity.cpp`
- `src/activities/reader/XtcReaderActivity.cpp`

Key code points:
- overlay background selection and fallback: `SleepActivity.cpp` lines `869-888`
- overlay grayscale follow-up pass: `SleepActivity.cpp` lines `1038-1071`
- EPUB page reconstruction helper: `EpubReaderActivity.cpp` lines `1726-1794`
- TXT page reconstruction helper: `TxtReaderActivity.cpp` lines `578-700`
- XTC page reconstruction helper: `XtcReaderActivity.cpp` lines `305-360`

Meaningful divergence:
- On sleep, the branch may:
  - restore a stored BW snapshot,
  - or rebuild the saved reader page from disk/cache,
  - then draw BMP/PNG overlay content on top,
  - then run a fresh grayscale pass for EPUB/TXT backgrounds.

Why this matters:
- This is a major new behavior surface that did not exist on the LUT branch.
- If there is a device-specific crash, this path is one of the first places to inspect because it combines heap pressure, cache rebuilds, image decode, and extra grayscale passes in one flow.

## 8. Sleep mode configuration surface changed

Main files:
- `src/CrossPointSettings.h`
- `src/SettingsList.h`

Key code points:
- new sleep modes: `CrossPointSettings.h` lines `20-29`
- EPUB image quality enum: `CrossPointSettings.h` lines `175-177`

Meaningful divergence:
- Your branch adds:
  - `OVERLAY`
  - `READING_STATS_SLEEP`
  - `EPUB_IMAGE_QUALITY`

Why this matters:
- The developer is no longer tuning against one fixed sleep-image pipeline.
- Reported behavior may depend on the active sleep mode and image-quality setting, not just the LUT branch itself.

## Most likely crash-relevant drift

Highest priority to inspect:
- `SleepActivity.cpp` overlay path: lines `841-1071`
- `SleepActivity.cpp` sleep-entry BW snapshot logic: lines `392-394`
- `EpubReaderActivity.cpp` page reconstruction helper for sleep overlay: lines `1726-1794`
- `EpubReaderActivity.cpp` BW backup + grayscale path on image pages: lines `1517-1549`
- `GfxRenderer.cpp` single-pass grayscale secondary framebuffer allocation: lines `1496-1514`

Reason:
- These paths add extra allocations, extra restores, extra re-renders, and extra decode work that do not exist in the simpler LUT branch flow.

## Most likely ghosting-relevant drift

Highest priority to inspect:
- `EpubReaderActivity.cpp` double-`FAST_REFRESH` image-page logic: lines `1490-1511`
- `SleepActivity.cpp` overlay path BW + grayscale follow-up: lines `1038-1071`
- `GfxRenderer.cpp` grayscale display/power-down behavior: lines `1118-1134`

Reason:
- These are the places where panel-driving sequence changed, not just the image quantization.

## Short version for the developer

The LUT branch is not just being merged into a cosmetically different UI branch. On `feature/pr-1614-image-rendering`, the firmware now:
- routes EPUB images through quality-specific cache and dither lanes,
- runs a different refresh sequence for normal image pages,
- allows image grayscale even when text AA is off,
- and has a much more complex sleep-image/overlay pipeline.

So if the LUT work renders cleanly on `crosspoint-pr-1614-LUT` but crashes or ghosts on `feature/pr-1614-image-rendering`, the first assumption should be:
- the LUT constants are being exercised under a different render lifecycle,
- not necessarily that the LUT constants themselves are wrong.

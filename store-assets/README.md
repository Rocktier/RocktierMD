# Store assets — state and how to re-capture

This folder holds the App Store listing material for Rocktier Markdown.
Two files are source material, four are output:

| File | Role |
|---|---|
| `demo.md` | The document shown in the screenshots. A realistic scenario (field notes on offline-first software), not a self-description of the screenshot process. |
| `demo-code-math.md` | Second document used for the code + math screenshot. |
| `screenshot-1-editor.png` | 2560×1456 — **wrong size, stale copy** (see below). |
| `screenshot-2-code-math.png` | 2560×1456 — **wrong size, stale copy**. |
| `screenshot-3-dark.png` | 2560×1456 — **wrong size, stale copy**. |
| `store-tile-300.png` | 300×300 app tile. |

## Blocking: the three screenshots cannot be submitted as they are

Verified on 2026-11-12 by reading the PNG headers and opening the images:

1. **Size is invalid.** All three are 2560×1456. App Store Connect accepts
   1280×800, 1440×900, 2560×1600 or 2880×1800 for macOS — every accepted size is
   16:10. 2560×1456 is 16:9.1 and will be rejected on upload.
2. **Content is stale.** They still show the previous `demo.md` text
   ("A short document used for the Store screenshots…"), which has since been
   rewritten into a real scenario document. Shipping them would put an
   apologetic, self-referential paragraph on the store page.

Both are fixable only on a Mac — this machine is Windows.

## Re-capture procedure (macOS, true device only)

Per the family rule established after the Pic2WebP incident: **store screenshots
must be captured from the real app, never rendered headless.** In a headless
browser `isTauri()` is false, every `invoke()`-backed element degrades to a
placeholder, and the size/alpha checks still pass — the check cannot tell an
empty shell from a real window.

1. Build and open the app with `demo.md` (and `demo-code-math.md` for #2).
2. Set the window content area to 1280×800. At Retina 2× this yields 2560×1600.
3. Capture the window, not the screen:
   `screencapture -x -o -l <windowID>` — `-o` drops the drop shadow (which would
   push the image past 2560×1600), `-l` captures even when partly covered.
   Take the window id from `CGWindowListCopyWindowInfo`.
4. If the capture includes the 28 px title bar, crop it and add the equivalent
   back at the bottom, or capture the content area directly — the final image
   must be exactly 2560×1600.
5. Flatten to RGB (`colorType=2`): the App Store rejects alpha.
6. Verify each image by **content**, not by dimensions: the file tiles must show
   real thumbnails, the word/line counts must match the real status bar, and the
   document text must be the current `demo.md`.

## What is not verified

- Whether the current `demo.md` renders correctly at 1280×800 without a clipped
  line in the preview pane. It must be checked in step 6 above.
- Anything about the App Store Connect upload path for these images.

Recorded 2026-11-12. Do not mark this folder "ready" until all three images are
2560×1600, alpha-free, and show the current demo text.

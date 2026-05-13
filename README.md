# ClearPour App Store Screenshot Builder

This folder contains the reusable HTML/CSS compositor for ClearPour's App Store marketing images.

## Structure

- `source/frame/`
  - transparent device frame assets
- `source/screens/`
  - raw simulator screenshots from the app
- `src/`
  - HTML, CSS, and slide metadata for the composed marketing images
- `output/`
  - exported App Store-ready images
- `output-website/`
  - exported website-ready framed device images without text or colored background
- `scripts/`
  - local preview and export scripts

## Update Copy

Edit `src/slides.mjs`.

Each slide has:

- `image`: the raw screenshot filename in `source/screens/`
- `headline`: the text shown above the phone
- `output`: the exported filename written into both `output/` and `output-website/`

## Replace Screenshots

Drop new raw screenshots into `source/screens/`.

The exporter processes every supported image in `source/screens/`:

- Images listed in `src/slides.mjs` export to both `output/` and `output-website/`.
- Images not listed in `src/slides.mjs` export only to `output-website/`.
- Unlisted images keep their original filename in `output-website/`.

Update `src/slides.mjs` when an image needs App Store headline artwork.

## Preview

From this folder:

```bash
pnpm install
pnpm preview
```

Then open:

```text
http://127.0.0.1:8031/src/
```

`pnpm preview` is a long-running local server. It is supposed to stay running until you stop it with `Ctrl+C`.

## Export

The exporter uses `playwright-core` with a locally installed Chrome-compatible browser on macOS.

From this folder:

```bash
pnpm install
pnpm export
```

Exports are written to:

- `output/` for App Store-ready marketing images
- `output-website/` for plain framed phone images for the website

If the script cannot find Chrome automatically, set `CHROME_PATH`:

```bash
CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" pnpm export
```

## Notes

- The current frame and screen placement are matched to:
  - `iphone-frame.png`: `1350x2760`
  - raw screenshots: `1206x2622`
- The slide list and headlines live in `src/slides.mjs`.
- The main layout tuning lives in `src/styles.css`.
- The phone shadow is decorative and the screen image remains accurate to the app.

import { mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { slides } from "../src/slides.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const srcDir = resolve(rootDir, "src");
const sourceDir = resolve(rootDir, "source");
const outputDir = resolve(rootDir, "output");
const websiteOutputDir = resolve(rootDir, "output-website");

function pngDataUrl(bytes) {
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

function resolveChromeExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Chromium.app/Contents/MacOS/Chromium"
  ].filter(Boolean);

  return candidates[0];
}

const executablePath = resolveChromeExecutable();

if (!executablePath) {
  throw new Error("No Chrome-like browser found. Set CHROME_PATH to a local browser executable.");
}

await mkdir(outputDir, { recursive: true });
await mkdir(websiteOutputDir, { recursive: true });
const css = await readFile(resolve(srcDir, "styles.css"), "utf8");
const frameUrl = pngDataUrl(await readFile(resolve(sourceDir, "frame", "iphone-frame.png")));
const slideMarkupParts = [];
const websiteMarkupParts = [];

for (let index = 0; index < slides.length; index += 1) {
  const slide = slides[index];
  const screenshotUrl = pngDataUrl(
    await readFile(resolve(sourceDir, "screens", slide.image))
  );

  slideMarkupParts.push(`
    <section class="panel" id="slide-${index + 1}" data-output="${slide.output}">
      <div class="panel-inner">
        <h1 class="headline">${slide.headline}</h1>
        <div class="phone-wrap">
          <div class="phone-shadow"></div>
          <div class="phone-stage">
            <img class="screen-image" src="${screenshotUrl}" alt="${slide.headline}">
            <img class="frame-image" src="${frameUrl}" alt="">
          </div>
        </div>
      </div>
    </section>
  `);

  websiteMarkupParts.push(`
    <section class="website-panel" id="website-slide-${index + 1}" data-output="${slide.output}">
      <div class="phone-wrap">
        <div class="phone-shadow"></div>
        <div class="phone-stage">
          <img class="screen-image" src="${screenshotUrl}" alt="${slide.headline}">
          <img class="frame-image" src="${frameUrl}" alt="">
        </div>
      </div>
    </section>
  `);
}

const appStoreHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>ClearPour App Store Screenshot Builder</title>
    <style>${css}</style>
  </head>
  <body>
    <main class="gallery">
      ${slideMarkupParts.join("")}
    </main>
    <section class="website-gallery" aria-hidden="true">
      ${websiteMarkupParts.join("")}
    </section>
  </body>
</html>`;

function buildWebsiteHtml(markup) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>ClearPour Website Screenshot Builder</title>
    <style>
      html, body {
        background: transparent !important;
      }
      ${css}
    </style>
  </head>
  <body>
    <section class="website-gallery">
      ${markup}
    </section>
  </body>
</html>`;
}

const browser = await chromium.launch({
  executablePath,
  headless: true,
  env: {
    ...process.env,
    HOME: rootDir
  },
  args: [
    "--disable-crash-reporter",
    "--disable-crashpad"
  ]
});

const page = await browser.newPage({
  viewport: {
    width: 1400,
    height: 3000
  },
  deviceScaleFactor: 1
});

await page.setContent(appStoreHtml, { waitUntil: "load" });
await page.waitForFunction(() =>
  Array.from(document.images).every((image) => image.complete)
);

for (let index = 0; index < slides.length; index += 1) {
  const slide = slides[index];
  const locator = page.locator(`#slide-${index + 1}`);
  await locator.screenshot({
    path: resolve(outputDir, slide.output)
  });
  console.log(`Exported ${slide.output}`);

  const websitePage = await browser.newPage({
    viewport: {
      width: 1200,
      height: 2200
    },
    deviceScaleFactor: 1
  });

  await websitePage.setContent(buildWebsiteHtml(websiteMarkupParts[index]), {
    waitUntil: "load"
  });
  await websitePage.waitForFunction(() =>
    Array.from(document.images).every((image) => image.complete)
  );

  const websiteLocator = websitePage.locator(`#website-slide-${index + 1}`);
  const box = await websiteLocator.boundingBox();

  if (!box) {
    throw new Error(`Could not determine bounds for website slide ${index + 1}`);
  }

  await websitePage.screenshot({
    path: resolve(websiteOutputDir, slide.output),
    omitBackground: true,
    clip: {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height
    }
  });
  console.log(`Exported website ${slide.output}`);
  await websitePage.close();
}

await browser.close();

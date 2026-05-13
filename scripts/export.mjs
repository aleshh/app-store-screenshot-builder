import { mkdir, readFile, readdir } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { slides } from "../src/slides.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const srcDir = resolve(rootDir, "src");
const sourceDir = resolve(rootDir, "source");
const outputDir = resolve(rootDir, "output");
const websiteOutputDir = resolve(rootDir, "output-website");

const imageMimeTypes = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"]
]);

function imageDataUrl(filename, bytes) {
  const mimeType = imageMimeTypes.get(extname(filename).toLowerCase());

  if (!mimeType) {
    throw new Error(`Unsupported image type: ${filename}`);
  }

  return `data:${mimeType};base64,${bytes.toString("base64")}`;
}

async function listScreenImages() {
  const entries = await readdir(resolve(sourceDir, "screens"), { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => !name.startsWith("."))
    .filter((name) => imageMimeTypes.has(extname(name).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
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
const fontUrl = `data:font/ttf;base64,${(
  await readFile(resolve(sourceDir, "fonts", "Fraunces-Variable.ttf"))
).toString("base64")}`;
const inlineCss = `
  @font-face {
    font-family: "Fraunces Builder";
    src: url("${fontUrl}") format("truetype");
    font-weight: 100 900;
    font-style: normal;
  }
  ${css}
`;
const frameFilename = "iphone-frame.png";
const frameUrl = imageDataUrl(
  frameFilename,
  await readFile(resolve(sourceDir, "frame", frameFilename))
);
const slideMarkupParts = [];
const websiteMarkupParts = [];
const screenImages = await listScreenImages();
const slideImageNames = new Set(slides.map((slide) => slide.image));
const websiteItems = [
  ...slides,
  ...screenImages
    .filter((image) => !slideImageNames.has(image))
    .map((image) => ({
      image,
      headline: "",
      output: image
    }))
];

for (let index = 0; index < slides.length; index += 1) {
  const slide = slides[index];
  const screenshotUrl = imageDataUrl(
    slide.image,
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

}

for (let index = 0; index < websiteItems.length; index += 1) {
  const item = websiteItems[index];
  const screenshotUrl = imageDataUrl(
    item.image,
    await readFile(resolve(sourceDir, "screens", item.image))
  );

  websiteMarkupParts.push(`
    <section class="website-panel" id="website-slide-${index + 1}" data-output="${item.output}">
      <div class="phone-wrap">
        <div class="phone-shadow"></div>
        <div class="phone-stage">
          <img class="screen-image" src="${screenshotUrl}" alt="${item.headline}">
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
    <style>${inlineCss}</style>
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
      ${inlineCss}
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
}

for (let index = 0; index < websiteItems.length; index += 1) {
  const item = websiteItems[index];
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
    path: resolve(websiteOutputDir, item.output),
    omitBackground: true,
    clip: {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height
    }
  });
  console.log(`Exported website ${item.output}`);
  await websitePage.close();
}

await browser.close();

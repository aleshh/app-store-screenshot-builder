import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { slides } from "../src/slides.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const srcDir = resolve(rootDir, "src");
const outputDir = resolve(rootDir, "output");

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
    width: 1500,
    height: 3200
  },
  deviceScaleFactor: 2
});

const entryUrl = new URL(`file://${resolve(srcDir, "index.html")}`);
await page.goto(entryUrl.href, { waitUntil: "load" });

for (let index = 0; index < slides.length; index += 1) {
  const slide = slides[index];
  const locator = page.locator(`#slide-${index + 1}`);
  await locator.screenshot({
    path: resolve(outputDir, slide.output)
  });
  console.log(`Exported ${slide.output}`);
}

await browser.close();

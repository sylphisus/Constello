// Scroll-capture a Pinterest board into a sequence of screenshots.
//
// Why this exists: a Pinterest board is a visual collection — the "world someone
// is building" lives in the images, not the captions (most pins carry none). The
// v5 API only returns pin text, so it reads a heavily-visual board as nearly
// empty. This drives a real headless Chrome, screenshots a viewport at a time with
// overlap, and stitches nothing — the PNGs are read by hand (drop them into
// claude.ai and ask for a personal analysis).
//
// Two hard lessons are baked in:
//  - Scale must be HONEST. Browser/CSS zoom paints at composite time, which
//    page.screenshot() can't see, so zoomed content lands shrunk in a corner. We
//    use an explicit viewport at deviceScaleFactor 2 — no zoom — so the canvas and
//    the paint agree.
//  - The DOM LIES about what's painted (Pinterest keeps loaded-but-unpainted
//    virtualized pins), so we never ask it. We wait on the PIXELS: nudge the
//    virtualizer, then poll screenshots until the painted content stops growing.
//
// Usage:  node capture.mjs <board-url> [outDir]
// Login persists in ./.chrome-profile — run `npm run login` once for private /
// your-own boards; public boards need no login. HEADLESS=false to watch (the
// viewport is then capped by your screen).

import { chromium } from "playwright-core";
import { PNG } from "pngjs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SCROLL_FRACTION = 0.85; // step a little less than a screen so no row is lost at the seam
const POLL_MS = 600; // gap between paint-stability polls
const PAINT_TIMEOUT_MS = 12000; // give up waiting for a band to finish painting
const MAX_SHOTS = 80; // safety cap for very large boards

// Last row that isn't white — the real content bottom, read from pixels (the DOM
// can't be trusted). Samples every 4th column; the board's art always has dark
// pixels, so this is safe against near-white sketch pins.
function contentBottom(png, threshold = 245) {
  const { width, height, data } = png;
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x += 4) {
      const i = (y * width + x) * 4;
      if (data[i] < threshold || data[i + 1] < threshold || data[i + 2] < threshold) return y;
    }
  }
  return -1; // entirely white
}

// Screenshot the viewport, then hold until it's actually PAINTED: poll until the
// content bottom stops growing (pins finished loading in), or timeout. Returns the
// settled PNG object. Immune to Pinterest's phantom DOM and to animating GIFs (a
// mid-frame GIF doesn't move the content bottom).
async function screenshotPainted(page) {
  const start = Date.now();
  let prevBottom = -2;
  let png = PNG.sync.read(await page.screenshot({ animations: "disabled" }));
  while (Date.now() - start < PAINT_TIMEOUT_MS) {
    const bottom = contentBottom(png);
    if (bottom === prevBottom) return png; // two polls agree → painting settled
    prevBottom = bottom;
    await page.waitForTimeout(POLL_MS);
    png = PNG.sync.read(await page.screenshot({ animations: "disabled" }));
  }
  return png;
}

// Crop a PNG to its content bottom. Returns the encoded buffer, or null if all white.
function trimmed(png) {
  const bottom = contentBottom(png);
  if (bottom < 0) return null;
  const keep = bottom + 1;
  if (keep >= png.height) return PNG.sync.write(png);
  const out = new PNG({ width: png.width, height: keep });
  png.data.copy(out.data, 0, 0, keep * png.width * 4);
  return PNG.sync.write(out);
}

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error("Usage: node capture.mjs <board-url> [outDir]");
    process.exit(1);
  }

  const slug =
    (url.replace(/\/+$/, "").split("/").slice(-2).join("-") || "board").replace(/[^a-z0-9-]/gi, "_");
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "");
  const outDir = resolve(process.argv[3] || join(__dirname, "shots", `${slug}-${stamp}`));
  await mkdir(outDir, { recursive: true });

  // Explicit viewport, deviceScaleFactor 2, NO zoom — the honest scale. Wide and
  // landscape: Pinterest is responsive, so the width fills with columns. Headless so
  // the viewport isn't capped by the physical screen; the logged-in session in
  // .chrome-profile carries over via cookies. VIEWPORT_WIDTH/HEIGHT to re-shape.
  const viewport = {
    width: Number(process.env.VIEWPORT_WIDTH) || 2000,
    height: Number(process.env.VIEWPORT_HEIGHT) || 1200,
  };
  const context = await chromium.launchPersistentContext(join(__dirname, ".chrome-profile"), {
    headless: process.env.HEADLESS !== "false",
    channel: "chrome",
    viewport,
    deviceScaleFactor: 2,
    args: ["--disable-blink-features=AutomationControlled"],
    ignoreDefaultArgs: ["--enable-automation"],
    chromiumSandbox: true,
  });
  const page = context.pages()[0] ?? (await context.newPage());

  console.log(`Opening ${url}`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2500); // let the grid (and any login/cookie wall) settle
  await page.evaluate(() => (document.body.style.zoom = "1")); // belt-and-suspenders: no CSS zoom

  let y = 0;
  let shot = 0;
  let prevBuf = null;
  let prevScrollY = -Infinity;
  while (shot < MAX_SHOTS) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    // Real wheel events nudge Pinterest's virtualizer into mounting the rows now in
    // view — a bare scrollTo often doesn't. Net-zero so we stay at y.
    await page.mouse.wheel(0, 60);
    await page.mouse.wheel(0, -60);
    await page.waitForTimeout(POLL_MS);

    const png = await screenshotPainted(page);
    const buf = trimmed(png);
    if (!buf) break; // fully white → scrolled past all content, stop
    if (prevBuf && buf.equals(prevBuf)) break; // identical to the last shot → stuck, stop

    const file = join(outDir, `shot-${String(shot + 1).padStart(3, "0")}.png`);
    await writeFile(file, buf);
    console.log(`  ${file}`);
    shot++;
    prevBuf = buf;

    const { scrollY, vh, maxY } = await page.evaluate(() => ({
      scrollY: window.scrollY,
      vh: window.innerHeight,
      maxY: document.documentElement.scrollHeight - window.innerHeight,
    }));
    // Stop at the bottom. maxY can't be trusted at the end (Pinterest's related feed /
    // loading spinner keeps growing scrollHeight), so the real signal is: the scroll
    // stopped advancing.
    if (scrollY >= maxY - 4 || scrollY <= prevScrollY + 4) break;
    prevScrollY = scrollY;
    y = scrollY + Math.round(vh * SCROLL_FRACTION);
  }

  await context.close();
  console.log(`\nDone — ${shot} screenshots in:\n${outDir}`);
  spawn("open", [outDir]); // reveal the folder so you can drag the shots into claude.ai
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

// capture-box.mjs — scroll-capture a public X/Twitter profile into viewport-sized
// screenshot tiles for a Constello by-hand reading.
//
// Why screenshots: raw text (the constello-x gallery-dl path) flattens a feed into
// "- [reply] some words" and throws away everything a timeline *is* — the images,
// quote-tweet layering, video thumbnails, the actual look of how someone posts.
// That's good for an archive and nothing else. To read the person, the read needs
// the feed as it looks, so we drive a real browser and screenshot the scroll.
//
// No stitching: each tile is ONE viewport. Claude downscales any image past
// ~1.15MP / 1568px long-edge before reading, so a single legible viewport survives
// that resize; a tall megascroll or a 3-up strip would be downscaled into mush.
// Keep VIEWPORT_* modest and let the scroll loop produce many legible tiles.
//
// Mirrors apps/pinterest-capture/capture-box.mjs (same scroll→screenshot loop, same
// env knobs, same persisted Chrome profile). X gates logged-out timelines, so the
// persisted profile must be logged in — seed PROFILE_DIR once headed (see README /
// the hermes skill Pitfalls). Defaults are tuned for tweet legibility, not density
// (we have context-window headroom to spare); expect one calibration pass per box.
//
//   ZOOM, SCROLL_FRACTION, SETTLE_MS, MAX_SHOTS   — framing + how far to scroll
//   VIEWPORT_WIDTH, VIEWPORT_HEIGHT               — fixed window (default 1280x1600)
//   DEVICE_SCALE_FACTOR                           — headless only; 2 = crisp (default 2)
//   HEADLESS                                      — "false" (headed, needs a display) | "new"/"true"
//   CHROME_CHANNEL / CHROME_PATH                  — which Chrome to drive
//   PROFILE_DIR                                   — persisted login (seed once)
//
// Usage:  node capture-box.mjs <handle|url> [outDir]
// The last stdout line is `OUTDIR=<path>` so a wrapper can capture where shots landed.

import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { mkdir } from "node:fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));

const num = (v, d) => (v != null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : d);

const ZOOM = num(process.env.ZOOM, 1.0);
const SCROLL_FRACTION = num(process.env.SCROLL_FRACTION, 0.9);
const SETTLE_MS = num(process.env.SETTLE_MS, 1500);
const MAX_SHOTS = num(process.env.MAX_SHOTS, 40);
const VW = num(process.env.VIEWPORT_WIDTH, 1280);
const VH = num(process.env.VIEWPORT_HEIGHT, 1600);
const DSF = num(process.env.DEVICE_SCALE_FACTOR, 2);
const h = (process.env.HEADLESS ?? "false").toLowerCase();
const HEADLESS = h === "true" || h === "new" || h === "1";
const CHROME_PATH = process.env.CHROME_PATH || undefined;
const CHROME_CHANNEL = process.env.CHROME_CHANNEL || "chrome";
const PROFILE_DIR = process.env.PROFILE_DIR || join(__dirname, ".chrome-profile");

// Accept "@name", "name", or any x.com/twitter.com URL → the bare handle. The first
// path segment is the handle; trailing tabs (/with_replies, /media) are dropped.
function toHandle(arg) {
  let s = arg.trim().replace(/^@/, "");
  const m = s.match(/(?:x|twitter)\.com\/([^/?#]+)/i);
  if (m) s = m[1];
  return s.replace(/[^A-Za-z0-9_]/g, "");
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: node capture-box.mjs <handle|url> [outDir]");
    process.exit(1);
  }
  const handle = toHandle(arg);
  if (!handle) {
    console.error(`Could not read a handle out of "${arg}".`);
    process.exit(1);
  }
  const url = `https://x.com/${handle}`;

  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "");
  const outDir = resolve(process.argv[3] || join(__dirname, "shots", `${handle}-${stamp}`));
  await mkdir(outDir, { recursive: true });

  // Pin viewport so framing is the same on any box. deviceScaleFactor emulation is
  // only reliable headless, so we set it there; headed stays at the display's DPR.
  const launchOpts = {
    headless: HEADLESS,
    viewport: { width: VW, height: VH },
    args: [`--window-size=${VW},${VH}`],
  };
  if (CHROME_PATH) launchOpts.executablePath = CHROME_PATH;
  else launchOpts.channel = CHROME_CHANNEL;
  if (HEADLESS) launchOpts.deviceScaleFactor = DSF;

  const context = await chromium.launchPersistentContext(PROFILE_DIR, launchOpts);
  const page = context.pages()[0] ?? (await context.newPage());

  console.log(`Opening ${url}  (headless=${HEADLESS}, ${VW}x${VH}${HEADLESS ? `@${DSF}x` : ""}, zoom=${ZOOM})`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  // X hydrates the timeline client-side and lazy-loads media; give it room before
  // the first shot so the profile header + first tweets are painted.
  await page.waitForTimeout(4000);

  await page.evaluate((z) => {
    document.body.style.zoom = String(z);
  }, ZOOM);
  await page.waitForTimeout(800);

  let shot = 0;
  while (shot < MAX_SHOTS) {
    await page.waitForTimeout(SETTLE_MS);
    const file = join(outDir, `shot-${String(shot + 1).padStart(3, "0")}.png`);
    await page.screenshot({ path: file });
    console.log(`  ${file}`);
    shot++;

    const before = await page.evaluate(() => window.scrollY);
    await page.evaluate((frac) => window.scrollBy(0, Math.round(window.innerHeight * frac)), SCROLL_FRACTION);
    await page.waitForTimeout(SETTLE_MS);
    const after = await page.evaluate(() => window.scrollY);
    if (after - before < 4) break; // didn't advance → end of the timeline
  }

  console.log(`\nDone — ${shot} screenshots in:\n${outDir}`);
  await context.close();
  // Delivery happens in the skill wrapper; just emit the path for it to read.
  console.log(`OUTDIR=${outDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

// capture-box.mjs — Linux/server variant of capture.mjs for the always-on (hermes) box.
//
// capture.mjs (the macOS laptop path) is left untouched. This is a separate,
// self-contained entry tuned for a headless server: it pins viewport + device
// scale so framing is deterministic on whatever display the box has (instead of
// inheriting a retina fullscreen window), and it does NOT `open` the folder at the
// end — on the box, delivery (zip + Telegram sendDocument) is a separate step.
//
// Headed vs headless: defaults to headed (run it under Xvfb — see the hermes skill
// wrapper) because a real browser is gentler on Pinterest's bot checks and reuses a
// seeded login. Set HEADLESS=new for true headless, which lets Playwright render at
// DEVICE_SCALE_FACTOR deterministically (the simplest path to crisp shots).
//
// Every knob is env-tunable so you can dial in framing on the box without editing
// code — expect one calibration pass on a new box:
//   ZOOM, SCROLL_FRACTION, SETTLE_MS, MAX_SHOTS   — same knobs as capture.mjs
//   VIEWPORT_WIDTH, VIEWPORT_HEIGHT               — fixed window (default 1920x1080)
//   DEVICE_SCALE_FACTOR                           — headless only; 2 = crisp (default 2)
//   HEADLESS                                      — "false" (headed, needs a display) | "new"/"true"
//   CHROME_CHANNEL / CHROME_PATH                  — which Chrome to drive
//   PROFILE_DIR                                   — persisted login (seed once for private boards)
//
// Usage:  node capture-box.mjs <board-url> [outDir]
// The last stdout line is `OUTDIR=<path>` so a wrapper can capture where shots landed.

import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { mkdir } from "node:fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));

const num = (v, d) => (v != null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : d);

const ZOOM = num(process.env.ZOOM, 0.5);
const SCROLL_FRACTION = num(process.env.SCROLL_FRACTION, 0.85);
const SETTLE_MS = num(process.env.SETTLE_MS, 1300);
const MAX_SHOTS = num(process.env.MAX_SHOTS, 80);
const VW = num(process.env.VIEWPORT_WIDTH, 1920);
const VH = num(process.env.VIEWPORT_HEIGHT, 1080);
const DSF = num(process.env.DEVICE_SCALE_FACTOR, 2);
const h = (process.env.HEADLESS ?? "false").toLowerCase();
const HEADLESS = h === "true" || h === "new" || h === "1";
const CHROME_PATH = process.env.CHROME_PATH || undefined;
const CHROME_CHANNEL = process.env.CHROME_CHANNEL || "chrome";
const PROFILE_DIR = process.env.PROFILE_DIR || join(__dirname, ".chrome-profile");

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error("Usage: node capture-box.mjs <board-url> [outDir]");
    process.exit(1);
  }

  const slug = (url.replace(/\/+$/, "").split("/").slice(-2).join("-") || "board").replace(
    /[^a-z0-9-]/gi,
    "_",
  );
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "");
  const outDir = resolve(process.argv[3] || join(__dirname, "shots", `${slug}-${stamp}`));
  await mkdir(outDir, { recursive: true });

  // Pin viewport so framing is the same on any box. deviceScaleFactor emulation is
  // only reliable headless, so we set it there; headed stays at the display's DPR
  // (raise VIEWPORT_* + lower ZOOM if you want crisper headed shots).
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
  await page.waitForTimeout(3500);

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
    if (after - before < 4) break; // didn't advance → bottom of the grid
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

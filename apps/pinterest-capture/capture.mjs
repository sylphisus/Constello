// Scroll-capture a Pinterest board into a sequence of screenshots.
//
// Why this exists: a Pinterest board is a visual collection — the "world someone
// is building" lives in the images, not the captions (most pins carry none). The
// v5 API only returns pin text, so it reads a heavily-visual board as nearly
// empty. This drives a real Chrome window instead: zoom out, screenshot, scroll a
// bit less than a screen, repeat to the bottom. The PNGs are then read by hand —
// drop them into claude.ai and ask for a personal analysis.
//
// The grid is virtualized (pins mount/unmount as they scroll), so a single
// full-page screenshot doesn't work — we shoot a viewport at a time, with overlap
// so no masonry row is lost at the seam.
//
// Usage:  node capture.mjs <board-url> [outDir]
// Login persists in ./.chrome-profile — log in once in the window that opens for
// private / your-own boards; public boards need no login.

import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));

const ZOOM = 0.5; // pack more pins per shot (your Cmd-"−" instinct: fewer images, cheaper read)
const SCROLL_FRACTION = 0.85; // scroll a little less than a screen so no row is lost at the seam
const SETTLE_MS = 1300; // let the next chunk of images load before shooting
const MAX_SHOTS = 80; // safety cap for very large boards

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error("Usage: node capture.mjs <board-url> [outDir]");
    process.exit(1);
  }

  const slug =
    (url.replace(/\/+$/, "").split("/").slice(-2).join("-") || "board").replace(
      /[^a-z0-9-]/gi,
      "_",
    );
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "");
  const outDir = resolve(process.argv[3] || join(__dirname, "shots", `${slug}-${stamp}`));
  await mkdir(outDir, { recursive: true });

  const context = await chromium.launchPersistentContext(join(__dirname, ".chrome-profile"), {
    headless: false,
    channel: "chrome", // drive the real Chrome you already have
    args: ["--start-fullscreen"], // fill the screen → more pins per shot, fewer images
    viewport: null, // null = the page uses the real (fullscreen) window size; retina gives crisp shots
  });
  const page = context.pages()[0] ?? (await context.newPage());

  console.log(`Opening ${url}`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  // Give the grid (and any login / cookie wall you may need to dismiss) a moment.
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
  spawn("open", [outDir]); // reveal the folder so you can drag the shots into claude.ai
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

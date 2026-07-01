// Open the board (real Chrome, logged-in profile) and watch the REAL browser
// zoom. Unlike CSS `body.zoom`, Chrome's per-site zoom (Cmd −) actually changes
// window.innerHeight — so Pinterest loads pins for the whole visible area — and
// Chrome saves it per origin in this profile, so captures should inherit it.
//
// Usage:  node inspect.mjs [board-url]   (or: npm run inspect)
// Press Cmd − a few times until pinterest.com is ~50% (more pins fit). Watch
// innerHeight grow in this terminal. Then close the window (or press Enter here)
// — the zoom is saved to the profile.

import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const url = process.argv[2] || "https://www.pinterest.com/sylphisus/-_/";

const context = await chromium.launchPersistentContext(join(__dirname, ".chrome-profile"), {
  headless: false,
  channel: "chrome",
  args: ["--start-fullscreen", "--disable-blink-features=AutomationControlled"],
  ignoreDefaultArgs: ["--enable-automation"],
  chromiumSandbox: true,
  viewport: null,
});
const page = context.pages()[0] ?? (await context.newPage());
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(2500);

let done = false;
const finish = () => (done = true);
context.on("close", finish);
process.stdin.once("data", finish);

const base = await page.evaluate(() => window.innerHeight);
console.log(`\nReal viewport now: innerHeight = ${base}px.`);
console.log("→ Press Cmd − a few times to zoom pinterest.com out to ~50%. Watch this grow.");
console.log("→ Then close the window (or press Enter here). The zoom saves to the profile.\n");

while (!done) {
  await page.waitForTimeout(2500);
  if (done) break;
  try {
    const h = await page.evaluate(() => window.innerHeight);
    console.log(`  innerHeight = ${h}px   (~${Math.round((base / h) * 100)}% zoom vs start)`);
  } catch {
    break;
  }
}
await context.close().catch(() => {});
process.exit(0);

// Sign the capture browser's persistent profile into Pinterest, once.
//
// capture.mjs only pauses ~3.5s before it starts scrolling, which isn't long
// enough to log in — so a board behind the "Log in to see more" wall (your own
// or private boards) comes out half-greyed. Run this once: a Chrome window opens
// to Pinterest's login using the SAME .chrome-profile capture.mjs uses. Log in,
// then close the window (or press Enter here). The session persists in
// .chrome-profile/ for every future capture.
//
// Usage:  node login.mjs   (or: npm run login)
// We never see your password — you type it into the real Pinterest page.

import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const context = await chromium.launchPersistentContext(join(__dirname, ".chrome-profile"), {
  headless: false,
  channel: "chrome", // the real Chrome capture.mjs drives
  viewport: null,
  // Look like an ordinary Chrome, not an automated one — otherwise Google's
  // "Continue with Google" refuses to sign in ("this browser may not be secure"),
  // and Chrome nags about --no-sandbox. Keep the real sandbox on; drop the
  // automation tells (--enable-automation + navigator.webdriver).
  chromiumSandbox: true,
  ignoreDefaultArgs: ["--enable-automation"],
  args: ["--disable-blink-features=AutomationControlled"],
});
const page = context.pages()[0] ?? (await context.newPage());
await page.goto("https://www.pinterest.com/login/", { waitUntil: "domcontentloaded", timeout: 60000 });

console.log(
  "\nChrome is open. Log into your Pinterest account, then either close the window\n" +
    "or press Enter here — your session saves to .chrome-profile/ for future captures.\n",
);

// Finish on whichever comes first: the window being closed, or Enter in the terminal.
await new Promise((resolve) => {
  context.on("close", resolve);
  process.stdin.once("data", resolve);
});

await context.close().catch(() => {});
console.log("Saved. Future captures will run signed in.");
process.exit(0);

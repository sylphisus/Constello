---
name: constello-x
description: Pull a public X/Twitter account into Constello — screenshot-capture the timeline for a by-hand reading, and/or scrape the text archive. Use when asked to scrape, capture, pull, import, screenshot, or "read" someone's Twitter/X (a handle like @name) into Constello or for a Constello reading.
version: 0.1.0
platforms: [linux, macos]
metadata:
  hermes:
    tags: [constello, twitter, x, scrape]
    category: constello
    requires_toolsets: [terminal]
---

# Pull an X/Twitter handle into Constello

Two complementary paths, both on this box:

- **Screenshots (the read material)** — scroll-capture the timeline as viewport-sized
  PNG tiles and deliver them to Telegram, uncompressed, for the by-hand read. Raw text
  flattens a feed and throws away everything a timeline *is* (images, quote-tweets,
  layout, the look of how someone posts); the screenshots are what the reading is
  actually drawn from. **This is the default when someone wants to read a person.**
- **Text archive** — the `constello-x` gallery-dl bridge scrapes newest posts + profile
  and POSTs them into Constello as one entry. Good for archiving/identity, not for the
  read. Complementary, not a replacement.

The hand-read happens later in claude.ai either way.

## When to use
- "pull @handle into constello" / "scrape twitter for @name" / "import @x's account"
- "screenshot / capture @handle for a reading" → the screenshot path below.
- Optionally attaching to an existing constellation (`--constellation-id <id>`, text path).

## Screenshots — capture + deliver (the read material)
1. Run the wrapper with the bare handle or any profile URL:
   ```sh
   scripts/capture-and-deliver.sh <handle|url>
   ```
   It runs `apps/x-capture/capture-box.mjs` (headed Chrome under Xvfb, persisted login
   profile), scroll-shoots viewport tiles with no stitching, then zips them and sends
   them to Telegram via `sendDocument` (never `sendPhoto` — that re-encodes to JPEG and
   destroys tweet legibility).
2. Confirm the delivery line: `delivered <zip> -> Telegram chat <id> … (<n> shots)`.
   The shots land in the same Telegram channel hermes uses; read them there.

### Required environment (screenshots)
- `CONSTELLO_X_DIR` — path to `apps/x-capture` on this box (has `capture-box.mjs`).
- `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` (falls back to hermes's home channel).
- Tuning knobs are env-vars on `capture-box.mjs` (`ZOOM`, `MAX_SHOTS`, `VIEWPORT_*`,
  `HEADLESS`, `PROFILE_DIR`, …); expect one calibration pass per box.

### Pitfalls (screenshots)
- **Logged-out profile** → X gates timelines, so empty/blank shots or a login wall.
  The persisted `PROFILE_DIR` must be logged in; seed it once headed (or copy a seeded
  profile up). This is the main recurring maintenance item.
- **Compressed delivery** → never switch to `sendPhoto`; the by-hand read depends on
  the PNGs staying byte-intact (see memory: constello-image-delivery-uncompressed).
- **No display** → headed Chrome needs Xvfb (`apt install xvfb`), or set `HEADLESS=new`.

## Text archive — scrape + ingest
1. Run the wrapper with the bare handle (no leading `@` needed):
   ```sh
   scripts/pull.sh <handle> [constellation-id]
   ```
   It cd's into the `twitter-preservation` repo and runs `uv run constello-x`, which
   scrapes via gallery-dl (using the X session cookie that lives in that repo's
   `.context/`) and POSTs the normalized data to the Constello admin ingest route.
2. Report the `constellationId` and `entryId` from the JSON it prints.

### Required environment (text archive)
- `CONSTELLO_TWITTER_DIR` — path to the `twitter-preservation` repo on this box.
- `CONSTELLO_ADMIN_PASSWORD` — must match Vercel's `ADMIN_PASSWORD` (the bridge reads it).

### Pitfalls (text archive)
- **Expired X cookie** → empty timeline or a 401 from X. Refresh `.context/x-cookies.txt`
  in the `twitter-preservation` repo (re-export from a logged-in browser). This is the
  main recurring maintenance item on a server.
- **Wrong host** → the bridge already targets `www.constello.xyz` directly; don't point
  it at the apex (it 308-redirects and drops Basic auth).
- **Placeholder password** → if `CONSTELLO_ADMIN_PASSWORD` still contains the `…`
  placeholder the bridge errors out early with a clear message; set the real one.

### Verification (text archive)
Success prints `Pushed. Constellation: <id> · entry: <id>`. A non-zero exit means the
scrape or push failed — surface the stderr.

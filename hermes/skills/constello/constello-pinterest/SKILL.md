---
name: constello-pinterest
description: Capture a Pinterest board into screenshots on this box and deliver them (uncompressed) for a Constello reading. Use when asked to capture, scrape, pull, or "read" a Pinterest board (a pinterest.com/<user>/<board> URL).
version: 0.1.0
platforms: [linux]
metadata:
  hermes:
    tags: [constello, pinterest, screenshots]
    category: constello
    requires_toolsets: [terminal]
---

# Capture a Pinterest board for a Constello reading

A Pinterest board is a *visual* collection — the signal is the imagery, which the
v5 API can't see. So we drive a real browser, scroll-screenshot the board, and
deliver the PNGs for a by-hand read. This is the laptop `pinterest-capture` tool,
moved onto the box: it runs the Linux entry (`capture-box.mjs`) under a virtual
display, then sends the shots to Telegram **as a document** (never a photo — see
Pitfalls).

## When to use
- "capture this board <url>" / "pull <pinterest board url> for a reading"

## Procedure
1. Run the wrapper with the board URL:
   ```sh
   scripts/capture-and-deliver.sh <board-url>
   ```
   It runs `capture-box.mjs` under Xvfb (headed) and then zips + delivers the shots
   to the configured Telegram chat as a single document.
2. Report the shot count and confirm delivery.

## Required environment
- `CONSTELLO_PINTEREST_DIR` — path to `apps/pinterest-capture` (has `capture-box.mjs`).
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` — where to deliver the shots.
- Optional framing knobs (see `capture-box.mjs` header): `ZOOM`, `VIEWPORT_WIDTH/HEIGHT`,
  `DEVICE_SCALE_FACTOR`, `HEADLESS`, `XVFB_RES`.

## Pitfalls
- **Telegram compression — the load-bearing rule.** Deliver via `sendDocument`, NEVER
  `sendPhoto`. The photo path re-encodes to JPEG and caps the long edge (~1280px),
  which destroys the board legibility the read depends on. `deliver-telegram.sh`
  already forces the document path and zips losslessly; don't route shots through any
  "send image / send photo" helper instead.
- **Private / your own boards** need a one-time login. Seed the persisted profile
  (`PROFILE_DIR`, default `<pinterest-dir>/.chrome-profile`) once — copy the laptop's
  `.chrome-profile/` up, or log in via a VNC/remote-display session. Public boards
  need no login.
- **No display** → headed Chrome can't launch. The wrapper runs it under `xvfb-run`;
  if Xvfb isn't installed the run fails (the setup script installs it). Or set
  `HEADLESS=new` to skip the display entirely.
- **Framing differs from the laptop.** A new box needs one calibration pass — adjust
  `VIEWPORT_*`, `XVFB_RES`, `DEVICE_SCALE_FACTOR`, and `ZOOM` until a shot looks right.
- **>50 MB** zip exceeds Telegram's bot document cap; the script warns — lower
  `MAX_SHOTS` or split.

## Verification
The wrapper prints the shot count and `delivered … -> Telegram chat … (as document)`.
Confirm the file arrives in Telegram as a **file/document**, not an inline photo.

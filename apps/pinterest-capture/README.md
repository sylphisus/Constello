# pinterest-capture

Scroll-captures a Pinterest board into a sequence of screenshots, so a heavily
visual board can be read by hand (drop the PNGs into claude.ai and ask for a
personal analysis).

The v5 API only returns pin *text* — for a board that's almost all imagery it
reads as nearly empty. This drives a real Chrome window instead: zoom to 50%,
screenshot, scroll a bit less than a screen, repeat to the bottom.

## Setup (once)

```sh
cd apps/pinterest-capture
npm install
```

Uses your installed Google Chrome (`channel: "chrome"`) — no browser download.

## Run

```sh
npm start -- <board-url> [outDir]
# e.g.
npm start -- https://pinterest.com/sylphisus/-_/
```

A Chrome window opens, scrolls itself to the bottom, and saves
`shot-001.png`, `shot-002.png`, … to `shots/<board>-<timestamp>/` (then opens
that folder). Drag them into claude.ai.

- **Public boards** need no login.
- **Private / your own** boards: log in once in the window that opens — the
  session persists in `.chrome-profile/` for next time.

## Tuning (top of `capture.mjs`)

- `ZOOM` — lower packs more pins per shot (fewer images); higher = more detail.
- `SCROLL_FRACTION` — overlap between shots; lower is safer, more shots.
- `SETTLE_MS` — raise if images haven't loaded before a shot.

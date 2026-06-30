# x-capture

Scroll-captures a public X/Twitter profile into a sequence of viewport-sized
screenshots for a Constello by-hand reading.

Raw text (the `constello-x` gallery-dl path) flattens a feed into bare lines and
throws away everything a timeline *is* — images, quote-tweets, video thumbnails,
the look of how someone posts. That archive still runs; this captures the surface
the **reading** is drawn from.

**No stitching.** Each screenshot is one viewport. Claude downscales any image past
~1.15 MP / 1568px long-edge before reading, so a single legible viewport survives
that resize while a tall megascroll or a side-by-side strip would be downscaled into
mush. The defaults favor legibility over density — there's context-window headroom to
spare, so we'd rather have more legible tiles than fewer crammed ones.

## Run

```sh
node capture-box.mjs <handle|url> [outDir]
```

`<handle|url>` accepts `@name`, `name`, or any `x.com`/`twitter.com` URL. The last
stdout line is `OUTDIR=<path>` so a wrapper (the hermes `constello-x` skill) can pick
up where shots landed and deliver them.

## Login

X gates logged-out timelines, so the persisted Chrome profile must be logged in.
Seed `PROFILE_DIR` (default `.chrome-profile/`) once by running headed and logging
in, or copy a seeded profile up to the box. This is the main recurring maintenance
item — when captures come back empty or hit a login wall, re-seed the profile.

## Knobs

All env-tunable (expect one calibration pass per box): `ZOOM`, `SCROLL_FRACTION`,
`SETTLE_MS`, `MAX_SHOTS`, `VIEWPORT_WIDTH`, `VIEWPORT_HEIGHT`, `DEVICE_SCALE_FACTOR`,
`HEADLESS`, `CHROME_CHANNEL`/`CHROME_PATH`, `PROFILE_DIR`. See the header of
`capture-box.mjs`.

Delivery (zip + Telegram `sendDocument`, uncompressed) is a separate step in the
hermes `constello-x` skill — same path as `pinterest-capture`.

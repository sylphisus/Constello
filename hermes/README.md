# Constello on the hermes box

Run the Twitter and Pinterest captures **remotely**, on the always-on box where the
[hermes agent](https://github.com/NousResearch/hermes-agent) lives, instead of from
the laptop. The laptop paths are untouched and still work — this is additive.

## What's here

```
hermes/
├── setup-on-box.sh                     # install deps + link the skills on the box
└── skills/constello/                   # → symlinked into ~/.hermes/skills/constello
    ├── constello-x/                    # /constello-x <handle>  — scrape X → push to Constello
    │   ├── SKILL.md
    │   └── scripts/pull.sh
    └── constello-pinterest/            # /constello-pinterest <url> — capture board → deliver shots
        ├── SKILL.md
        └── scripts/{capture-and-deliver.sh, deliver-telegram.sh}
```

The Pinterest capture itself is the new Linux entry `apps/pinterest-capture/capture-box.mjs`
(sibling to the macOS `capture.mjs`, which is unchanged).

## The two pipelines

**Twitter** ports cleanly — `constello-x` is already a headless CLI that scrapes via
gallery-dl and POSTs straight into Constello (`/api/admin/ingest-twitter`). On the box
it runs identically; the skill is just a wrapper. The one recurring chore is refreshing
the X session cookie when it expires.

**Pinterest** is screenshots-for-a-hand-read, so two things differ from Twitter:
- It drives a real browser. On the box that runs under **Xvfb** (a virtual display) by
  default; `HEADLESS=new` skips the display entirely if you prefer.
- There's **no ingest bridge** — the product is PNGs a human reads. So the skill
  **delivers them to Telegram as a document** (`sendDocument`, never `sendPhoto`, so
  Telegram doesn't JPEG-compress/downscale them — that compression would gut the board
  legibility the read needs). Upgrade path: screenshots → R2 → a Constello image entry,
  reusing the images collection. Deferred for now.

## Deploy

1. Get the code on the box:
   - `git clone` this repo (gives you `apps/pinterest-capture` + `hermes/`).
   - `rsync` the **twitter-preservation** repo up (it's local-only and holds the X
     cookie — keep it out of git).
2. `CONSTELLO_TWITTER_DIR=~/twitter-preservation bash hermes/setup-on-box.sh`
3. Do the manual follow-ups the script prints (secrets + one-time logins).
4. Talk to hermes: `/constello-x <handle>` and `/constello-pinterest <board-url>`.
   (Or schedule either via hermes cron.)

## Environment

| Var | Used by | What |
| --- | --- | --- |
| `CONSTELLO_TWITTER_DIR` | constello-x | path to the twitter-preservation repo on the box |
| `CONSTELLO_ADMIN_PASSWORD` | constello-x | matches Vercel `ADMIN_PASSWORD` |
| `CONSTELLO_PINTEREST_DIR` | constello-pinterest | path to `apps/pinterest-capture` |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | constello-pinterest | where shots are delivered |
| `ZOOM`, `VIEWPORT_WIDTH/HEIGHT`, `DEVICE_SCALE_FACTOR`, `HEADLESS`, `XVFB_RES` | capture-box.mjs | framing knobs — expect one calibration pass on a new box |

## Not done yet (needs the box)

- Actual install + secret/cookie/profile seeding (you'll SSH me in).
- One framing-calibration pass for Pinterest on the box's display.
- Confirm `TELEGRAM_CHAT_ID` and that hermes' own bot token is reused (vs. a separate one).

---
name: constello-x
description: Pull a public X/Twitter account into Constello as a constellation entry. Use when asked to scrape, capture, pull, import, or "read" someone's Twitter/X (a handle like @name) into Constello or for a Constello reading.
version: 0.1.0
platforms: [linux, macos]
metadata:
  hermes:
    tags: [constello, twitter, x, scrape]
    category: constello
    requires_toolsets: [terminal]
---

# Pull an X/Twitter handle into Constello

Scrapes a public X/Twitter account (newest posts + profile) on this box and pushes
it into Constello as one entry. This is the same `constello-x` bridge that runs on
the laptop — moved onto the always-on box. Constello then holds the entry; the
hand-read happens later in claude.ai.

## When to use
- "pull @handle into constello" / "scrape twitter for @name" / "import @x's account"
- Optionally attaching to an existing constellation (`--constellation-id <id>`).

## Procedure
1. Run the wrapper with the bare handle (no leading `@` needed):
   ```sh
   scripts/pull.sh <handle> [constellation-id]
   ```
   It cd's into the `twitter-preservation` repo and runs `uv run constello-x`, which
   scrapes via gallery-dl (using the X session cookie that lives in that repo's
   `.context/`) and POSTs the normalized data to the Constello admin ingest route.
2. Report the `constellationId` and `entryId` from the JSON it prints.

## Required environment
- `CONSTELLO_TWITTER_DIR` — path to the `twitter-preservation` repo on this box.
- `CONSTELLO_ADMIN_PASSWORD` — must match Vercel's `ADMIN_PASSWORD` (the bridge reads it).

## Pitfalls
- **Expired X cookie** → empty timeline or a 401 from X. Refresh `.context/x-cookies.txt`
  in the `twitter-preservation` repo (re-export from a logged-in browser). This is the
  main recurring maintenance item on a server.
- **Wrong host** → the bridge already targets `www.constello.xyz` directly; don't point
  it at the apex (it 308-redirects and drops Basic auth).
- **Placeholder password** → if `CONSTELLO_ADMIN_PASSWORD` still contains the `…`
  placeholder the bridge errors out early with a clear message; set the real one.

## Verification
Success prints `Pushed. Constellation: <id> · entry: <id>`. A non-zero exit means the
scrape or push failed — surface the stderr.

# Constello — Credentials & Inputs Checklist

> Everything that must come from you (account, key, file, decision) for the build to proceed. Organized by *when* it blocks. Mark items done as we go.

Companion to `BUILD_PLAN.md`. Decision numbers (D1, D2, …) and milestone numbers (1.1, 2.1, …) refer to that doc.

---

## A. Before any code lands (Phase 1 prerequisites)

These unblock milestones 1.1–1.6.

### Accounts to create

- [ ] **GitHub repo** for the monorepo. Public or private — your call. Name it whatever you like; the spec uses `constello/`.
- [ ] **Postgres host account** — pick one (D1):
  - [x] Supabase (recommended; bundles Storage) — **chosen 2026-05-30. Only thumbnails stored; full pins fetched-then-discarded at read time.**
  - [ ] Neon
- [ ] **Vercel account** (for deployment later; can wait until something is deployable, but free to set up now). Link your GitHub.
- [ ] **Anthropic API key**. Needed early for the design-token page if it makes any model calls, but more importantly for Phase 2.
- [ ] **Voyage AI API key** (embeddings). Needed at 2.1.
- [ ] **Domain name** — only needed at Phase 5 for public Explore, but worth claiming early. Brand name still TBD per philosophy doc ("Constello is a placeholder"); a temporary subdomain on Vercel works for the prototype.

### Decisions blocking Phase 1

- [x] **D1** Postgres host: **Supabase** (2026-05-30).
- [x] **D10** Font choice: **Fraunces (serif) + Inter Tight (sans)** — working default; specimen to confirm at 1.5.
- [x] **D9** WebGL approach: **three.js + d3-force** (2026-05-30).

### Aesthetic confirmations needed at 1.5–1.6

These don't block the start of Phase 1, but the spec is intentionally loose on them ("`#0a0e1a` or similar"), so I'll need your sign-off after a first sketch:

- [ ] Background color (proposed: `#0a0e1a`)
- [ ] Foreground cream (proposed: `#f4f1e8`)
- [ ] Accent palette — the spec says "color in the constellation comes from the stars themselves, drawn from the underlying readings." Need to decide *how* a reading maps to a star color (warm/cool spectrum from sentiment? hue per dominant register? deterministic hash for stability across visits?). I'd propose: per-Node hue derived from the dominant emotional register in the reading, with low saturation and warm bias to keep the Sky cohesive. Confirm direction after seeing first sketch.
- [ ] Motion grammar — twinkle frequency, parallax sensitivity, pan/zoom easing.

---

## B. Before Phase 2 (collection adapters)

These unblock milestones 2.1–2.4.

### Anthropic API setup

- [ ] **Model access verified** on your Anthropic account:
  - opus for everything.
- [ ] **Spending limit** decided. Phase 2 + 3 on Ethan's own collection is plausibly under $5; full first-cohort rollout (Phase 4) at ~100 users with side-by-side experiments could land in the ~$300–1,300 range (scales roughly linearly with cohort size). Set a guardrail.

### Pinterest

**Adapter + OAuth connect flow BUILT** (2026-06-26). Boards are a collection type: a "Connect Pinterest" tab on the homepage + add-piece flow starts the authorization-code flow at `GET /api/auth/pinterest`; the callback (`/api/auth/pinterest/callback`) trades the code for a token, pulls boards + sampled pins once via `apps/web/lib/collections/pinterest.ts`, formats them into one pending entry (`Pinterest · @user`, read by hand), and discards the token. Scopes: `user_accounts:read,boards:read,pins:read` (public only — secret boards skipped per `CONSTELLO_BUILD.md §6.1`). Public boards only; no token stored.

**Live + wired (2026-06-26):** App ID `1584975`. `PINTEREST_CLIENT_ID` + `PINTEREST_CLIENT_SECRET` set in Vercel (all 3 envs, encrypted); production redeployed. Verified live: the initiator 307-redirects to `pinterest.com/oauth` with the real client_id/scopes/state+cookie, and the callback completes state-verify → token-exchange (Pinterest itself now answers).

Remaining to pull real boards:
- [ ] **Exact redirect URI**: the canonical domain is **www** (apex 308s to www), so the live callback is `https://www.constello.xyz/api/auth/pinterest/callback` — register THAT exact string on the Pinterest app (plus `http://localhost:3000/...` for dev). A non-www registration will fail redirect_uri match.
- [ ] **Access tier (corrected)**: Pinterest has no "add testers" screen. A fresh app has **Trial access** — a sandbox for the *app owner's own account* to test (content created is creator-only-visible). To let the cohort connect their own Pinterest, **upgrade to Standard access**: developers.pinterest.com/apps → app card → **Upgrade** → confirm info → upload a video demo of the OAuth flow (a screen recording of the constello.xyz Connect → consent works) → submit; reviewed each business day. Redirect URIs / App ID+secret live under My apps → Manage → **Configure** tab.
- [ ] **Real connect** = click "Connect Pinterest" → log into Pinterest → grant → boards land as a pending `Pinterest · @user` entry. (Only public boards read.)
- [ ] **Rotate the client secret** — it was shared in chat; regenerate and re-set the Vercel env.

### Spotify

**Adapter + OAuth connect flow BUILT** (2026-06-27). A Spotify library is a collection type: a "Connect Spotify" tab on the homepage + add-piece flow starts the authorization-code flow at `GET /api/auth/spotify`; the callback (`/api/auth/spotify/callback`) trades the code for a token, pulls the library once via `apps/web/lib/collections/spotify.ts`, formats it into one pending entry (`Spotify · name`, read by hand), and discards the token. What's read (read-only scopes): long-term top artists + tracks, followed artists, saved albums, and playlists (own + followed) with a 20-track sample each. Bounded request count; no token stored. Same code shape as Pinterest.

Remaining to go live:
- [ ] **Register the app**: developer.spotify.com/dashboard → Create app → copy Client ID + Client secret.
- [ ] **Exact redirect URI**: canonical domain is **www**, so register `https://www.constello.xyz/api/auth/spotify/callback` (plus `http://localhost:3000/api/auth/spotify/callback` for dev) under the app's Redirect URIs. Must match exactly.
- [ ] **Env**: set `SPOTIFY_CLIENT_ID` + `SPOTIFY_CLIENT_SECRET` in Vercel (all 3 envs), then redeploy.
- [ ] **Access tier**: a new Spotify app starts in **Development mode** — only users manually added under Settings → User Management (up to 25, by email) can connect. Add each tester's Spotify email; request a quota extension for broader access later.
- [ ] **Real connect** = click "Connect Spotify" → log in → grant → library lands as a pending `Spotify · name` entry.

### Notion

**Adapter + OAuth connect flow BUILT** (2026-06-27). A Notion workspace's databases are a collection type: a "Connect Notion" tab on the homepage + add-piece flow starts the authorization-code flow at `GET /api/auth/notion`; the callback (`/api/auth/notion/callback`) trades the code for a token, pulls the granted databases once via `apps/web/lib/collections/notion.ts` (search → query rows → render each page's title + properties), formats them into one pending entry (`Notion · workspace`, read by hand), and discards the token. Notion's own consent screen is the picker — the person chooses exactly which databases the integration sees, so there's no scope string. Same code shape as Pinterest. No creds-free path exists (Notion has no public fetch), so this is blocked until the integration is registered.

Remaining to go live:
- [ ] **Register a public integration**: notion.so/my-integrations → New integration → type **Public** → copy the OAuth Client ID + Client secret.
- [ ] **Exact redirect URI**: canonical domain is **www**, so register `https://www.constello.xyz/api/auth/notion/callback` (plus `http://localhost:3000/api/auth/notion/callback` for dev) as a Redirect URI. Must match exactly.
- [ ] **Env**: set `NOTION_CLIENT_ID` + `NOTION_CLIENT_SECRET` in Vercel (all 3 envs), then redeploy.
- [ ] **Real connect** = click "Connect Notion" → log in → pick databases to share → they land as a pending `Notion · workspace` entry.

### Google Docs

**Adapter + Picker flow BUILT** (2026-06-27). A Google Doc is a collection type that reads in the same register as general text: a "Google Docs" tab on the homepage + add-piece flow runs Google Identity Services + the Google Picker client-side (`apps/web/components/GoogleDocsButton.tsx`) — the person connects, picks one doc, and the browser gets a short-lived access token. `POST /api/collections/google-docs` exports that doc's plain text once via `apps/web/lib/collections/google-docs.ts` and formats it into one pending entry (`Google Doc · title`, read by hand). Token is used once, not stored. Scope: `drive.readonly` (kept simple; least-privilege upgrade is `drive.file` + Picker `setAppId`, later).

Remaining to go live:
- [ ] **Google Cloud project**: console.cloud.google.com → create a project → enable the **Google Drive API** and the **Google Picker API**.
- [ ] **OAuth client + API key**: create an OAuth 2.0 **Web application** client (copy the Client ID) and an **API key** (for the Picker). Configure the OAuth consent screen (External; add testers while unverified — `drive.readonly` is a restricted scope, so broad public use needs verification, but <100 test users is fine unverified).
- [ ] **Authorized JavaScript origins**: add `https://www.constello.xyz` and `http://localhost:3000` (the Picker runs client-side; no redirect URI needed for the token flow).
- [ ] **Env (public — these ship to the browser)**: set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` + `NEXT_PUBLIC_GOOGLE_API_KEY` in Vercel (all 3 envs), then redeploy. Until set, the tab shows "Google Docs isn't configured yet."
- [ ] **Real connect** = click "Connect Google Docs" → grant → pick a doc → it lands as a pending `Google Doc · title` entry.

### Obsidian

- [x] **No account, key, or registration needed** — a vault has no API. The "Obsidian" tab (`apps/web/components/ObsidianButton.tsx`) uses a folder picker (`webkitdirectory`) to read the vault's `.md` notes in the browser and POSTs them to `/api/collections/obsidian`, which formats the notes **and the `[[wikilink]]` graph between them** into one pending entry (`Obsidian · vaultName`, read by hand). Ships now; only the notes the person imports leave their machine. Just bring a vault folder for the first real run.

### Images (general image collection)

**BUILT 2026-06-28.** The only source whose material is *bytes*, not text: a person submits any set of images (≤10 at a time) via the "Images" tab, and the images themselves are the read. Bytes live in **Cloudflare R2** (`apps/web/lib/storage.ts`); Postgres only holds per-image metadata (`entry_images`) + a `needs_reread` flag on `entries`. The owner gets an editor on their constellation page (add/remove images), and any change **queues a re-read** — the entry re-surfaces in the admin pending queue with its thumbnails rendered, while the prior reading stays visible until the new one is pasted in. Image collections carry no global identity, so they're exempt from dedupe (each is its own world, like `text`).

Why R2: S3-compatible, **zero egress fees**, built-in CDN, no scaling cliff. Everything is behind a `storage_path` + `imageUrl()` helper, so a later move to another S3-compatible store (e.g. Backblaze B2) is a bucket copy + env swap, not a rewrite.

Remaining to go live:
- [ ] **Run the migration**: `apps/web/db/migration.images.sql` in the Supabase SQL editor (adds `entry_images` + `entries.needs_reread`). Safe to re-run.
- [ ] **Create the R2 bucket**: Cloudflare dashboard → R2 → Create bucket (e.g. `constello-images`). Then **enable public access** — either attach a custom domain (e.g. `images.constello.xyz`) or turn on the bucket's `r2.dev` dev URL — and copy that base URL.
- [ ] **Create an R2 API token**: R2 → Manage R2 API Tokens → Create (Object Read & Write, scoped to the bucket). Copy the Access Key ID + Secret Access Key, and note the Account ID.
- [ ] **(Recommended) set a per-bucket file size limit** of ~10 MB so a stray huge upload can't blow through quota (matches the app's 10 MB/image cap).
- [ ] **Env**: set in Vercel (all 3 envs), then redeploy:
  - `R2_ACCOUNT_ID` — Cloudflare account id
  - `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` — the API token pair
  - `R2_BUCKET` — the bucket name (e.g. `constello-images`)
  - `R2_PUBLIC_BASE` — the bucket's public URL base, **no trailing slash** (custom domain or `r2.dev` URL)
  - Until all are set, the Images tab returns "Image storage is not configured."
- [ ] **Real run** = open a constellation → "Images" tab → pick images → they upload to R2 and land as a pending `Images` entry; the admin queue shows the thumbnails to drag into claude.ai.

### Last.fm

- [x] **Last.fm API key** — created 2026-06-23, set as `LASTFM_API_KEY` in Vercel (all 3 envs; encrypted). Adapter (`apps/web/lib/collections/lastfm.ts`) verified end-to-end against live data. No OAuth — public scrobbles via the username API.
- [x] **Ethan's Last.fm username** — `yuneekae` (confirmed working).

### X / Twitter

- [x] **Fetch source decided: local bridge** (2026-06-24). X has no free API and live in-app scraping would mean a personal session cookie in prod (ToS-risky, expires, rate-limited, won't scale). For the hand-fulfilled alpha, scraping stays *off-platform*: the `twitter-preservation` tool (gallery-dl + a local session cookie in `.context/`) captures a handle, and `constello-x` pushes the normalized `TwitterData` to the new admin route `POST /api/admin/ingest-twitter` (Basic-auth), which reuses `formatTwitter` + `createEntry`. The deployed app never scrapes and holds no cookie. The in-app `fetchTwitter` stub stays unwired — it's the future swap point for an official source if Constello opens up.
- [ ] `**CONSTELLO_ADMIN_PASSWORD*`* available locally where the scraper runs (matches Vercel's `ADMIN_PASSWORD`), so `constello-x` can authenticate to the ingest route.
- [ ] **Ethan's handle** for the first real run.

### Claude memory

- [ ] **Ethan's Claude memory export**. I'll inspect the current export format before building the parser (D7).

### Stickers / gifs

- [ ] **Telegram sticker pack screenshots** from Ethan. Flow: open each pack you want included in the Telegram drawer, screenshot the grid, upload. **Methodology revised 2026-05-27 from export-format parsing to per-pack screenshot per Ethan's directive.** Same path supports Discord favorites, iMessage drawer, Tenor/Giphy — just screenshots of the relevant view. No `.tgs` or TDLib export to wrestle with.
- [ ] **Decide which non-Telegram surfaces to include.** All supported via the same screenshot upload now; pick which ones you'll personally screenshot. Telegram is the floor.

### General text

- [ ] **No account or key needed** — uses the Haiku model already listed above. Just bring a few of your own texts for the first real run (§6.5 / milestone 2.5): something genuinely accumulated, and ideally one authored creative piece (a song, character writing) so we can confirm the reading treats authored material as prime signal rather than penalizing it.

### Notifications ("your reading is ready")

Built 2026-06-26 (branch `alpha-manual-readings`). Four channels, all best-effort + env-gated (a missing key skips that channel, never breaks a save), fired from the admin reading/essence save. Private channels (email, iMessage) carry the constellation link (a bearer URL); public channels (X, Discord) never can. Schema: `contacts` + `notifications` tables in `migration.alpha.sql` (**re-run the migration** — the `contacts.channel` check now includes `'discord'`). Opt-in: email + X handle + Discord username from the constellation page (`NotifyMe`); iMessage via the inbound "text us first" webhook only.

- [ ] `**APP_URL`** — base for notification links (defaults to `https://constello.xyz` if unset). Set in Vercel. Use the **www** form (`https://www.constello.xyz`) since the apex 308s to www.
- [ ] **Email — Resend**: create a [Resend](https://resend.com) account, verify a sending domain, then set `**RESEND_API_KEY`** + `**RESEND_FROM**` (e.g. `Constello <readings@constello.xyz>`). Free tier ~3k/mo. This is the channel that needs no device-side setup, reaches every iPhone, and scales to the full cohort with zero per-user work — the load-bearing channel.
- [ ] **iMessage — self-hosted BlueBubbles** (replaced Photon 2026-06-26; `spectrum-ts` removed): run [BlueBubbles](https://bluebubbles.app) on an always-on Mac signed into iMessage, exposed via a `cloudflared` tunnel. Set `**BLUEBUBBLES_SERVER_URL`**, `**BLUEBUBBLES_PASSWORD**` (outbound REST), and a `**BLUEBUBBLES_WEBHOOK_SECRET**` you choose. Register the BlueBubbles webhook (new-message events) at `POST /api/inbound/imessage?secret=<BLUEBUBBLES_WEBHOOK_SECRET>` (the query secret is how we auth it — BlueBubbles doesn't sign webhooks). Set `**IMESSAGE_NUMBER**` (the Mac's iMessage number in E.164) — the page's "Text us" button deep-links to it (`sms:` with the constellation tag prefilled); the iMessage tab only appears when it's set. **Reply-only by design**: an iMessage contact is created *only* by the inbound webhook (the public `/api/contact` no longer accepts the channel), so every send is a reply in an existing thread, never a cold blast → keeps the Apple ID off the spam heuristics. ⚠️ Confirm the live BlueBubbles new-message payload fields (`data.text`, `data.handle.address`, `data.isFromMe`) against a real event — coded to the documented shape but unverified. ⚠️ Automating a personal iMessage account is grey-area (Apple ToS); reply-only lowers flagging risk but the always-on Mac + tunnel is on you to keep up.
- [x] **X / Twitter — fully manual, no API/token/cost** (2026-06-27). X killed the free tier; pay-per-use is now ~$0.015/post and OAuth2 user-context tokens expire every 2h — not worth it for the lowest-value channel (a public mention can't carry the link anyway). So there is **no `X_USER_TOKEN` and no auto-post**. Handles are still captured (the X tab → `twitter` contact, `verified=false`) and surfaced in the admin console under **"X handles to notify"**: each row gives a link to the person's profile + to @03constello (check the follow), a uniform paste-ready knock (`@handle your constellation has been read.`), and a **Mark posted** button (sets `verified=true` to drop it off the list). Ethan posts the knock from @03constello by hand. Keeps X off-platform, in line with the project's stance.
- [ ] **Discord — public @mention in a mutual server**: create a Discord application + bot, enable the **Server Members** privileged intent, and invite the bot to the mutual server with **Send Messages**. Set `**DISCORD_BOT_TOKEN`**, `**DISCORD_GUILD_ID**` (the mutual server), `**DISCORD_CHANNEL_ID**` (where pings post). Opt-in: the person types their Discord username on the constellation page; `/api/contact` resolves it to a snowflake id via the guild member search (we store the **id**, not the username) and marks the contact `verified` iff they're a member — **server membership is the consent gate** (mirrors the X follow-gate). The notification is a public `<@id>` mention — the **knock only, never the link** (a channel is visible to its members). REST-only, no gateway, runs on Vercel functions. The Discord tab only appears when all three env vars are set.
- [ ] **Discord — conversational channel (talk to Opus about your matches)** (built 2026-06-27): users `@mention` the bot or reply to it; the bot's reply is Ethan's, fulfilled by hand. Conversational by design — slash commands lose the project's essence. **Run the new migration** `apps/web/db/migration.discord-chat.sql` (adds `discord_messages` + the `nearest_servermates()` pgvector RPC that ranks server members by reading-embedding similarity). Because Discord only delivers message content over a gateway websocket (which Vercel serverless can't hold), a small always-on **listener** (`apps/bot/`, the only persistent piece — runs on the Ubuntu box) holds the socket and forwards @mentions/replies to `POST /api/inbound/discord?secret=<DISCORD_INBOUND_SECRET>`. Setup: enable the **Message Content Intent** on the bot (privileged, free under 100 servers); set a new `**DISCORD_INBOUND_SECRET**` you choose (same value in Vercel env *and* `apps/bot/.env`); reuses the existing `DISCORD_BOT_TOKEN`. Flow: inbound question → admin **"Conversations"** section shows it with the asker's world + nearest server-mates (similarity scores) + a copy-ready context bundle → Ethan pastes into claude.ai → pastes Opus's reply back → **Send** posts it as a native Discord reply. Unlinked askers (no constellation) are **auto-onboarded**: the bot replies with a link to start one (and the message stays out of the inbox), so Ethan only sees answerable questions. See `apps/bot/README.md`.

---

## C. Before Phase 3 (synthesis + pairwise)

### Guiding examples for reading depth (Ethan to write up in vault)

- [ ] **Cross-surface resonance examples** that calibrate every reading prompt in the pipeline toward the fundamental rather than the surface. Examples like:
  - Jeff Buckley + hyperpop, both carrying a fundamental romantic loneliness
  - Visual-novel piano instrumentals + Minecraft soundtrack, both expressing an inherent value for quiet beauty
  - (and 3–5 more across heterogeneous registers — Pinterest, memory, stickers, especially cross-collection-type pairings — when you write them up)

These are the calibration target. Music tends to be the most tractable; the harder cross-collection-type examples (an aesthetic register on Pinterest resonating with a thinking pattern in someone's Claude memory) are the most load-bearing because they're the ones that justify the whole architecture.

Without these examples, prompt iteration drifts toward easier surface descriptions and the pipeline quietly fails at the thing Constello is actually for. This is the most important input you provide to the build that isn't a credential.

Per Ethan: "I'll have to come up with some really solid guiding examples for you, put that in some to-do list in the vault" (2026-05-27).

### Decisions blocking Phase 3

- [ ] **D4** Synthesis model: start with Sonnet 4.6; the side-by-side against Opus 4.7 is milestone 3.2. Confirm Opus 4.7 access on your Anthropic account if you want the side-by-side; skip if not.
- [ ] **Synthesis prompt iteration**: the spec gives the skeleton at `CONSTELLO_BUILD.md §7`. I'll run the first version against Ethan's nodes, send you the output, and iterate. The synthesis is the load-bearing artifact — expect 3–8 rounds of prompt iteration before it reads true. Budget time for this; it's where the product gets made.

---

## D. Before Phase 4 (first cohort)

### People

- [ ] **First cohort of ~100 testers** identified. They need to be people whose constellations would actually be interesting to read — friends with rich Pinterest/Last.fm/memory/sticker presences. The cohort is the bootstrap; this is the cold-start solve, so picking it carefully matters.
- [ ] **Tester onboarding plan**: how do you invite them? Email, DM, Telegram. Each tester needs to know they're testing, that there's no public visibility yet, and that the visibility model (matches see raw material) applies between them.
- [ ] **Their data**: testers will run their own onboarding, but they need access to their own Pinterest / Last.fm / Claude memory / Telegram stickers. Some may not use all four. Minimum-one-collection per spec; partial constellations are fine.

### Privacy posture

- [ ] **Privacy policy** — even for a closed beta, you should have something stating: what's stored, who can see what, how synthesis works, model providers used (Anthropic, Voyage), data deletion process. A one-page document is enough.
- [ ] **Terms** — same, brief. Especially the "we read your collections with an LLM" bit, since that's the unusual part.
- [ ] **Data deletion flow** — at minimum, a manual process where you can wipe a user's data on request. Doesn't need to be a UI button for the prototype.

---

## E. Before Phase 5 (public Explore opens)

- [ ] **Density judgment call** (`CONSTELLO_BUILD.md §13` Phase 5): you decide when the Sky has enough real constellations to feel like a sky. Heuristic is 20–30 distinct, well-read essences. Final call is yours.
- [ ] **Domain pointed at Vercel.**
- [ ] **D11** Visitor pairwise behavior on Explore: I'd recommend **synthesis-solo** for non-authed visitors (no fake "guest" essence). Confirm.
- [ ] **"Claim a star" CTA copy** — small bit of language that matters because it's the threshold. Write it together when we get there.
- [ ] **Production secrets** — same keys as dev, but separate. Set them in Vercel env vars.

---

## F. Ongoing — not blocking but worth tracking

- [ ] **Naming.** "Constello is a placeholder. The real name comes later." (Philosophy doc, architectural-deepening open threads.) Domain decision interacts with this.
- [ ] **Acquisition refusal posture.** Philosophy/architectural-deepening flags "pre-committed refusal of acquisition, publicly" as a defense. Not a build artifact, but worth pinning a stake in the ground before there's enough surface to be acquired.
- [ ] **Story / manhwa / anime arm.** Out of prototype scope. Holding it in awareness because the visual identity feeds into it.

---

## Quick "give me this list as a single message" version

If you want to paste a procurement list into a notes app and run it down:

**Accounts**: GitHub repo, Supabase (or Neon), Vercel, Anthropic API, Voyage AI API, Pinterest Developer App, Last.fm API, domain name.

**Decisions early**: Postgres host (D1), fonts (D10), WebGL approach (D9), background/foreground/accent palette, star-color mapping.

**Decisions before adapters**: Anthropic spend cap, Pinterest scope, Last.fm clustering (D5), Pinterest sampling (D6), Claude memory format (D7), Telegram export format (D8).

**Data from you**: Ethan's Pinterest account, Last.fm username, Claude memory export, Telegram sticker export. Eventually: ~100 invited testers and their data.

**Before public**: privacy policy, terms, density judgment call, visitor pairwise behavior (D11), CTA copy.
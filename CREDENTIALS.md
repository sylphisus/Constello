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
- [ ] **Spending limit** decided. Phase 2 + 3 on Ethan's own collection is plausibly under $5; full first-cohort rollout (Phase 4) at ~15 users with side-by-side experiments could land in the $50–200 range. Set a guardrail.

### Pinterest

**Adapter + OAuth connect flow BUILT** (2026-06-26). Boards are a collection type: a "Connect Pinterest" tab on the homepage + add-piece flow starts the authorization-code flow at `GET /api/auth/pinterest`; the callback (`/api/auth/pinterest/callback`) trades the code for a token, pulls boards + sampled pins once via `apps/web/lib/collections/pinterest.ts`, formats them into one pending entry (`Pinterest · @user`, read by hand), and discards the token. Scopes: `user_accounts:read,boards:read,pins:read` (public only — secret boards skipped per `CONSTELLO_BUILD.md §6.1`). Public boards only; no token stored.

**Live + wired (2026-06-26):** App ID `1584975`. `PINTEREST_CLIENT_ID` + `PINTEREST_CLIENT_SECRET` set in Vercel (all 3 envs, encrypted); production redeployed. Verified live: the initiator 307-redirects to `pinterest.com/oauth` with the real client_id/scopes/state+cookie, and the callback completes state-verify → token-exchange (Pinterest itself now answers).

Remaining to pull real boards:
- [ ] **Exact redirect URI**: the canonical domain is **www** (apex 308s to www), so the live callback is `https://www.constello.xyz/api/auth/pinterest/callback` — register THAT exact string on the Pinterest app (plus `http://localhost:3000/...` for dev). A non-www registration will fail redirect_uri match.
- [ ] **Trial mode**: a fresh Pinterest app only lets the app owner + added test users authorize. The first connect must be Ethan's own (owner) account; add testers in the app dashboard for the cohort. App review opens it to everyone.
- [ ] **Real connect** = click "Connect Pinterest" → log into Pinterest → grant → boards land as a pending `Pinterest · @user` entry. (Only public boards read.)
- [ ] **Rotate the client secret** — it was shared in chat; regenerate and re-set the Vercel env.

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

Built 2026-06-26 (branch `alpha-manual-readings`). Three channels, all best-effort + env-gated (a missing key skips that channel, never breaks a save), fired from the admin reading/essence save. Private channels carry the constellation link (a bearer URL); a public mention never can. Schema: `contacts` + `notifications` tables in `migration.alpha.sql` (**re-run the migration**). Opt-in: email from the constellation page (`NotifyMe`), X handle auto-captured from the X tab, iMessage via the inbound "text us first" webhook.

- [ ] `**APP_URL`** — base for notification links (defaults to `https://constello.xyz` if unset). Set in Vercel.
- [ ] **Email — Resend**: create a [Resend](https://resend.com) account, verify a sending domain, then set `**RESEND_API_KEY`** + `**RESEND_FROM**` (e.g. `Constello <readings@constello.xyz>`). Free tier ~3k/mo. This is the one channel that needs no device-side setup and reaches every iPhone.
- [ ] **iMessage — Photon** (`spectrum-ts`, installed): create a [Photon](https://photon.codes) project + a managed iMessage line, then set `**PHOTON_PROJECT_ID`**, `**PHOTON_PROJECT_SECRET**` (outbound) and `**PHOTON_WEBHOOK_SECRET**` (inbound HMAC). Register the webhook at `POST /api/inbound/imessage`. ⚠️ Confirm the real webhook header + payload field names against a live Spectrum request — the handler reads them defensively but they're unverified. ⚠️ Managed iMessage is grey-area (Macs running Messages); reliability/ToS is a bet. Heavy dep (147 pkgs), loaded only via dynamic import when the keys are set.
- [ ] **X / Twitter — public mention, follow-gated**: set `**X_USER_TOKEN`** (OAuth2 user-context token with `tweet.write` + `users.read`). The notification is a public `@handle` mention from @constello — the **knock only, never the bearer link** (a public tweet is visible to all; follow-gating doesn't change that). Only fires once the handle is **verified** as a follower of @constello (the `verified` flag on the contact). Verifying is **manual for the alpha** — the X follows-lookup is gated on low API tiers; flip `verified` by hand (or wire an automated check if the tier supports it). ⚠️ Reintroduces an X credential in prod, which the project otherwise keeps off-platform (the bridge above) — a deliberate reversal to weigh.

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

- [ ] **First cohort of 5–15 testers** identified. They need to be people whose constellations would actually be interesting to read — friends with rich Pinterest/Last.fm/memory/sticker presences. The cohort is the bootstrap; this is the cold-start solve, so picking it carefully matters.
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

**Data from you**: Ethan's Pinterest account, Last.fm username, Claude memory export, Telegram sticker export. Eventually: 5–15 invited testers and their data.

**Before public**: privacy policy, terms, density judgment call, visitor pairwise behavior (D11), CTA copy.
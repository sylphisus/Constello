# Constello — Build Plan

> Plan only. No code yet. Reads against `CONSTELLO_PHILOSOPHY.md` (authoritative) and `CONSTELLO_BUILD.md` (executable spec). Where this plan diverges from either, the divergence is flagged explicitly in §6.

---

## 0. How to read this doc

- **§1** restates the spec in its tightest form, so we can confirm we share the same target before any code lands.
- **§2** lays out the build sequence as concrete milestones, each with a *verifiable* success criterion (per the project CLAUDE.md §4). Phases follow `CONSTELLO_BUILD.md §13` but break each phase into checkable steps.
- **§3** lists every decision that needs to be made for the build to proceed, mapped to *when* it has to be answered.
- **§4** flags risks where the spec could pull two ways, or where I'd push back.
- **§5** specifies what "minimum viable Phase 1" looks like — the first thing I would build, if you said "go" with no further qualification.
- **§6** lists where this plan deliberately departs from the spec (currently nothing material, but the section exists so divergences get logged rather than smuggled).

`CREDENTIALS.md` is the companion procurement list — accounts, keys, data, and aesthetic choices needed to unblock specific milestones.

---

## 1. The spec in tightest form

Constello is built around four load-bearing artifacts, ordered by criticality per `CONSTELLO_BUILD.md §0`:

1. **The synthesis pipeline.** Per constellation: extract nodes from each collection, read each node (Haiku), embed each reading (Voyage), then compile a 2,000–4,000 token literary portrait that draws across all of them (Sonnet, possibly Opus). Quotes raw material. No categorization. Caches by collection fingerprint.

2. **The first-iteration UI.** Observatory aesthetic. Off-black background, warm cream foreground, serif for names and proper nouns, sans for body. WebGL constellation rendering. Screenshot-coherent: a single image of a constellation must be recognizably Constello and aesthetically striking on its own, because it has a downstream job in cultural propagation (philosophy §11).

3. **Five collection adapters with extraction.** Pinterest (boards via OAuth, one node per board), Last.fm (username + cluster, 4–8 clusters), Claude memory (file upload + theme extraction, 5–12 themes, PII filtered), stickers/gifs (Telegram-first + generic file upload fallback, vision-captioned, clustered into 2–6 clusters), general text (paste or text-file upload, one Node per submission, reading calibrated to name performed self-description — the catch-all for accumulated text with no dedicated adapter).

4. **The pairwise read pipeline.** On-demand. Two syntheses + both node lists go in. Out comes JSON: a small list of resonance threads (each anchored to a Node id from each side) and a walkthrough addressed to the viewer. Cached per (A, B), invalidated by synthesis fingerprint change.

Surrounding these:

- **Onboarding** is sequential, never a single multi-field form. Chosen name → Pinterest → Last.fm → Claude memory → stickers → forming → `/me`.
- **Auth** is stubbed for the prototype: a cookie + chosen name in DB. Clerk later.
- **Sky** is the matchmaker surface. ANN over synthesis embeddings, ranked by pairwise resonance for the few surfaced, on-demand pairwise reads when clicked.
- **Visibility** is the privacy primitive. Non-matched users see Node readings + synthesis prose. Matches see raw material from collections the owner has marked visible. "Match" in the prototype = mutual algorithmic surfacing.
- **The cosmetic layer** is not built but is *architected for* — keep presentation off the Constellation row.
- **No fakes.** No seeded constellations. No hand-authored stars. Public Explore stays gated until the real cohort gives the Sky enough density to feel like a sky.

Out of scope for the prototype: real auth, stargazing/love, trace mechanic, tokens, cosmetic monetization layer, federation, story/manhwa/anime cultural arm.

---

## 2. Build sequence with verifiable milestones

Phasing follows `CONSTELLO_BUILD.md §13`. Each milestone has a success criterion you can check.

### Phase 1 — Foundation

| # | Milestone | Verify by |
|---|---|---|
| 1.1 | Monorepo scaffolding: `apps/web` (Next.js 15 + React 19 + TS), `packages/{collections/core,db,synthesis,pairwise,matchmaker,collections/{pinterest,lastfm,claude-memory,stickers}}`. pnpm + turborepo (or just pnpm workspaces if turbo feels heavy). | `pnpm build` succeeds; `pnpm dev` starts the web app on localhost. |
| 1.2 | DB schema + migrations: `Constellation`, `Collection`, `Node`, `Synthesis`, `PairwiseRead`, plus `UserPresentation` (cosmetic-layer placeholder per philosophy §12) and `MatchEdge` (cached mutual-surfacing relation). pgvector extension installed. | Migration runs clean against a fresh Postgres; `SELECT * FROM constellation` returns empty set. |
| 1.3 | `packages/collections/core`: shared types (`Constellation`, `Collection`, `Node`, `Synthesis`, `PairwiseRead`, `ResonanceThread`, `CollectionSource`, `CollectionAdapter<TRaw, TConfig>`). | Types compile; downstream packages can import them. |
| 1.4 | Stub auth: cookie-based session, `chosen_name` field on a `User` row (or directly on Constellation if we prefer no separate User table for prototype). Sign-in is "pick a name, get a cookie." | `GET /me` returns the chosen name after login; logout clears the cookie. |
| 1.5 | Design tokens + type pairing live in `apps/web` (Tailwind config + a `tokens.ts` module): background, foreground cream, accent palette, serif (decision pending — see CREDENTIALS), sans, spacing scale, motion scale. | A `/_design` route renders a swatch + type-specimen page that looks like Constello, not a generic Next.js starter. |
| 1.6 | First WebGL Sky sketch against **synthetic** test data. ~30 fake "constellations" each with 10–20 fake nodes. Force-directed within each, ANN-similarity-ish positioning across. Twinkling, parallax pan/zoom. | Open `/_sky-test`. Single screenshot at default zoom is recognizably Constello and survives the "would this convince a stranger" test. Synthetic data clearly labeled in code; never persisted to real DB. |

**Phase 1 exit criterion:** the design vocabulary is concrete enough that future implementation work can ask "does this honor the aesthetic?" against a built artifact rather than a paragraph.

### Phase 2 — Collection adapters

Order: Last.fm → Pinterest → Claude memory → Stickers → General text. Last.fm first because it's the simplest (no OAuth, no vision, no PII pass). General text last because it reuses the text-ingestion and reading patterns the Claude-memory adapter establishes, minus the theme extraction.

| # | Milestone | Verify by |
|---|---|---|
| 2.1 | Last.fm adapter: `connect(username)`, `sync()`, `extractNodes()`. Clustering strategy decided (see open Q in §3). Reading prompt (Haiku) live. Voyage embedding of each reading. | Run against a real Last.fm username (Ethan's). Produces 4–8 cluster nodes, each with 200–500 token reading. Reading is qualitatively good ("describes the feeling," not "they like X"). |
| 2.2 | Pinterest adapter: OAuth flow, board fetch, pin sample (recency-weighted random, decision pending), Claude vision pass for image captions, reading prompt per board. Skip secret boards. | Run against Ethan's Pinterest. Produces one node per visible board. Sampled pins are recent. Image captions sound like a perceptive friend, not a tagger. |
| 2.3 | Claude memory adapter: file upload (accept the formats Claude actually exports — to be verified, see §3), theme extraction pass, reading per theme. | Run against Ethan's Claude memory export. 5–12 theme nodes. Each reading reads as a perceptive friend, not a topic summary. |
| 2.4 | Sticker adapter: per-pack screenshot upload, single Sonnet vision pass over all uploaded screenshots in one call, one Node per pack. | Run against Ethan's Telegram packs (one screenshot per pack). Produces one Node per uploaded pack screenshot, each reading the pack's collective register. |
| 2.5 | General text adapter: paste or text-file (`.txt`/`.md`) upload, multiple submissions with optional per-submission label, one Node per submission, reading prompt (Haiku) calibrated to read performed self-description as performance and name it (§6.5). | Run against a few of Ethan's texts — including one genuinely accumulated piece and one deliberately performed self-description. The accumulated piece reads for what he carries; the performed one is named as reaching-for-the-reader rather than absorbed as fact. |

**Phase 2 exit criterion:** Ethan's own constellation has all five adapters' nodes populated. Each Node reading reads like the spec wants — perceptive, specific, no categorization.

### Phase 3 — Synthesis + pairwise pipelines

| # | Milestone | Verify by |
|---|---|---|
| 3.1 | Synthesis pipeline: accepts all of a constellation's node readings + their raw material (PII-filtered for memory, photo-people rule for stickers), runs the synthesis prompt against Sonnet 4.6, stores text + embedding + `collectionFingerprint`. Fingerprint hashes node readings + raw material payload. | Synthesis runs against Ethan's nodes. Output reads as literary prose, 2,000–4,000 tokens, quotes raw material where the specific earns its place, names tensions, doesn't categorize. |
| 3.2 | Sonnet 4.6 vs Opus 4.7 side-by-side. Same constellation, both models, blind A/B read. | Decision logged with rationale. Default model set in `packages/synthesis/config`. |
| 3.3 | Pairwise read pipeline: takes two syntheses + both node lists, runs the pairwise prompt against the chosen synthesis model, returns `{threads, walkthrough}` JSON. Cached per (aId, bId) keyed by both fingerprints. | Two real constellations (Ethan's + one tester's, once 4.1 lands) produce a pairwise read. Threads reference real Node ids on both sides. Walkthrough is paragraph-per-thread, addressed in second person. |
| 3.4 | Fingerprint-based invalidation: changing a collection regenerates the affected nodes, the synthesis, and lazily invalidates all pairwise reads involving that constellation. | Disconnect Ethan's Pinterest → synthesis recomputes, all (Ethan, *) pairwise reads invalidate, next view recomputes them. |

**Phase 3 exit criterion:** the load-bearing artifact (synthesis) is producing real, literary, specific portraits, and pairwise reads against another real synthesis pass the "would you show this to the person it's about" test.

### Phase 4 — Onboarding wired end-to-end + first cohort

| # | Milestone | Verify by |
|---|---|---|
| 4.1 | Onboarding routes (`/onboarding/{name,pinterest,lastfm,claude-memory,stickers,forming}`) wired end-to-end against real adapters. Visibility toggle per collection. Skip permitted per step, minimum-one-collection enforced before `/onboarding/forming`. | Ethan re-runs onboarding from a fresh account. Each step is its own page. `/onboarding/forming` runs the real extraction → synthesis pipeline and drops into `/me`. |
| 4.2 | `/me`: three layers (nodes graph, per-collection drawer with visibility toggle + disconnect, synthesis prose). | Ethan views his own constellation. Tapping any node opens its full reading. Toggling visibility persists. |
| 4.3 | `/sky` (authed): ANN candidates + pairwise ranking. Few results per visit. No infinite scroll. | Sky surfaces 3 candidates for Ethan from the testers' cohort once it exists. None are shown by popularity. |
| 4.4 | `/constellation/[chosenName]`: side-by-side rendering, red strings from pairwise threads, walkthrough panel, hover-thread-highlights-string interaction. Match-gated raw-material access (per §10) — Node readings always visible; raw material only if mutually surfaced AND collection is marked visible. | Two test users view each other. Walkthrough renders. Red strings highlight on hover. Match-vs-non-match raw-material gating verified. |
| 4.5 | Invite 5–15 testers. Each runs the real onboarding flow against their own data. | Real cohort exists. `/sky` returns real candidates. No seeded constellations in DB. |
| 4.6 | `/` (public Explore) **stays gated**. Holding page or redirect to onboarding. | Visiting `/` while not signed in does not show the Sky. |

**Phase 4 exit criterion:** the prototype works for a real cohort of real people. Ethan plus a small invited group can encounter each other's actual constellations.

### Phase 5 — Public Explore opens

| # | Milestone | Verify by |
|---|---|---|
| 5.1 | Density gate met: ~20–30 real constellations with distinct, well-read essences. Final call is Ethan's. | Visual review of the Sky. |
| 5.2 | `/` opens publicly. Visitors can pan/zoom, tap any constellation (no auth required). Tapping shows the synthesis prose; pairwise reads require sign-up. | A logged-out visitor lands on `/`, browses, can read syntheses; clicking "claim a star" routes into onboarding. |
| 5.3 | Visitor pairwise-read fallback decision (see §3 open Q): either compute a read against a generic "guest" essence, or show synthesis solo to non-authed visitors. | Decision logged. Implemented. |

**Phase 5 exit criterion:** Constello is something a stranger could land on and feel pulled into.

---

## 3. Decisions still needed

Each row says *when* the decision blocks. Anything not blocking a current milestone can stay open.

| # | Decision | Blocks | Default if you say "you pick" |
|---|---|---|---|
| D1 | Postgres host: Supabase vs Neon. | 1.2 | **Supabase** — bundles Storage and gives us a single account for DB + object storage. |
| D2 | Object storage: Supabase Storage vs S3. | 2.2 (Pinterest images) | **Supabase Storage**, since D1 likely picks Supabase. |
| D3 | Embedding model: Voyage `voyage-3-large` vs `voyage-4-large`. | 2.1 (first Voyage call) | **voyage-3-large** to start, switch later if a benchmark earns it. |
| D4 | Synthesis model: Sonnet 4.6 (default) vs Opus 4.7 (per `CONSTELLO_BUILD.md §14.6`). | 3.2 (must be done before tester cohort sees output) | **Sonnet 4.6** to start; run the side-by-side as a Phase 3 milestone. |
| D5 | Last.fm "cluster" formation: how the listening history gets split into Nodes. **Revised 2026-05-27 from k-means default to single LLM pass per Ethan's correction.** | 2.1 | **Single Sonnet pass over the Last.fm data; model identifies 4–8 natural pockets and writes each pocket's reading in one call. No k-means.** Distance metrics don't perceive — the eligibility-test doc puts category-finding at the reading layer, and the same logic applies inside a single collection. Same pattern likely generalizes to sticker pocketing and to memory-theme extraction. |
| D6 | Pinterest pin sampling: recency-weighted random vs random vs image-cluster diversity. | 2.2 | **Recency-weighted random**, up to ~30 pins per board for the vision pass. Matches spec recommendation. |
| D7 | Claude memory export format: which formats to parse? | 2.3 (need to verify what Claude actually exports today) | I'll inspect the current Claude memory export format before building; if multiple formats exist, support JSON first, markdown second. |
| D8 | Telegram sticker handling. **Revised 2026-05-27 from export-format parsing to per-pack screenshot upload per Ethan's directive.** | 2.4 | **User screenshots each Telegram sticker pack's grid and uploads them; single Sonnet vision pass handles the rest. No `.tgs` parsing, no TDLib JSON, no per-sticker captioning.** Same path supports iMessage, Discord favorites, Tenor/Giphy. Rationale: per-sticker meaning is sparse; the pack's collective shape is what carries the signal. |
| D9 | Custom WebGL graph approach: `three.js` vs `regl` vs minimal raw WebGL. | 1.6 | **three.js with `Points` + custom shaders for stars; force-directed layout via `d3-force` on the CPU side**. Lower commitment than regl, plenty fast at this scale. |
| D10 | Font choice: Fraunces, Spectral, or Cormorant (serif) + Inter Tight (sans) — or alternatives. | 1.5 | I'll prototype with **Fraunces + Inter Tight** and show you a specimen page; final call is yours. |
| D11 | Visitor pairwise-read behavior on Explore: "guest" essence vs synthesis-solo. | 5.3 | **Synthesis-solo** for non-authed visitors. Computing a pairwise read against a fictional guest violates "no synthetic stars" in spirit. |
| D12 | Sky ranking: pure pairwise-resonance ranking (spec) vs embedding-similarity-only with on-demand pairwise on click (cost-aware alt). See §4 risk R1. | 4.3 | **Hybrid: ANN top-30 by synthesis embedding, then rank top 10 by pairwise; surface 3**. Compromises between spec and cost. Flag for your call. |
| D13 | Naming for the chosen-name field at the DB level. The spec uses `chosenName`. Worth using the same term in DB column (`chosen_name`)? | 1.2 | **Yes**, mirror the vocabulary all the way down. |
| D14 | What does "match" persist as? A `MatchEdge` row computed at view time vs computed at synthesis change vs purely derived on read. | 3.4 / 4.4 | **Cached `MatchEdge` row**, written when computed at view time, invalidated by synthesis change. Avoids recomputing on every gate check. |

---

## 4. Risks and pushback

### R1 — The matchmaker section can't quite be what it says it is

`CONSTELLO_BUILD.md §11` says: "ANN top K=30, then for each candidate compute or retrieve pairwise read with A, rank by pairwise resonance strength, surface ~3." This implies computing 30 pairwise reads on every Sky load, which at Sonnet 4.6 pricing is ~$0.30+ per visit. At a small cohort it's fine; the principle leaks badly when the cohort grows.

The spec also says pairwise reads are "on demand" elsewhere. These are in tension. Proposed reconciliation (D12 above): rank by **synthesis embedding similarity** for surfacing — that's what ANN is for — and compute the actual pairwise read only when the viewer clicks into a candidate. Sky still feels personalized because position in Sky encodes the embedding distance; the "red strings" experience is reserved for the actual encounter, which makes it weightier.

This is a real philosophical question, not just a cost one. If pairwise resonance is the ranking signal, the Sky becomes "the system's read of who would resonate with you most." If embedding similarity is the ranking signal, the Sky becomes "people whose essence shape is near yours," with the pairwise read happening at meeting. The second is more honest about what's computed when, and it lines up better with philosophy §7 ("compute concentrates at meeting moments, not at idle browsing"). I'd argue for the second. Flagging for your call.

### R2 — Node count could exceed the "10–25 typical" range

Pinterest is "one node per board." Some users have 50+ boards. Last.fm gives 4–8 clusters, memory 5–12 themes, stickers 2–6 clusters. A heavy Pinterest user could land at 40–70 nodes before the others. The visual rendering and the synthesis prompt both assume something closer to 10–25.

Options: (a) cap Pinterest at top-N boards by recency/pin-count weight; (b) cluster boards into "board clusters" if a user has many; (c) let it run and see how the rendering and prompt actually scale. I'd start with (c) for the prototype and add a cap if it becomes a problem with real data. Flagging so we don't lose track.

### R3 — Synthesis prompt size

The spec wants raw material attached to each Node reading in the synthesis prompt. With 4 collections, ~20 nodes, and meaningful raw material per node, the synthesis input is plausibly 50–150K tokens. Sonnet 4.6 handles this; Opus 4.7's tokenizer can inflate by up to ~35%, pushing toward limits and 6×+ cost. The side-by-side in 3.2 should measure both quality and total cost, not just quality.

### R4 — Voyage embeddings as single point of failure

Voyage is MongoDB-owned now. The build doc notes the API still operates. For a prototype that's fine, but worth knowing: if Voyage ever changes terms or shuts off, we'd need to re-embed everything against a different model. Mitigation: keep the embedding call behind a thin adapter so swapping is local.

### R5 — "Performance detection" lives in prompts, not pipelines

The eligibility test doc is explicit: performance vs sincerity is read at the artifact level by the model, not gated at adapter selection. The reading prompts in each adapter need to be written to make this work — they should be permitted to note performance where they see it, downweight aspirational signals against revealed-preference signals, etc. The current skeleton prompts in `CONSTELLO_BUILD.md §6` don't quite say this out loud. I'd want to enrich them slightly when building each adapter, while keeping them close to the spec's voice. Will surface drafts in PRs for your read.

### R6 — Visual identity timeline

Phase 1 builds the visual identity against synthetic data. Phase 4 onward shows it to a real cohort. If the visual identity isn't *right* at Phase 4 — recognizable, screenshot-coherent, observatory — we're showing testers something the philosophy says is load-bearing for cultural propagation. I'd want a checkpoint at end of Phase 1 where we look at the Sky sketch and the constellation-render sketch together and ask: would I screenshot this and send it to someone? If the answer's no, we iterate before adding adapters.

### R7 — Readings must reach for the fundamental, not the surface

> *"Their existence in essence is akin to mine, a kin to mine. They could lead any life, even if they were a fucking sherpa in the Appalachians, it doesn't matter who we are down here, at this lower level, we would always still recognize each other."* — `Constello — Architectural Deepening`

The skeleton reading prompts in `CONSTELLO_BUILD.md §6` and the surface-perceptual language I initially used to describe them ("the warmth of acoustic music played quiet") are calibrated too high — they describe the *material* rather than what the person *carries* that makes them gather it. That is a real miss against the philosophy. The product is for recognition at the level where Jeff Buckley and hyperpop both carry a fundamental romantic loneliness, where visual-novel piano and Minecraft soundtrack both express an inherent value for quiet beauty — surface-different artifacts gathered for the same underlying reason. The strongest resonances cross surfaces by definition.

If the Node readings and synthesis stay at the surface, the pairwise read collapses to "adjacent material matches adjacent material." It becomes a fancier last.fm recommender. The architectural-deepening doc's claim that "two people who collected wildly different things for the same underlying reason would never match in a tag system" is exactly the failure mode Constello has to *not* repeat — and surface readings would have us repeat it with LLMs instead of tags.

**What this changes through the pipeline:**

- **Every reading prompt** (Node-level extractors, synthesis, pairwise) gets amended toward the fundamental layer when the adapter is built. The prompt must push the model past surface description into *what this person carries that makes them gather these particular things.*
- **The synthesis prompt** already says "no categorization" and "describe don't classify," which is the right direction but not strong enough. It needs to explicitly orient toward the underlying register — the structure of feeling, value, longing, posture — that organizes a person's collections.
- **The pairwise prompt** already says "resonance is shape, not subject" and rewards cross-surface resonance. That stays. What it depends on is the upstream readings carrying enough depth that there's actual shape to read against. Otherwise it has nothing to work with.
- **Drafts go to you before each adapter ships,** calibrated against the guiding examples you'll write up in the vault (see `CREDENTIALS.md §C`).

The risk if we get this wrong: the prototype runs end-to-end, produces output that *looks* plausibly literary, and quietly fails to do the one thing Constello is actually for. This is the most important calibration in the build.

---

## 5. Smallest viable Phase 1, if you say "start"

If you tell me to begin without further qualification, this is what I'd build first, in this order:

1. `apps/web` Next.js 15 scaffold with Tailwind and the design-token module (D10 default fonts). A `/_design` route showing the type specimen and the palette swatches so we can adjust before going further. *No other routes yet.*
2. `packages/db` with the schema from `CONSTELLO_BUILD.md §5`. Local Postgres via Docker for dev. Migration tooling (`drizzle-kit` or `prisma migrate`).
3. `packages/collections/core` with the types.
4. Stub auth.
5. `/_sky-test` route: WebGL Sky against synthetic data (~30 fake constellations). This is the first real visual deliverable — the thing we look at together to decide whether the aesthetic is right.
6. **Stop and check with you** before starting Phase 2.

The thing I want to avoid: building 60% of the plumbing before you've seen what the visual looks like. The visual is load-bearing and gets a checkpoint.

---

## 6. Where this plan diverges from the spec

- **Last.fm Node formation** (logged 2026-05-27) — the spec offers k-means in embedding space as one option for forming Last.fm clusters (`CONSTELLO_BUILD.md §6.2`). This plan instead defaults to a single LLM pass that identifies pockets and writes their readings in one call. Reason: the eligibility-test doc places category-finding at the *reading* layer, not at adapter selection, and the same logic applies inside a single collection. Distance metrics don't perceive; the model does. Logged in response to Ethan's pushback.
- **Reading depth calibration** (logged 2026-05-27, applied same day) — the spec's skeleton reading prompts have been amended in `CONSTELLO_BUILD.md §6.1–6.4` toward the fundamental-over-surface direction described in §4 R7 and `CONSTELLO_PHILOSOPHY.md §4` third principle. Each prompt now distinguishes the *material* (pins / tracks / recurring topic / stickers) from what the person *carries* that made them gather it, and asks the model to read for the latter. Reason: without depth at the reading layer, the pairwise read collapses to "adjacent material" matching, which the philosophy doc's "resonance is shape, not subject" and the architectural-deepening doc's sherpa line explicitly reject. Logged in response to Ethan's correction.
- **Sticker ingestion + Node formation** (logged 2026-05-27; further revised the same day after Ethan's second directive) — the spec originally specified Telegram export parsing (`.tgs` files / TDLib JSON, per-sticker vision captioning, embedding-space clustering across all stickers into 2–6 pockets). Now: **per-pack screenshot upload, single Sonnet vision pass over all screenshots in one call, one Node per pack.** Two reasons. (1) Stickers aren't dense in meaning per-sticker; the collective shape of each pack is the signal, and a screenshot of the grid carries it (Ethan, 2026-05-27). (2) The pack is the user's intentional grouping — the act of adding a pack to the drawer is the signal — so one-Node-per-pack mirrors Pinterest's one-Node-per-board rather than re-pocketing the user's own grouping. Drops the per-sticker captioning, the embedding-space clustering, the export-format parsing, and the animated-frame sampling — all in one move. Pinterest stays one-Node-per-board for the same reason; Claude memory was already LLM-based, no methodology change there.
- **General text collection added** (logged 2026-05-28) — a fifth collection adapter, not in the original spec's four. Accepts any pasted text or text file — gathered *or* authored (journals, saved passages, essays, notes, songs, character writing, poetry); one Node per submission; the catch-all for accumulated text no dedicated adapter covers. Two framing decisions were made with Ethan. (1) Accept any text but frame onboarding toward *kept/written* text rather than an about-me box, and calibrate the reading to detect and *name* performed self-description rather than absorb it as fact — honoring the inversion at the reading layer, not via a gate, consistent with "accepts any artifact, lets the reading do the filtering" and the no-defensive-gate stance of `CONSTELLO_PHILOSOPHY.md §4`/the performance atom. (2) One Node per submission — the act of including a particular text is the signal, mirroring one-Node-per-board, *not* theme-split like Claude memory. **Correction (2026-05-28):** the first cut of this entry justified the framing partly on "it's the first collection where the person may *author* the material." Ethan rejected that — authorship is orthogonal to what matters. You can author collections (songs, character names and dynamics, poems, low-follower posting), and authored material is often the *richest* signal, not riskier. The real axis is composed-*for-an-audience* vs. sincere, which cuts across authorship in both directions and is already the philosophy's stance (§4, §5). Submitting your own writing is composing-by-selection with the model authoring the reading — that *is* the inversion working, not a violation. The only genuine tension is the input affordance: a free-text box can *invite* a written-for-the-reader self-description, which is why the onboarding framing (not authorship) is the thing being steered. The accumulation criterion (eligibility atom) is the other real constraint and is handled the same way — by framing toward accumulated text and letting the reading filter. Reflected in `CONSTELLO_BUILD.md §6.5` and the eligibility atom. Not defensive infrastructure; it's a product surface, so it ships with the prototype.
- **Defensive infrastructure deferred for the alpha** (logged 2026-05-27) — the spec originally specified PII filtering for Claude memory (`CONSTELLO_BUILD.md §10`, §6.3, §7), photographic-people rules for stickers (§6.4), and the synthesis-must-never-include-PII rule. All deferred. Per Ethan: *"you can just disable all the PII stuff for now, cart before the horse. Stop planning for problems before we even have anything made, I want to get the algorithm right first."* The alpha is for validating whether the algorithm reads true; defensive infrastructure gets designed once we know what actually matters. Core product behavior (visibility model, chosen names, pairwise read privacy, per-collection visibility toggle) stays — it's not defensive, it's how the product works.

---

## 7. What this plan does not cover

- The **story / manhwa / anime arm** (philosophy §11). Out of prototype scope per `CONSTELLO_BUILD.md §0`, but worth holding as context because every visual choice contributes to a future shared symbol.
- **Token vehicle, federation, real auth, stargazing, trace mechanic.** Explicitly deferred.
- **Production scaling.** The prototype is for ≤100 constellations. Anything above that needs revisiting matchmaker, caching, and the synthesis cost story.
- **Acquisition defenses** (architectural-deepening threat model). The mitigations there — federation, open protocol, published embedding methodology — are right but post-prototype.

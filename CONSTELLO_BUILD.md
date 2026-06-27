# Constello — Build

> Executable spec for the first prototype. Assumes `CONSTELLO_PHILOSOPHY.md` has been read first. When this doc and the philosophy doc disagree, the philosophy wins and this doc is wrong.

---

## 0. For the agent

You are building the first prototype of Constello. The scope of this prototype is fixed and listed in §1. The philosophy doc constrains *what* you build; this doc tells you *how*.

If implementation forces a decision the philosophy doesn't cover, stop and flag it rather than guessing.

Load-bearing artifacts, in order of criticality (build order is §13):
1. **The synthesis pipeline** — one essence synthesis per constellation, the load-bearing artifact (philosophy §6). Everything else reads against this.
2. **First-iteration user interface** — the visual and interaction language of Constello. Load-bearing because the visual identity feeds the cultural propagation arm (philosophy §11) downstream.
3. **Five collection-type adapters with extraction** — Last.fm, Pinterest, Claude memory, gif/sticker library, general text.
4. **The pairwise read pipeline** — on-demand resonance reading between two constellations (philosophy §7).

Out of scope for this prototype: real auth (stub it), production matchmaker at scale, stargazing/love mechanics, trace mechanic, token vehicle, cosmetic monetization layer, federation, the cultural arm itself (story/anime).

---

## 1. Prototype scope

| Feature | In prototype? | Notes |
|---|---|---|
| First-iteration UI | ✅ | Sky view, constellation view, pairwise read view, onboarding |
| Pinterest collection adapter | ✅ | OAuth + board extraction |
| Last.fm collection adapter | ✅ | Username-based + listening cluster extraction |
| Claude memory collection adapter | ✅ | File upload + theme extraction |
| Gif/sticker collection adapter | ✅ | See §6 — multiple sources, new category |
| General text collection adapter | ✅ | See §6.5 — paste or attach any text; one Node per submission. The catch-all for accumulated text with no dedicated adapter |
| Synthesis pipeline | ✅ | Node-level + constellation-level |
| Pairwise read pipeline | ✅ | On-demand, cached per pair |
| Auth (Clerk etc) | ⚠️ Stub | Mock auth that just stores a chosen name + session; replace later |
| Sky (minimum viable matchmaker) | ✅ | ANN + pairwise-ranked, over the real cohort. No seeded/fake constellations. Public Explore gates on density. See §11 + §13. |
| Stargazing / love | ❌ | Defer |
| Trace mechanic | ❌ | Unresolved (philosophy §14.5) |
| Token / monetization | ❌ | Out of scope |

---

## 2. Vocabulary (use these terms, in code and UI)

| Term | Meaning |
|---|---|
| **Constellation** | A person, as represented in the system. Always the whole. Never "user profile" in UI. |
| **Collection** | An imported data source: Pinterest boards, Last.fm scrobbles, Claude memory, gif/sticker library, general text. |
| **Node** | A single synthesized point inside a constellation. One per board, one per Last.fm cluster, one per Claude memory theme, one per gif/sticker cluster. |
| **Synthesis** | The 2,000–4,000 token essence writeup compiled from all collections. |
| **Pairwise read** | On-demand LLM analysis of how two constellations resonate. Produces red strings + walkthrough. |
| **Sky** | The discovery surface. Where constellations are encountered. |
| **Chosen name** | The user's Constello name. Not their real name. |

Forbidden words in UI: *feed, post, share, like, friend, match, swipe, profile, follow count, public.*

---

## 3. Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js 15 (App Router) + React 19, TypeScript | Server components for Sky rendering |
| Graph viz | Custom WebGL via `three.js` (or `regl` if simpler) | Don't use a generic graph library; the visualization is the product |
| Styling | Tailwind + custom design tokens; serif (e.g. Fraunces or Spectral) for proper nouns + names, sans (e.g. Inter Tight) for everything else | Observatory aesthetic, not social-app |
| Auth | Stub for prototype; Clerk later | A "session cookie + chosen name in DB" is enough for prototype |
| Database | Postgres via Supabase or Neon | |
| Vector store | pgvector | Migrate later if needed |
| LLM | Anthropic API — Sonnet 4.6 for syntheses and pairwise reads, Haiku 4.5 for node-level extractors | Opus 4.7 is a candidate for the synthesis call if a side-by-side shows meaningfully more literary output; see §14.6 |
| Vision | Claude vision (Sonnet 4.6) for Pinterest images and gif/sticker frames | |
| Embeddings | Voyage `voyage-3-large` (or `voyage-4-large` if benchmarking favors it at build time) | MongoDB owns Voyage now; API still operates. See §14.7 |
| Object storage | Supabase Storage or S3 | Pinterest images, sticker uploads, memory file uploads |
| Deployment | Vercel + Supabase/Neon | |

---

## 4. Repository layout

```
constello/
├── apps/
│   └── web/
│       ├── app/
│       │   ├── (explore)/                  # public Sky, no auth required
│       │   │   └── page.tsx
│       │   ├── (constello)/                # authed routes
│       │   │   ├── sky/
│       │   │   ├── constellation/[chosenName]/   # viewing another constellation triggers pairwise read
│       │   │   └── me/                     # viewing your own constellation
│       │   ├── onboarding/
│       │   │   ├── name/
│       │   │   ├── pinterest/
│       │   │   ├── lastfm/
│       │   │   ├── claude-memory/
│       │   │   ├── stickers/
│       │   │   └── text/
│       │   └── api/
│       │       ├── collections/
│       │       ├── synthesis/
│       │       └── pairwise/
│       └── components/
│           ├── sky/                        # WebGL Sky view
│           ├── constellation/              # WebGL per-constellation rendering
│           ├── reading/                    # synthesis + pairwise read display
│           ├── onboarding/
│           └── ui/                         # tokens, base components
├── packages/
│   ├── collections/
│   │   ├── core/                           # shared types: Constellation, Collection, Node, Synthesis
│   │   ├── pinterest/
│   │   ├── lastfm/
│   │   ├── claude-memory/
│   │   ├── stickers/
│   │   └── text/                           # general text catch-all (§6.5)
│   ├── synthesis/                          # synthesis pipeline (node-level + constellation-level)
│   ├── pairwise/                           # pairwise read engine
│   ├── matchmaker/                         # candidate retrieval + ranking for Sky
│   └── db/                                 # schema, migrations
└── CONSTELLO_PHILOSOPHY.md
└── CONSTELLO_BUILD.md
```

---

## 5. Data model

```ts
// packages/collections/core/types.ts

type CollectionSource = 'pinterest' | 'lastfm' | 'claude-memory' | 'stickers' | 'text' | string;

interface Constellation {
  id: string;
  chosenName: string;            // user-chosen, not real name; unique across Constello
  createdAt: Date;
}

interface Collection {
  id: string;
  constellationId: string;
  source: CollectionSource;
  connectedAt: Date;
  lastSyncedAt: Date | null;
  visible: boolean;              // default true. If false, hidden from matches; still feeds the synthesis. Owner toggles in onboarding and afterward.
  rawData: unknown;              // source-specific JSON blob. Server-side only for Explore visitors and non-matched users. Visible to matches if `visible` is true.
}

/**
 * A Node is one synthesized reading of one unit within a collection.
 *  - Pinterest: one Node per board
 *  - Last.fm: one Node per coherent listening cluster (4–8 clusters typical)
 *  - Claude memory: one Node per recurring theme (5–12 themes typical)
 *  - Stickers: one Node per coherent sticker cluster (e.g. "tender/affectionate",
 *    "absurdist/internet-native", "deadpan reaction" — 2–6 typical)
 *  - Text: one Node per submitted text (each paste or file the person chose to
 *    include is itself the unit — analogous to one-Node-per-board)
 */
interface Node {
  id: string;
  constellationId: string;
  collectionId: string;
  source: CollectionSource;
  title: string;                 // e.g. "the board called 'rooms I would think in'"
  reading: string;               // 200–500 token LLM reading
  embedding: number[];           // voyage-3 of the reading
  weight: number;                // 0–1; prominence within the constellation
  rawRef: unknown;               // pointer back to source material (URLs, file refs)
  createdAt: Date;
}

interface Synthesis {
  constellationId: string;
  text: string;                  // 2,000–4,000 tokens of literary prose
  embedding: number[];           // synthesis-level embedding for Sky retrieval
  nodeIds: string[];
  compiledAt: Date;
  collectionFingerprint: string; // hash of collection states; invalidates synthesis
}

interface PairwiseRead {
  aId: string;
  bId: string;
  threads: ResonanceThread[];    // the "red strings"
  walkthrough: string;           // LLM prose addressed to A about B
  computedAt: Date;
  aSynthesisFingerprint: string;
  bSynthesisFingerprint: string;
}

interface ResonanceThread {
  aNodeId: string;
  bNodeId: string;
  strength: number;              // 0–1
  note: string;                  // 1–2 sentences naming the connection
}
```

---

## 6. Collection adapter contract

A note on what counts as a collection (see [[design philosophy/Collection types — current and eligibility test]] for the full version): the prototype ships with five adapters (the fifth, §6.5, is a general-text catch-all), but the architecture should treat any submitted artifact as a potential collection and let the *reading* determine whether it contributes meaningful signal. Performance detection happens in the node-reading prompts (§7), not in adapter selection. Future adapters for Twitter, Instagram, Spotify, etc. should plug in without philosophical gatekeeping.

**Calibration target for every reading prompt below:** push past the *material* (pins, tracks, recurring topic, stickers) to what the person *carries* that makes them gather it. Per `CONSTELLO_PHILOSOPHY.md §4` third principle and [[design philosophy/§ Not the material — what the person carries that makes them gather it]]. Surface-perceptual description still describes the material; the reading has to go to the register of feeling, value, longing, or posture underneath. Without this depth, the synthesis and pairwise read collapse to adjacent-material matching.

```ts
interface CollectionAdapter<TRaw, TConfig> {
  source: CollectionSource;
  connect(config: TConfig): Promise<{ rawData: TRaw }>;
  sync(collection: Collection): Promise<{ rawData: TRaw }>;
  extractNodes(rawData: TRaw, constellationId: string, collectionId: string): Promise<Node[]>;
}
```

### 6.1 Pinterest

- OAuth via Pinterest's developer API
- Unit is the **board**, not the pin
- One Node per board
- Reading inputs: board title, board description, sample of pins (titles, descriptions, image captions via Claude vision)
- Reading prompt skeleton (adapt as you implement):
  > Read this Pinterest board as a perceptive friend. The pins are the material; what you're reading for is what this person carries that made them gather *these particular things* together. The board's aesthetic similarity is the surface — push to the register of feeling, value, or longing the gathering expresses. Name tensions that run through the board rather than smoothing them. Quote a specific pin only when the specific makes the reading truer. Avoid categorization. 200–500 tokens.
- Weight ≈ pin count × recency factor
- Skip secret boards by default; respect Pinterest privacy settings

### 6.2 Last.fm

- Username-based, optional OAuth for fuller data
- **Split listening history into 4–8 natural pockets via a single Sonnet pass over the data.** Model identifies the pockets and writes each pocket's reading in the same call. No k-means or embedding-space clustering — distance metrics don't perceive. See `BUILD_PLAN.md` D5 for rationale.
- One Node per pocket
- Reading inputs: top artists and tracks in pocket, descriptors, listening recency
- Reading prompt skeleton:
  > Read this listening pocket as a perceptive friend. The tracks are the material; what you're reading for is what this person carries that makes them return to *this particular music*. Sonic texture is evidence of what's underneath — the romantic loneliness, the want of quiet beauty, the posture toward feeling — not the reading itself. Name tensions in the pocket rather than smoothing them. Reference a specific artist or track when the specific makes the reading truer. Avoid "they like X." 200–500 tokens.
- Weight ≈ pocket play count / total plays

### 6.3 Claude memory

- File upload (JSON or markdown export of Claude memory)
- LLM pass extracts recurring themes (patterns of return, not topics)
- One Node per significant theme (5–12 per user)
- Reading inputs: relevant memory excerpts
- Reading prompt skeleton:
  > Read this theme as a perceptive friend. The recurring topic is the material; what you're reading for is what this person carries that made them keep returning to it — what they're working out, what they're reaching for, the value or longing that organizes their attention here. Name tensions in the theme rather than smoothing them. Quote a phrase from the excerpts when the specific makes the reading truer. 200–500 tokens.
- Weight ≈ frequency × recency

### 6.4 Stickers and gifs (new collection type)

The premise: people who use gifs and stickers build up a small private library of expressive units. The library reveals how a person reaches for feeling in conversation — what registers of humor, tenderness, irony, drama they have ready to hand. It's a different surface than the other three (relational rather than introspective), which is exactly why it adds resolution.

This is the new collection type Ethan introduced. Treat it with the same eligibility test as the others (philosophy §2): private utility, not audience-facing.

**Sources to support, in order of priority:**

1. **Telegram sticker packs the user has added** — primary path for the prototype. Per-pack screenshot upload (see Extraction below).
2. **Discord favorited gifs / iMessage sticker drawer / Tenor or Giphy favorites** — same screenshot path; the user screenshots the favorites tab or relevant view and uploads it like a pack.

For the prototype, **Telegram is the primary target** and the other surfaces are supported through the same screenshot upload flow. No export-format parsing is required.

**Extraction:**
- Input: one screenshot per pack (or favorites tab) that the user wants included. The user opens each Telegram sticker pack in turn, screenshots the grid, and uploads. Sticker meaning is sparse per-sticker; the *collective shape* of each pack is what's load-bearing, and a single screenshot of the grid carries that.
- **Single Sonnet vision pass over all uploaded screenshots in one call.** The model sees the user's full sticker presence at once and writes one reading per pack in that context — letting it note things like "this person has three tender packs and one absurdist outlier" while still reading each pack on its own.
- **One Node per pack** — analogous to Pinterest's one-Node-per-board: the act of adding a pack to the drawer is itself the signal.
- Reading inputs: the pack's screenshot; lightweight metadata if available (pack name, whether it's the favorites tab, recency of addition).
- Reading prompt skeleton:
  > Read this Telegram sticker pack as a perceptive friend. The stickers are the material; what you're reading for is what this person carries that made them *add this pack and reach for it when they're with others*. The emotional register the pack lets them inhabit, how it helps them meet other people, what posture toward feeling they wanted ready to hand. Where the pack mixes registers, name the mix rather than resolving it. 200–500 tokens.
- Weight ≈ equal across packs for the prototype (refine later if Telegram exposes per-pack use signal).

**Why this collection is valuable:** unlike Pinterest (aspirational, can be performed) or Last.fm (introspective, slow accumulation), the sticker/gif collection is the only one that's *relational* — it captures how a person *meets others*, not how they sit with themselves. This adds resolution that the other three can't.

### 6.5 General text (the catch-all)

The premise: a lot of what a person carries lives in text that has no dedicated adapter — journal and diary archives, a years-long Notes-app dump, personal essays, a file of quotes or passages they've saved, exported writing, poetry they keep. This adapter is the catch-all. It accepts any pasted text or any text file and reads it, letting the *reading* decide what signal it carries — consistent with the architecture's stance that it "accepts any artifact and lets the reading do the filtering" (§6 head, and [[design philosophy/Collection types — current and eligibility test]]).

Authored text is welcome and is often the richest material a person has — the songs they write, the names and dynamics they invent for characters, poems, a diary, years of low-follower posting. Authoring is not a performance flag; if anything it carries *more* signal than gathering, because the selection and the construction are both the person. The axis that matters isn't who wrote the text, it's whether it was composed *for an audience* — reaching to be seen a certain way — and that's handled at the **reading layer, not by a gate**, exactly as the philosophy already handles it (`CONSTELLO_PHILOSOPHY.md §4`, §5, and [[design philosophy/§ Performance is detectable across collections, not within one]]). Submitting a text you wrote is still composing-by-selection with the model authoring the reading — that *is* the inversion working (`CONSTELLO_PHILOSOPHY.md §3`), not a violation of it. The only thing that would break the inversion is a box framed as *describe yourself*, where the person writes the catalogue essay and we absorb it as fact. So a performed self-description is read as performance and named — the way an aspirational Pinterest board is (§5) — but that's a property of the writing, not of the fact that they authored it.

**Framing to the user (decided 2026-05-28):** onboarding copy invites *text the person has accumulated or kept* — writing, journals, saved passages, notes — rather than "tell us about yourself." The mechanism accepts anything; the framing steers toward gathered text and the reading catches the rest. Do not build a bio/about-me field — that's the §13 non-goal this adapter must not become.

**Ingestion:**
- Input: one or more text submissions. Each is either pasted text or an uploaded text file (`.txt`, `.md`, and similar plain-text formats; no rich-doc parsing for the prototype).
- Optional short user-supplied label per submission (e.g. "morning pages", "things I've underlined"). If absent, the model generates a short title for the Node.
- A user can add several submissions; each is kept as a distinct piece in `rawData`.

**Extraction:**
- **One Node per submission** — each text the person chose to include is itself the unit, analogous to Pinterest's one-Node-per-board and the sticker pack. We do *not* theme-split a submission into multiple Nodes; the act of including this particular text is the signal (decided 2026-05-28).
- One reading prompt (Haiku 4.5) per submission → 200–500 token reading. Embed each reading (voyage-3-large).
- Reading inputs: the submission text (truncated/sampled if very long), the optional user label.
- Reading prompt skeleton:
  > Read this text as a perceptive friend. It's something this person kept, wrote, or gathered and chose to submit. The words are the material; what you're reading for is what this person carries that made them hold onto *this* — the register of feeling, value, longing, or posture underneath. If the text reads as a performed self-description — written for a reader, reaching for how they want to be seen — read that performance as itself a fact about them and name it, the way you'd read an aspirational Pinterest board; do not take its self-claims at face value. Name tensions rather than smoothing them. Quote a phrase when the specific makes the reading truer. Avoid "they are X." 200–500 tokens.
- Weight ≈ equal across submissions for the prototype (refine later if a length/recency signal proves meaningful).

**Why this collection is valuable:** it's the open door. The other four adapters each presuppose a platform and a gathering behavior; plenty of what a person carries doesn't fit any of them. The catch-all lets that material in without philosophical gatekeeping, and the reading does the work of telling sincere accumulation from performance.

---

## 7. The synthesis pipeline

```
Collections changed
       │
       ▼
Step 1: ensure all Nodes are up-to-date
   for each adapter: extract nodes from current raw data
   for each node: run reading prompt → 200–500 tokens (Haiku 4.5)
   embed each reading (voyage-3-large)
       │
       ▼
Step 2: compile the Synthesis (Sonnet 4.6, optionally Opus 4.7 — see §14.6)
   input: all node readings + weights + the underlying raw material
          each reading was drawn from (boards, scrobbles, memory excerpts,
          sticker captions). See "The synthesis prompt" below.
   output: 2,000–4,000 tokens of literary prose
       │
       ▼
Step 3: embed the synthesis (voyage-3-large)
   stored on Synthesis row + indexed in pgvector
```

### The synthesis prompt

The synthesis sees both the per-collection Node readings *and* the underlying raw material those readings were drawn from. The Node readings act as the model's prior pass through each collection — what each one is "about" in 200–500 tokens. The raw material is there so that when the synthesis wants to ground a claim in the specific texture of a person — a board title, a recurring artist, a phrase from their memory file, a sticker caption — the specific is in reach rather than abstracted away.

This is a deliberate choice for Constello. The whole thesis is that specificity is the thing; a pipeline that summarizes the raw away before the load-bearing artifact runs would cut the synthesis off from exactly what makes the reading good. Cost is higher and the synthesis prompt is larger, but this is the load-bearing artifact and is the wrong place to economize.

The synthesis is permitted — encouraged — to quote raw material when a specific reference is what the portrait wants. Track names, board titles, a phrase from a memory file, a sticker's caption. Use them when they earn their place. Do not pad with quotes.

```
You are writing an essence synthesis for Constello — a portrait of one
person, drawn across several analyses of their collections.

Below are:
- Perceptive readings of this person's individual collections, one per
  Node. Each was read on its own.
- The raw material each reading was drawn from (board contents, listening
  data, memory excerpts, sticker captions, etc.).

Your job is to write a single 2,000–4,000 token portrait that draws across
all of them. Use the readings as a guide to what's there; reach into the
raw material when a specific reference — an artist's name, a board title,
a recurring phrase, a particular image — would make the portrait truer
than an abstraction would.

Hard rules:
- Do not categorize. No types, no archetypes, no MBTI-shaped language.
- Do not flatter. Do not assess. Describe.
- Where the analyses or raw material point in different directions, name
  the tension rather than smoothing it out. Don't invent tensions that
  aren't there.
- Quote raw material when the specific reference is what the portrait
  wants. Don't pad with quotes. A specific that earns its place is worth
  ten generalizations.
- Avoid pure description. The synthesis should have a voice — the voice
  of someone who notices.
- No bullet points. No headers. Continuous prose, paragraphs.
- Use their chosen name sparingly. Decide between third-person referencing
  them by chosen name or second-person ("you") and hold it for the whole
  synthesis.

Node readings and raw material follow.

[NODE READINGS WITH ATTACHED RAW MATERIAL]
```

**On format of raw material in the prompt:** structure varies by adapter and is the adapter's responsibility. Pinterest passes board titles plus sampled pin descriptions and image captions. Last.fm passes top tracks/artists with play counts. Claude memory passes the excerpts the theme reading was drawn from. Stickers pass the pack screenshots. General text passes the submitted text (sampled if long). Each Node reading should be presented with the raw material that anchors it grouped immediately after it, so the synthesis can move between summary and source without having to hunt.

**Caching:** the synthesis is computed once per `collectionFingerprint` (now a hash of all Node readings *and* the raw material payload). Re-runs only when something changes upstream.

---

## 8. The pairwise read pipeline

```
A views B
   │
   ▼
cache hit on (A, B)? — invalidated if either synthesis fingerprint changed
   │
 ┌─┴─┐
yes  no
 │   │
 │   ▼
 │  compute pairwise read (Sonnet 4)
 │  input: both syntheses + both node lists
 │  output: JSON { threads, walkthrough }
 │   │
 │   ▼
 │  cache
 │   │
 └───┴──→ return
```

### Pairwise prompt skeleton

```
You are reading the resonance between two constellations on Constello.

Constellation A (chosen name: {A.name}) — synthesis:
[A.synthesis.text]

Constellation B (chosen name: {B.name}) — synthesis:
[B.synthesis.text]

A's nodes (id, title, one-line summary):
[A.nodes]

B's nodes (id, title, one-line summary):
[B.nodes]

Your job:
1. Identify the threads of genuine resonance between these two people.
   Aesthetic, sonic, cognitive, relational, or something stranger that
   emerges across registers. Don't force connections. Prefer 3–8 strong
   threads over 15 weak ones. If they don't resonate strongly, say so
   quietly.
2. For each thread, identify the specific Node from each constellation
   that anchors it. (aNodeId, bNodeId)
3. Write a walkthrough — prose, paragraphs, addressed to {A.name}
   directly ("you") — that walks through the threads one at a time.
   Each paragraph corresponds to one thread.

Hard rules:
- Don't list "common interests." Resonance is shape, not subject.
- It's fine and good if A and B resonate on things that look different
  on the surface. Two people drawn toward the same shape through
  different media is *more* resonant, not less.
- If the strongest thread is a contrast rather than a similarity,
  name it. Recognition is sometimes across difference.
- Don't assign a score. Don't summarize at the end.

Return JSON:
{
  "threads": [
    { "aNodeId": "...", "bNodeId": "...", "strength": 0.0–1.0, "note": "..." }
  ],
  "walkthrough": "..."
}
```

---

## 9. The user interface

This is the prototype's load-bearing deliverable. The visual identity feeds cultural propagation (philosophy §11). A single screenshot of the constellation rendering, with no context, must be recognizably Constello and aesthetically striking.

### Aesthetic direction

- **Emulate constellations — do not recreate them.** This is the governing principle, and it is easy to get wrong by being too literal. The goal is *recognition*: someone seeing the Sky should think "oh, they really do resemble constellations — that's why it's Constello." A resemblance, an evocation. **Not** a photoreal night sky. Recreating the literal sky imports its worst properties — faint pinpricks, a darkness you strain against, stars you have to work to make out — and every one of those betrays the concept, because **each star is a collection, and a collection is a bright node of meaning in someone's life.** Meaning is not faint. So stylize toward legibility, warmth, and presence over realism. (Concretely: a too-realistic 3D night-sky rendering looked "correct" and was wrong — it took on the bad properties of real constellations. The more stylized 2D treatment is the canonical direction.)
- **Stars are bright nodes, always.** Stars read as luminous and present in *every* theme. They are warm-white and glowing — never dim, never something the eye has to hunt for. Brightness is the visual claim that this collection matters to the person.
- **Observatory, not social app.** Deep field background, generous negative space, no rounded card chrome floating on white.
- **Serif for proper nouns and names.** A warm display serif (Fraunces, Spectral, Cormorant). Sans for everything else (Inter Tight or similar).
- **Restrained palette, gentle dark.** The dark theme is a *soft* deep field — a gentle night (lifted blue-charcoal, e.g. `#12151f`), never pure black; black is harsh and reads as "off." Warm cream foregrounds. The light theme is a **luminous, medium-toned ground with white stars on it** — warm aged parchment (`~#bcae8c`, the canonical choice — white stars + dark ink lines read like an antique star atlas) or a cool dawn both work. What's forbidden is a *pale*, near-white ground: it makes white stars vanish, or forces dark "mold-spot" stars — the worst result, and the original mistake. The ground is kept medium *precisely so the white stars stay bright*; warmth is welcome, paleness is not. Color in the constellation comes from the stars' halos, drawn from the underlying readings — never a flat hue per source category (philosophy §9; the per-Node-hue note in `CREDENTIALS.md`).
- **Slow, deliberate motion.** Twinkling stars (gentle — never dimming so far that a node looks like it's going out). Gentle parallax. Nothing snappy. The product feels like looking up.
- **Sparse use of text.** Where text appears, it has weight. Body copy is small, leading is generous, line lengths are restrained.

The earlier visual prototype shown in chat is the starting direction. Carry it forward.

### Screens to build

**1. Explore (public, no auth)** — `/`

The Sky view, populated with whatever real constellations exist. A visitor can:
- Pan and zoom the Sky
- Tap any constellation → enters that constellation's view, with a pairwise read generated against a "guest" essence (or just the synthesis shown solo if no guest synthesis exists yet)
- See a small "claim a star" CTA that initiates onboarding

This is the hook. Visitors experience the ecosystem before signing up.

The Explore page only ships publicly when there are enough real constellations in the Sky to make it feel like a sky. Until then, `/` redirects to onboarding or shows a holding page. See §11 and §13.

**2. Onboarding** — `/onboarding/*`

Sequential, never a single multi-field form. Each step is its own page. The user can skip any collection but must connect at least one.

Steps in order:
1. `/onboarding/name` — choose a Constello name. Validate uniqueness. No real-name verification. Single field, no placeholder text suggesting "your name" or "first name" — just *what would you like to be called here?*
2. `/onboarding/pinterest` — OAuth flow. Skip permitted. Includes a visibility toggle: "Visible to matches" (default on).
3. `/onboarding/lastfm` — username field or OAuth. Skip permitted. Same visibility toggle.
4. `/onboarding/claude-memory` — file upload. Skip permitted. Same visibility toggle.
5. `/onboarding/stickers` — Telegram export upload or generic file upload. Skip permitted. Same visibility toggle.
6. `/onboarding/text` — paste text or attach a text file; multiple submissions allowed, optional short label per submission. Framed as *text you've kept or written* (§6.5), not an about-me field. Skip permitted. Same visibility toggle.
7. `/onboarding/forming` — "your constellation is forming." Quiet animated holding state while extractions + synthesis run (10–60 sec typical).
8. Drop the user into `/me` — they see their own constellation rendered for the first time.

The visibility toggle on each collection step is the same `visible` flag from §5. A user can flip any collection's visibility later from the collections drawer on `/me` (see screen 3). Hidden collections still feed the synthesis.

**3. Self / your own constellation** — `/me`

The user sees their constellation in three layers, from focused to integrated:

1. **The Nodes themselves**, rendered as a small graph of points of light. Each Node corresponds to one analysis — one Pinterest board read, one Last.fm cluster read, one Claude memory theme read, one sticker cluster read. Tapping a Node shows its full reading: this is the model's analysis of that specific collection unit, standing on its own.

2. **The per-collection summary** (collections drawer, accessible from the source pill on each Node or from a dedicated affordance): all Nodes from one source grouped together with a short top-level read of the collection as a whole. "Here's what we read in your Pinterest." For each collection, the drawer surfaces a **visibility toggle** (the `visible` flag from §5) — visible to matches, or hidden from matches but still feeding the synthesis. The drawer also offers disconnect, so a user whose Pinterest reading doesn't feel right can remove that collection entirely.

3. **The synthesis**, presented below the graph (or in a slide-up panel) as long-form prose — the cross-reference that draws across all the analyses into one portrait.

A subtle indicator: "compiled [time]. updates when your collections change."

**4. Sky (authed)** — `/sky`

Same Sky view as Explore, but now the user has their own constellation in it. Subtle visual cue showing their own position.

The Sky surfaces resonant candidates from the other real constellations. The matchmaker (§11 below) returns a few candidates per visit.

**5. Another constellation** — `/constellation/[chosenName]`

When a user A taps another constellation B, this view loads:
- Both constellations rendered side by side (or overlapping, depending on visual treatment)
- Red strings drawn between resonant nodes (from the pairwise read)
- The walkthrough presented in a readable panel, one paragraph per thread, each paragraph highlighting its corresponding red string on hover/scroll
- The walkthrough is computed on demand if not cached
- Tapping any of B's Nodes opens that Node's reading

Whether A can also see B's *raw* collection material depends on match status (§10):
- **A is not a match for B** — A sees Node readings and the synthesis prose only. Raw material is not accessible.
- **A is a match for B** (mutual surfacing per §11) — tapping a Node also offers a "view source" affordance that opens the underlying material: the actual Pinterest board, the actual listening cluster, the actual memory theme excerpts, the actual sticker cluster. Limited to collections B has marked `visible`. Hidden collections show only their reading, with no view-source affordance.

This is the social atom of Constello. Most of the visual care should go here.

### Visual rendering of a constellation

A constellation is a small graph: 10–25 Nodes typical, depending on how many collections the user connected. Each Node is a point of light, with weight rendered as size and slight luminosity variation. Internal edges (between Nodes of the same constellation) emerge from embedding proximity *within* the constellation, drawn thin and faint — these represent the internal resonance of one person.

Source-type signaling: Pinterest, Last.fm, Claude memory, and sticker nodes can have *subtly* different visual signatures (shape, edge style, particle behavior), but NOT different colors that imply category. The viewer should be able to tell with effort that one node is from one source and another is from another, but the differentiation must not be the dominant visual axis. Constellations are individuals, not collages of typed components.

Position within a constellation: settle via force-directed layout where attraction follows internal embedding similarity. Cache the resulting positions so the constellation doesn't shift around between visits — visual permanence matters.

### Visual rendering of the Sky

Many constellations arranged spatially. Position in the Sky reflects synthesis-level embedding proximity (the matchmaker substrate). At far zoom, each constellation appears as a small cluster of points. Zooming in reveals the internal node structure.

**Critical:** position-in-Sky must not visually imply categories (philosophy §9). No colored regions, no labeled clusters, no group boundaries drawn. Two constellations near each other in the Sky are just nearby points.

---

## 10. Privacy

**Visibility model.** Constello has no non-mutual visibility (philosophy §7). What another user can see of a constellation depends on whether they are a *match*.

- **Explore visitors and non-matched authed users** see: chosen name, the constellation visualization (Nodes as points of light), Node readings (the LLM-summarized text), and the synthesis prose. No raw collection material.
- **Matches** see: everything above, plus the raw material from collections the owner has marked visible. Pinterest boards as actual boards. Last.fm listening as actual tracks and artists. Claude memory content. Sticker files.

**Match definition for the prototype:** A and B are a match when the matchmaker has mutually surfaced them — A appears in B's Sky candidates AND B appears in A's Sky candidates (§11). This is algorithmic mutuality; it does not require a deliberate act by either party. Once stargazing ships (Phase 6), match is redefined as mutual stargazing or stronger; the algorithmic version becomes "candidate" rather than "match."

**Per-collection visibility toggle.** Each Collection has a `visible: boolean` flag (§5). Default `true`. The owner toggles it in onboarding and afterward, per collection. A hidden collection still feeds the synthesis; it just doesn't expose its raw material to matches. Users own the privacy decision. The doc does not paternalize defaults — Pinterest, Last.fm, Claude memory, and stickers all default to visible, and the owner decides what to hide.

**Other privacy rules:**

- **Node readings are LLM-summarized.** They are not direct extracts. They may mention specific aesthetic references where relevant but must not be wholesale source dumps. Node readings are visible to Explore visitors and non-matched users (per the visibility model above), so they should not contain anything the owner would not want a stranger to read.
- **Real names never enter the system.** If Pinterest is connected, the user's Pinterest display name is not stored as identity. Only the boards.
- **PII filtering and defensive content rules — deferred for the alpha (2026-05-27).** The alpha is for validating whether the algorithm reads true; defensive infrastructure (PII excision from Claude memory, photographic-content rules for stickers, content moderation) gets designed once we know what actually matters. For now, the Claude memory adapter passes excerpts through unfiltered, and the sticker vision pass reads packs without face-redaction rules.
- **Pairwise reads are visible only to the viewer.** B does not see the reads other users have generated of B. (This is independent of the match visibility model — pairwise *readings* are A's interpretation of A's relationship to B, asymmetric by construction, computed at view time.)

---

## 11. The Sky (matchmaker, prototype version)

For the prototype, the matchmaker doesn't need to be production-grade. The minimum viable behavior:

```
For viewer A:
  1. ANN search on synthesis embedding similarity against pgvector
     index of all syntheses. Top K = 30.
  2. For each candidate, compute or retrieve pairwise read with A.
  3. Rank by pairwise resonance strength (sum of thread strengths).
  4. Surface a small number (e.g. 3) for the Sky to highlight to A.
```

Constraints from the philosophy doc:
- Sky never shows popularity. Rankings are always relative to the viewer.
- Sky surfaces few constellations per session. No infinite scroll, no swipe deck.
- The Sky degrades gracefully. When matches are sparse, surface fewer rather than weaker ones.

**Mutual surfacing (the match relation).** A and B are *matches* when B is in A's surfaced candidates AND A is in B's surfaced candidates. This is the relation §10 gates raw-material visibility on. Compute it lazily: when A loads `/constellation/B`, the system checks whether B would surface A in their own Sky candidates. Cache the result with the pairwise read, invalidate when either synthesis changes. Once stargazing ships (Phase 6), the match relation becomes "mutual stargazing or stronger" and algorithmic candidacy becomes a strictly weaker signal.

**No seeded or hand-authored constellations.** Every constellation in the Sky is a real person who ran the onboarding pipeline. The Sky's job is to read what's actually there; populating it with synthetic stars violates that. The cold-start problem is solved by the first cohort of real users (Ethan + invited testers running the real adapters end-to-end), not by hand-authored demos. Until that cohort exists and synthesis output is good enough to be seen by visitors, the public Explore page is gated. See §13.

---

## 12. The cosmetic layer (architectural placeholder)

Even though monetization is out of scope for the prototype, **architect for a separable cosmetic layer now** (philosophy §12).

The constellation data, synthesis, nodes, pairwise reads — these are the *content* layer.

The frame, theme, font choice, soundtrack, layout variant a user chooses to present their constellation in — these are the *presentation* layer.

These two must be separable. Keep cosmetic preferences on a separate user-presentation row, not embedded in the Constellation row. Render the constellation by composing content × presentation at view time.

For the prototype, ship a single default presentation. But don't bake any presentation choices into the data model.

---

## 13. Build phasing

### Phase 1 — Foundation
- Monorepo setup
- Database schema, migrations (Constellation, Collection, Node, Synthesis, PairwiseRead)
- `packages/collections/core` types + adapter contract
- Stub auth: cookie + chosen name in DB
- Visual identity work in parallel: aesthetic direction, design tokens, type pairing, first WebGL sketches against synthetic test data. Test data here is *for development only*, never shown to a visitor and never persisted as real constellations.

### Phase 2 — Collection adapters
- Last.fm adapter first (simplest, no OAuth)
- Pinterest adapter (OAuth, image handling, board reading, Claude vision for image captions)
- Claude memory adapter (file upload, theme extraction, PII filter)
- Sticker adapter — Telegram-first, fallback to generic file upload
- General text adapter — paste or file upload, one Node per submission, reading calibrated to name performance (§6.5)
- Each adapter ships with: connect flow, extractNodes implementation, fixtures, working node reading prompts

### Phase 3 — Synthesis + pairwise pipelines
- Node extraction + reading + embedding pipeline
- Synthesis compilation pipeline (the most important prompt — iterate on its output quality with real test data)
- Pairwise read pipeline with caching by (aSynthesisFingerprint, bSynthesisFingerprint)
- Fingerprint-based invalidation

### Phase 4 — Onboarding wired end-to-end + first cohort
- Onboarding flow wired end-to-end (`/onboarding/*`)
- New user's collections are ingested, synthesis compiled, pairwise reads with other real users computed on-demand
- Ethan runs the flow first against his own collections; iterate on synthesis prompt quality until the portrait reads true
- Invite a first cohort (~100 people) to onboard and produce their constellations
- `/me`, `/sky` (authed), and `/constellation/[chosenName]` work for this cohort
- `/` (public Explore) remains gated — redirects to onboarding or shows a holding page

### Phase 5 — Public Explore opens
- Once the Sky has enough real constellations to feel like a sky, and the synthesis quality is high enough that a visitor reading one would feel they were reading a real person, open `/` publicly
- "Enough" is a judgment call. Rough heuristic: 20–30 real constellations with distinct, well-read essences. Final call is Ethan's after looking at the Sky.

### Out-of-prototype phases (for awareness, not now):
- Phase 6 — Real auth (Clerk), stargazing/love, persistent sessions
- Phase 7 — Trace mechanic (still unresolved philosophically)
- Phase 8 — Cosmetic layer, monetization, the rest

---

## 14. Open engineering questions

1. **Pinterest board sampling.** Boards can have thousands of pins. Sample strategy: by recency, random, or image-cluster diversity? Recommend recency-weighted random for prototype.
2. **Last.fm clustering.** k-means in embedding space vs. genre-tag-based vs. recency-aware. Worth a small experiment with real listening data.
3. **Claude memory file format.** Verify the current Claude export format and write a parser. May need to handle several variants (memory JSON, markdown export, chat export).
4. **Telegram sticker export format.** Verify what Telegram actually exports — is it a `.tgs` (animated) format, static PNGs, or a TDLib export? Decide what to support.
5. **Pairwise cache invalidation cascade.** When A's synthesis changes, all (A, *) pairwise reads invalidate. Lazy invalidation is fine — recompute on next view.
6. **Sonnet 4.6 vs Opus 4.7 for the synthesis.** The synthesis is the load-bearing artifact. Opus 4.7 may produce meaningfully more literary output, but costs ~67% more per token and uses a new tokenizer that can inflate token counts up to ~35% on the same input. Run a side-by-side on a few real constellations before committing.
7. **Embedding model.** voyage-3-large is the current default. voyage-4-large launched January 2026 with a shared embedding space across the 4-series (nano/lite/standard/large) — useful if we later want to embed queries with a cheaper model than documents. Benchmark both at build time.

---

## 15. When you're stuck

Order of consultation:
1. Re-read `CONSTELLO_PHILOSOPHY.md` §15 (the compass).
2. Check `design philosophy/` atoms in the vault for crystallized claims, especially [[design philosophy/Collection types — current and eligibility test]] when adding or modifying collection types.
3. Read the linked vault syntheses ([[Constello — Architectural Deepening]] is the deepest).
4. Ask Ethan, with the specific question and philosophy-doc framing already considered.

Do not improvise on the philosophy. Improvising on engineering is fine and encouraged. Improvising on the visual identity is permitted but should be checked against §9's screenshot-coherence requirement.

# How the reading works

How a person's collections become a portrait, and the one rule that decides whether any of it means anything. This is the territory the old design-philosophy atoms covered, written as one argument.

## The calibration rule: not the material

> Surface description still describes the material, not what the person carries that makes them gather it.

This is the rule for every reading prompt in the system — node-level, synthesis, pairwise.

"The warmth of acoustic music played quiet" is closer to right than "they like indie folk." Both still describe the *material*. The reading has to push further: to the layer where Jeff Buckley and hyperpop both carry a fundamental romantic loneliness, where visual-novel piano and Minecraft soundtrack both express an inherent value for quiet beauty. The product is for recognition at *that* lower level — the same level the sherpa line names: they could lead any life, and down here we would still recognize each other.

## Why this is the whole game

Surface-reading is the failure mode that's invisible from output quality. Readings that describe the material *look* literary. The pipeline runs. But the pairwise read has nothing to anchor real recognition to, and it quietly collapses to adjacent-material matching — last.fm recommending adjacent bands with extra steps. Constello becomes a fancier version of the thing it exists to refuse, and nothing in the output tells you it happened.

Two people who collected wildly different things *for the same underlying reason* would never match in a tag system — they'd look like different communities entirely. They wouldn't match in a system whose readings stop at the material either. The medium changed; the failure mode didn't. So the rule's strongest form is also its hardest case: the strongest resonances are the ones that cross surfaces. That's not a softening of the rule — crossing surfaces is exactly what Constello exists to make legible.

The rule applies the whole way down:

- **Node reading** — what does this person carry that makes them gather *this* pocket?
- **Synthesis** — what's carried across the pockets, drawn as one portrait?
- **Pairwise** — where do two people's carryings meet, however different the surfaces look?

## The load-bearing artifact: the essence synthesis

> "Each person's constellation gets compiled, once per data refresh, into a high-fidelity essence synthesis — a written artifact, maybe 2,000–4,000 tokens, that captures the person densely and idiosyncratically. Not bullet points, not categories. Something close to literature. The way a perceptive friend would describe you to someone they were introducing you to. This is the expensive part, and it only runs when your collections change. It's the load-bearing artifact of the whole system."
>
> — Claude

This is where the calibration has to hold most. The synthesis is the compiled portrait everything downstream reads against; if it stops at the material, every match built on it is adjacent-material matching wearing literary prose.

## Who authors the portrait: the inversion

> "You compose yourself for the reading the way you'd compose yourself for an exhibition: choose what to include, what to emphasize, what to leave out, and then let the work speak for itself. You don't get to write the catalogue essay. The model writes that."
>
> — Claude (revised from an earlier flawed framing about an "uncurated self")

Every other platform lets the user write their own profile copy and pins their real identity to it. Constello inverts *who authors the description*. Legal identity goes away (chosen names); the user composes by *selecting collections* rather than by *writing description*; and the model authors the reading on the material submitted.

Both involve curation — the earlier "uncurated self" framing was wrong. The user curates what they submit, the way an artist curates an exhibit. What's inverted is the authorship: elsewhere the user writes the description and the system displays it; here the user composes the material and the system writes the description. Two forms of agency kept clean — composition belongs to the user, authoring belongs to the model. This is why there are no bio fields, no "about me," no interest questionnaires. People can't describe their own essence explicitly anyway; they express it implicitly, through what they gather and how they gather it, and the model reads that.

## What gets read, and the eligibility test

The collections in play, each a different surface:

- **Pinterest boards** — the unit is the board, not the pin. A pin is a stray impulse; a board is a person saying *these belong together*. The grouping itself is the signal.
- **Last.fm scrobbles** — collected by the act of listening over time. What someone *returns to*, accumulated by living rather than by authoring.
- **Claude memory files** — the residue of months of unperformed thinking, talking to an AI when no one else was watching. Often the strongest signal because it's the least conscious authoring.
- **Gif / sticker collections** — the small library of expressive units someone has saved and reuses. Tells you how a person reaches for feeling in conversation — what registers of humor, tenderness, irony, drama they keep ready to hand. Relational rather than introspective, which is exactly why it adds resolution.
- **General text** — the catch-all: journals, saved passages, essays, a notes dump, poetry kept, character writing made. The open door for accumulated text, gathered *or* authored. Authoring isn't a performance flag — the test is composed-for-an-audience vs. sincere, not who wrote it; authored creative material is often the richest signal there is.

(Open candidates worth resolving: personal Twitter/X, Instagram, Spotify playlists, Tumblr likes/reblogs, Letterboxd, Goodreads, camera-roll favorites, Notes app titles.)

**The eligibility test isn't applied at the platform level — it's applied at the reading level.** Performance vs. sincerity is a property of the individual artifact, not the source. A Twitter account can be 14 years of someone thinking out loud to three followers; an Instagram grid can be a private aesthetic log that happens to be public; conversely a Pinterest board can be cynically curated to grow an audience. The platform doesn't predict it; the artifact does. So the real question is: *can the synthesis pipeline detect and downweight performance within whatever's submitted?* Yes — performance leaves tells (aggressive cohesion, algorithm-aware rhythms, captions written for an imagined reader, hashtag strategy); sincerity leaves different ones (irregular cadence, posts that break the surface aesthetic, captions that read as private notes left visible). A model capable of reading constellations is capable of reading this.

Two forces make it hold without scaffolding:

1. **User intent does most of the filtering.** People want to be read well; they feed in the surfaces where they were honest and skip the ones where they performed. Self-selection is doing real work at the input stage.
2. **The synthesis can be transparent about discounting.** Show the user which submitted collections (or which parts of one) are being weighted heavily versus discounted, and why. They can drop sources that aren't read well, or accept that their public Twitter is being treated as decorative.

A new collection type has to clear: enough sincere signal somewhere inside to be worth reading (judged by reading it, not the platform); accumulation over time (one-off artifacts lack the accumulated-attention shape that makes a collection); a register the existing ones don't already cover, so it adds resolution rather than redundancy; and a stable import format. The architecture accepts any artifact and lets the reading do the filtering.

## Why there's no anti-fake machinery

Performance is detectable across collections, even when it isn't within any one of them.

> "performance is detectable, maybe not in an individual collection, but inevitably within a constellation."
>
> — Ethan

AI made performance *legible at the constellation level* — not as a defended-against threat, but as one of many things a careful reader notices. A model good enough to read a person well is also good enough to read when someone is reaching for the camera. That's what lets the system stay relaxed about everything downstream: no scoring system, no joint-distribution test, no anti-fake architecture, because the same capability that makes the product work makes performance visible as a feature of any portrait that contains it.

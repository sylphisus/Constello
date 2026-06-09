# Collection types — current and eligibility test

## The collections

- **Pinterest boards** — the unit is the board, not the pin. A pin is a stray impulse; a board is a person saying *these belong together*. The act of grouping is itself the signal.
- **Last.fm scrobbles** — collected by the act of listening over time. What someone *returns to*, accumulated by living rather than by authoring.
- **Claude memory files** — collected by talking with an AI when no one else was watching. The residue of months of unperformed thinking. Often the strongest signal because the least conscious authoring.
- **Gif / sticker collections** — the small library of expressive units someone has saved and reuses. Tells you how a person reaches for feeling in conversation — what registers of humor, tenderness, irony, drama they have ready to hand. A different surface than the others (relational rather than introspective), which is exactly why it adds resolution.
- **General text** — the catch-all. Any pasted text or text file: journals, saved passages, essays, a notes dump, poetry someone keeps, songs or character writing they've made. It's the open door for accumulated text — gathered *or* authored — that no dedicated adapter covers. Authoring isn't a performance flag (the eligibility test is about composed-for-an-audience vs. sincere, not who wrote it); authored creative material is often the richest signal there is. The test applies at the reading layer here exactly as it does for every type: text written *for the reading* — a performed self-description — is read as performance and named, not absorbed as fact, the same move as reading an aspirational board. The mechanism accepts anything; the framing steers toward kept/written text rather than an about-me box, and the reading does the filtering.

Additional collection types worth considering (open):
- Personal Twitter / X accounts
- Personal Instagram accounts
- Personal Spotify playlists
- Tumblr likes / reblogs
- Letterboxd ratings
- Goodreads logs
- Camera roll favorites
- Notes app titles / filenames

## The eligibility test

**Performance vs. sincerity is a property of the individual artifact, not the platform.** A Twitter account can be 14 years of someone thinking out loud with three followers; an Instagram grid can be a private aesthetic log that happens to be public. Conversely, a Pinterest board can be cynically curated for an audience the person is trying to grow. The platform doesn't predict it. The artifact does.

The right test isn't applied at the source level. It's applied at the reading level:

**Can the synthesis pipeline detect and downweight performance within whatever's submitted?**

The answer is yes. Performance leaves tells in the artifact: aggressive cohesion, algorithm-aware rhythms, captions written for an imagined reader, hashtag strategies. Sincerity leaves different tells: irregular cadence, posts that break the surface aesthetic, captions that read as private notes that happened to be left visible. A model capable of reading constellations is capable of reading this.

Two structural forces make this work:

1. **User intent does most of the filtering.** People want to be read well. They'll naturally feed Constello the surfaces where they were honest, and skip the surfaces where they were performing. Self-selection is doing real work at the input stage.
2. **The synthesis can be transparent about discounting.** Show the user which of their submitted collections (or which parts of one) are being weighted heavily versus discounted, and why. They can drop sources that aren't being read well, or accept that their public Twitter is being treated as decorative.

## What new collection types must demonstrate

1. The artifact contains enough sincere signal (somewhere within it) to be worth reading. This is determined by reading the artifact, not by judging the platform.
2. It accumulates over time. One-off artifacts (a single essay, a single playlist made for an occasion) don't have the accumulated-attention shape that makes a collection.
3. It reveals a register the existing collections don't (so it adds resolution rather than redundancy).
4. There is a stable API or import format.

The architecture accepts any artifact and lets the reading do the filtering.

// The reading prompt. Deliberately kept neutral: the model is handed the
// material and asked to analyse it, with no instruction to "reach for" depth.
// A directive to hunt for something underneath biases the model into
// manufacturing it where there's none — so Opus is trusted to find what's
// genuinely there and to say less (or nothing) when little is. See the
// prompt-strategy note in memory (2026-06-17).
//
// FORMAT: a reading/essence is a free-form MARKDOWN artifact. No prescribed
// shape, no title, no {title, reading} JSON — that contract is dead (reversed
// 2026-06-25). Opus writes with full creative freedom; the markdown is stored
// verbatim as a Reading.artifact / Essence.artifact and rendered through `marked`
// (lib/reading-doc) into the themed page.
//
// STATUS: the live alpha fulfils readings BY HAND — the admin console copies
// READING_PROMPT + the material into claude.ai and pastes the markdown back.
// These message builders are the seed for the future *automated* API path: kept,
// not yet wired. They share READING_PROMPT with the admin console so the manual
// and automated paths can't drift.

import type { Entry, EntrySource, Reading } from "./types";

/** The one neutral instruction handed to Opus — manual or automated. */
export const READING_PROMPT = "Conduct a personal analysis on this.";

/** Material is sent whole — no truncation. Opus gets everything. */
export function sampleRaw(text: string): string {
  return text.trim();
}

// ── Entry-level reading ──────────────────────────────────────────────────────
// Opus 4.8. One reading per entry. Per-collection context lives below: a hand-
// written note giving Opus what's specific to that kind of material. Keep them
// neutral (see the note above) — hand the model the material, don't command it
// toward depth. All empty for now; the bare prompt reads well on its own.
const NODE_READING_INSTRUCTIONS: Record<EntrySource, string> = {
  text: ``,
  lastfm: ``,
  twitter: ``,
  pinterest: ``,
  spotify: ``,
  obsidian: ``,
  "apple-notes": ``,
  "google-docs": ``,
  notion: ``,
  images: ``,
};

export function nodeReadingMessages(
  entry: Pick<Entry, "label" | "rawText" | "source">,
): {
  system: string;
  user: string;
} {
  const instruction = NODE_READING_INSTRUCTIONS[entry.source];
  const labelLine = entry.label.trim()
    ? `The person labelled this: "${entry.label.trim()}".\n\n`
    : "";

  return {
    system: [READING_PROMPT, instruction].filter(Boolean).join("\n\n"),
    user: `${labelLine}${sampleRaw(entry.rawText)}`,
  };
}

// ── Essence synthesis ────────────────────────────────────────────────────────
// Opus 4.8. Draws across all of a constellation's readings; each reading artifact
// is presented with the raw material it came from so the model can ground a
// thread in a specific phrase rather than abstracting. Neutral prompt — "if any
// at all" leaves room for there being no throughline. The output is one free-form
// markdown essence artifact (§7).

const SYNTHESIS_HEAD = `These are the collected readings of a single person. What threads run across them, if any at all? Draw them together.`;

export function synthesisMessages(
  readings: Reading[],
  entriesById: Map<string, Pick<Entry, "label" | "rawText" | "source">>,
): { system: string; user: string } {
  // Each reading is presented with the raw material that anchors it grouped
  // immediately after it, so the synthesis can move between the reading and its
  // source without having to hunt (§7).
  const blocks = readings.map((reading, i) => {
    const entry = entriesById.get(reading.entryId);
    const raw = entry ? sampleRaw(entry.rawText) : "(raw material unavailable)";
    return `── Reading ${i + 1} ──

${reading.artifact}

Raw material this reading was drawn from:
${raw}`;
  });

  return {
    system: SYNTHESIS_HEAD,
    user: blocks.join("\n\n\n"),
  };
}

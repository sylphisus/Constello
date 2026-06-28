// Shared types for the general-text adapter (§6.5) and essence synthesis (§7).
// A subset of packages/collections/core/types.ts — kept local for the prototype.

export interface TextSubmission {
  id: string;
  /** Optional short user-supplied label, e.g. "morning pages". May be empty. */
  label: string;
  /** The raw pasted or uploaded text. The act of including this is the signal. */
  rawText: string;
}

export interface Node {
  id: string;
  submissionId: string;
  /** User label, or a short title the model generated when no label was given. */
  title: string;
  /** 200–500 token reading, per the §6.5 reading prompt. */
  reading: string;
}

export interface Synthesis {
  id: string;
  /** 2,000–4,000 token portrait drawn across all nodes (§7). */
  text: string;
  /** Hash of all node readings + raw material; the synthesis is cached on this. */
  fingerprint: string;
}

// ── Manual alpha (branch: alpha-manual-readings) ─────────────────────────────
// A person IS a constellation. Readings/essences are model-authored markdown
// artifacts, fulfilled by hand. `signature` is the embedding-derived live shape,
// null until the first reading exists.

export interface Constellation {
  id: string;
  signature: string | null;
  createdAt: string;
}

// What kind of collection an entry is. 'text' is pasted/uploaded writing; most
// others are fetched from an API and formatted into raw_text by an adapter
// (lib/collections/*). 'images' is the exception: its material is bytes (stored
// in R2, lib/storage), not raw_text — the images themselves are read. The
// reading itself is still fulfilled by hand.
export type EntrySource =
  | "text"
  | "lastfm"
  | "twitter"
  | "pinterest"
  | "spotify"
  | "obsidian"
  | "google-docs"
  | "notion"
  | "images";

export interface Entry {
  id: string;
  constellationId: string;
  source: EntrySource;
  label: string;
  rawText: string;
  createdAt: string;
}

/** One image in an 'images' collection. Bytes live in R2 at storagePath. */
export interface EntryImage {
  id: string;
  entryId: string;
  storagePath: string;
  caption: string;
  position: number;
  createdAt: string;
}

/** One reading per entry. The artifact is a self-contained markdown world. */
export interface Reading {
  id: string;
  entryId: string;
  artifact: string;
  createdAt: string;
}

/** The cross-entry essence; one current artifact per constellation. */
export interface Essence {
  id: string;
  constellationId: string;
  artifact: string;
  createdAt: string;
}

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

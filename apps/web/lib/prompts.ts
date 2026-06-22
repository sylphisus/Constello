// The reading prompts. Deliberately kept neutral: the model is handed the
// material and asked to analyse it, with no instruction to "reach for" depth.
// A directive to hunt for something underneath biases the model into
// manufacturing it where there's none — so Opus is trusted to find what's
// genuinely there and to say less (or nothing) when little is. See the
// prompt-strategy note in memory (2026-06-17).

import type { Node, TextSubmission } from "./types";

/** Submissions are sent whole — no truncation. Opus gets the full material. */
export function sampleRaw(text: string): string {
  return text.trim();
}

// ── Node-level reading ───────────────────────────────────────────────────────
// Opus 4.8. One reading per submission. The instruction is intentionally bare;
// we additionally ask for a short title so a Node has one when the user gave no
// label. No length guidance — the model says as much or as little as the
// material warrants.

const NODE_READING_INSTRUCTION = `Conduct a personal analysis of this.`;

export function nodeReadingMessages(submission: TextSubmission): {
  system: string;
  user: string;
} {
  const labelLine = submission.label.trim()
    ? `The person labelled this submission: "${submission.label.trim()}".\n\n`
    : "";

  return {
    system: `${NODE_READING_INSTRUCTION}

Return a JSON object with exactly two fields:
- "title": a short 2–5 word title for the analysis.
- "reading": the analysis itself, as prose.

Return only the JSON object, nothing else.`,
    user: `${labelLine}The text:\n\n${sampleRaw(submission.rawText)}`,
  };
}

// ── Synthesis ────────────────────────────────────────────────────────────────
// Opus 4.8. Draws across all node readings; each reading is presented with the
// raw material it came from so the model can ground a thread in a specific
// phrase rather than abstracting. Neutral prompt — "if any at all" leaves room
// for there being no throughline.

const SYNTHESIS_HEAD = `These are the collected analyses coming from a single person. What threads can you draw across them, if any at all?`;

export function synthesisMessages(
  nodes: Node[],
  submissionsById: Map<string, TextSubmission>,
): { system: string; user: string } {
  // Each reading is presented with the raw material that anchors it grouped
  // immediately after it, so the synthesis can move between summary and source
  // without having to hunt (§7).
  const blocks = nodes.map((node, i) => {
    const submission = submissionsById.get(node.submissionId);
    const raw = submission ? sampleRaw(submission.rawText) : "(raw text unavailable)";
    return `── Node ${i + 1}: ${node.title} ──

Reading:
${node.reading}

Raw material this reading was drawn from:
${raw}`;
  });

  return {
    system: SYNTHESIS_HEAD,
    user: blocks.join("\n\n\n"),
  };
}

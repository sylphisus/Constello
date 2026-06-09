// The reading prompts. These are the load-bearing artifact of Constello, not
// boilerplate — every line is taken from the spec and exists to push the model
// past surface description toward what the person carries that made them gather
// this. Do not "improve" the language casually; calibrate against the guiding
// examples (CONSTELLO_BUILD.md §6.5, §7).

import type { Node, TextSubmission } from "./types";

/** Long submissions are sampled, not sent whole, to keep token cost bounded. */
const MAX_RAW_CHARS = 12_000;

export function sampleRaw(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= MAX_RAW_CHARS) return trimmed;
  // Head-biased sample: the opening usually establishes register; mark the cut.
  return (
    trimmed.slice(0, MAX_RAW_CHARS) +
    "\n\n[…submission truncated for length; this is a sample of a longer text…]"
  );
}

// ── Node-level reading (§6.5) ────────────────────────────────────────────────
// Haiku 4.5. One reading per submission. The skeleton is reproduced verbatim
// from the build doc; we additionally ask for a short title so a Node has one
// when the user gave no label.

const NODE_READING_SKELETON = `Read this text as a perceptive friend. It's something this person kept, wrote, or gathered and chose to submit. The words are the material; what you're reading for is what this person carries that made them hold onto *this* — the register of feeling, value, longing, or posture underneath. If the text reads as a performed self-description — written for a reader, reaching for how they want to be seen — read that performance as itself a fact about them and name it, the way you'd read an aspirational Pinterest board; do not take its self-claims at face value. Name tensions rather than smoothing them. Quote a phrase when the specific makes the reading truer. Avoid "they are X." 200–500 tokens.`;

export function nodeReadingMessages(submission: TextSubmission): {
  system: string;
  user: string;
} {
  const labelLine = submission.label.trim()
    ? `The person labelled this submission: "${submission.label.trim()}".\n\n`
    : "";

  return {
    system: `${NODE_READING_SKELETON}

Return a JSON object with exactly two fields:
- "title": a short 2–5 word title for this reading. If the person gave a label, you may use or refine it; otherwise name the piece in their spirit, not a genre label.
- "reading": the 200–500 token reading itself, as prose (no headings, no bullet points).

Return only the JSON object, nothing else.`,
    user: `${labelLine}The text:\n\n${sampleRaw(submission.rawText)}`,
  };
}

// ── Essence synthesis (§7) ───────────────────────────────────────────────────
// Sonnet 4.6. Draws across all node readings AND the raw material each was drawn
// from, so the portrait can reach for a specific phrase rather than abstracting
// it away. Presented to the user simply as their essence — never labelled by the
// collection it came from.

const SYNTHESIS_HEAD = `You are writing an essence synthesis for Constello — a portrait of one
person, drawn across several analyses of their collections.

Below are:
- Perceptive readings of this person's individual collections, one per
  Node. Each was read on its own.
- The raw material each reading was drawn from.

Your job is to write a single 2,000–4,000 token portrait that draws across
all of them. Use the readings as a guide to what's there; reach into the
raw material when a specific reference — a recurring phrase, a particular
image, a turn of words — would make the portrait truer than an abstraction
would.

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

Node readings and raw material follow.`;

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

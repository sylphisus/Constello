import Anthropic from "@anthropic-ai/sdk";

// Opus 4.8 for both the node-level readings and the synthesis (overriding the
// §3 default of Haiku 4.5 / Sonnet 4.6 — see §14.6, Opus as the synthesis
// candidate). Chosen for maximum literary depth in the reading.
export const MODELS = {
  nodeReading: "claude-opus-4-8",
  synthesis: "claude-opus-4-8",
} as const;

let client: Anthropic | null = null;

/** Lazily constructed so a missing key surfaces as a clean 4xx, not a boot crash. */
export function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to the workspace-root .env.local.",
    );
  }
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

/** Pull plain text out of a messages response, concatenating any text blocks. */
export function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

/** Parse a model reply that should be a JSON object, tolerating ```json fences. */
export function parseJsonObject<T>(raw: string): T {
  let s = raw.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }
  return JSON.parse(s) as T;
}

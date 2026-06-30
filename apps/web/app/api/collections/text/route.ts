import { NextResponse } from "next/server";
import { anthropic, MODELS, textOf } from "@/lib/anthropic";
import { nodeReadingMessages } from "@/lib/prompts";
import type { EntrySource } from "@/lib/types";

export const runtime = "nodejs";

// AUTOMATED reading seed — NOT WIRED. The live alpha fulfils every reading by
// hand (POST /api/admin/reading stores the pasted markdown + embeds it). This is
// the future automated twin: given raw material, run the §6.5 reading and return
// the free-form markdown artifact. Persisting it (a `readings` row keyed to an
// entry, plus the embed + signature recompute that /api/admin/reading already
// does) is the remaining API-phase wiring; until then nothing calls this.
export async function POST(req: Request) {
  let body: { label?: string; rawText?: string; source?: EntrySource };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const rawText = (body.rawText ?? "").trim();
  const label = (body.label ?? "").trim();
  const source = body.source ?? "text";
  if (!rawText) {
    return NextResponse.json(
      { error: "A piece of text is required." },
      { status: 400 },
    );
  }

  try {
    const { system, user } = nodeReadingMessages({ label, rawText, source });
    const message = await anthropic().messages.create({
      model: MODELS.nodeReading,
      max_tokens: 16000,
      system,
      messages: [{ role: "user", content: user }],
    });
    const artifact = textOf(message);
    if (!artifact) throw new Error("Model returned an empty reading.");
    return NextResponse.json({ artifact });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error.";
    const isKey = msg.includes("ANTHROPIC_API_KEY");
    return NextResponse.json(
      { error: isKey ? msg : `Reading failed: ${msg}` },
      { status: isKey ? 400 : 502 },
    );
  }
}

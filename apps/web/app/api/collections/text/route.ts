import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { anthropic, MODELS, parseJsonObject, textOf } from "@/lib/anthropic";
import { nodeReadingMessages } from "@/lib/prompts";
import { supabase } from "@/lib/supabase";
import type { Node, TextSubmission } from "@/lib/types";

export const runtime = "nodejs";

// POST a single text submission → run the §6.5 reading → return one Node.
export async function POST(req: Request) {
  let body: { label?: string; rawText?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const rawText = (body.rawText ?? "").trim();
  const label = (body.label ?? "").trim();
  if (!rawText) {
    return NextResponse.json(
      { error: "A piece of text is required." },
      { status: 400 },
    );
  }

  const submission: TextSubmission = { id: randomUUID(), label, rawText };

  // ── Read the submission (Haiku 4.5) ────────────────────────────────────────
  let title: string;
  let reading: string;
  try {
    const { system, user } = nodeReadingMessages(submission);
    const message = await anthropic().messages.create({
      model: MODELS.nodeReading,
      max_tokens: 16000,
      system,
      messages: [{ role: "user", content: user }],
    });
    const parsed = parseJsonObject<{ title?: string; reading?: string }>(
      textOf(message),
    );
    reading = (parsed.reading ?? "").trim();
    title = (parsed.title ?? "").trim() || label || "Untitled";
    if (!reading) throw new Error("Model returned an empty reading.");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error.";
    const isKey = msg.includes("ANTHROPIC_API_KEY");
    return NextResponse.json(
      { error: isKey ? msg : `Reading failed: ${msg}` },
      { status: isKey ? 400 : 502 },
    );
  }

  const node: Node = { id: randomUUID(), submissionId: submission.id, title, reading };

  // ── Persist (best-effort) ──────────────────────────────────────────────────
  const db = supabase();
  let persisted = false;
  if (db) {
    const { error: subErr } = await db.from("text_submissions").insert({
      id: submission.id,
      label: submission.label,
      raw_text: submission.rawText,
    });
    const { error: nodeErr } = await db.from("nodes").insert({
      id: node.id,
      submission_id: node.submissionId,
      title: node.title,
      reading: node.reading,
    });
    if (subErr || nodeErr) {
      console.warn("[text] persistence failed:", subErr ?? nodeErr);
    } else {
      persisted = true;
    }
  }

  return NextResponse.json({ node, submission, persisted });
}

import { NextResponse } from "next/server";
import { formatAppleNotes, type AppleNote } from "@/lib/collections/apple-notes";
import { createEntry } from "@/lib/collections/entries";

export const runtime = "nodejs";

// Total payload guard — Notes can hold a lot, but one add shouldn't be unbounded.
const MAX_TOTAL_CHARS = 2_000_000;

// POST { constellationId?, notes: [{title, body}] } → format the recreated notes
// into one entry (stored pending) and return the constellation id. Like every
// source, the reading is fulfilled by hand later.
export async function POST(req: Request) {
  let body: { constellationId?: string; notes?: AppleNote[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const notes = (Array.isArray(body.notes) ? body.notes : [])
    .filter((n) => n && typeof n.title === "string" && typeof n.body === "string")
    .filter((n) => (n.title + n.body).trim().length > 0);
  if (!notes.length) {
    return NextResponse.json({ error: "Add at least one note." }, { status: 400 });
  }

  const total = notes.reduce((s, n) => s + n.title.length + n.body.length, 0);
  if (total > MAX_TOTAL_CHARS) {
    return NextResponse.json(
      { error: "That's too much to add in one go." },
      { status: 413 },
    );
  }

  const entry = formatAppleNotes(notes);
  const result = await createEntry({
    constellationId: body.constellationId,
    source: "apple-notes",
    label: entry.label,
    rawText: entry.rawText,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({
    constellationId: result.constellationId,
    entryId: result.entryId,
  });
}

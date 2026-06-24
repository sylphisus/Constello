import { NextResponse } from "next/server";
import { fetchTwitter, formatTwitter } from "@/lib/collections/twitter";
import { createEntry } from "@/lib/collections/entries";

export const runtime = "nodejs";

// POST { constellationId?, handle } → fetch the X/Twitter profile + recent posts,
// format into one entry (stored pending), return the constellation id. The fetch
// source is not wired yet (see lib/collections/twitter.ts); until it is, this
// returns a clean "not connected yet" error.
export async function POST(req: Request) {
  let body: { constellationId?: string; handle?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const handle = (body.handle ?? "").trim().replace(/^@/, "");
  if (!handle) {
    return NextResponse.json({ error: "An X / Twitter handle is required." }, { status: 400 });
  }

  let entry: { label: string; rawText: string };
  try {
    entry = formatTwitter(await fetchTwitter(handle));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "X / Twitter fetch failed.";
    // "not connected yet" is an expected state until fetchTwitter is wired.
    const notWired = msg.includes("isn't connected yet");
    return NextResponse.json({ error: msg }, { status: notWired ? 501 : 502 });
  }

  const result = await createEntry({
    constellationId: body.constellationId,
    source: "twitter",
    label: entry.label,
    rawText: entry.rawText,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({
    constellationId: result.constellationId,
    entryId: result.entryId,
  });
}

import { NextResponse } from "next/server";
import { fetchLastfm, formatLastfm } from "@/lib/collections/lastfm";
import { createEntry } from "@/lib/collections/entries";

export const runtime = "nodejs";

// POST { constellationId?, username } → fetch the Last.fm listening history,
// format it into one entry (stored pending), and return the constellation id.
// The reading is fulfilled by hand later, like every other entry.
export async function POST(req: Request) {
  let body: { constellationId?: string; username?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const username = (body.username ?? "").trim();
  if (!username) {
    return NextResponse.json({ error: "A Last.fm username is required." }, { status: 400 });
  }

  let entry: { label: string; rawText: string };
  try {
    entry = formatLastfm(await fetchLastfm(username));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Last.fm fetch failed.";
    const isKey = msg.includes("LASTFM_API_KEY");
    return NextResponse.json({ error: msg }, { status: isKey ? 400 : 502 });
  }

  const result = await createEntry({
    constellationId: body.constellationId,
    source: "lastfm",
    label: entry.label,
    rawText: entry.rawText,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({
    constellationId: result.constellationId,
    entryId: result.entryId,
  });
}

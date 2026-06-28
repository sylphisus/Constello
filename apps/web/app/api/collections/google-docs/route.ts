import { NextResponse } from "next/server";
import { fetchGoogleDoc, formatGoogleDoc } from "@/lib/collections/google-docs";
import { createEntry } from "@/lib/collections/entries";

export const runtime = "nodejs";

// POST { constellationId?, docId, accessToken } → pull the picked Google Doc's
// text (the token comes from the client-side Picker grant), format it into one
// entry (stored pending), and return the constellation id. The token is used
// once and not stored.
export async function POST(req: Request) {
  let body: { constellationId?: string; docId?: string; accessToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const docId = (body.docId ?? "").trim();
  const accessToken = (body.accessToken ?? "").trim();
  if (!docId || !accessToken) {
    return NextResponse.json(
      { error: "A connected Google Doc is required." },
      { status: 400 },
    );
  }

  let entry: { label: string; rawText: string };
  try {
    entry = formatGoogleDoc(await fetchGoogleDoc(accessToken, docId));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Google Docs import failed.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const result = await createEntry({
    constellationId: body.constellationId,
    source: "google-docs",
    label: entry.label,
    rawText: entry.rawText,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({
    constellationId: result.constellationId,
    entryId: result.entryId,
  });
}

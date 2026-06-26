import { NextResponse } from "next/server";
import { formatTwitter, type TwitterData } from "@/lib/collections/twitter";
import { createEntry } from "@/lib/collections/entries";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

// POST { constellationId?, data: TwitterData } → format a locally-scraped X/Twitter
// capture into one entry (stored pending) and return the constellation id.
//
// This is the "local bridge": scraping happens off-platform (the twitter-preservation
// tool, where the session cookie safely lives) and the normalized capture is pushed
// here. The deployed app never scrapes and never holds a cookie. Gated by the admin
// Basic-auth middleware, same as the other /api/admin/* writers.
export async function POST(req: Request) {
  let body: { constellationId?: string; data?: TwitterData };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const data = body.data;
  const handle = data?.profile?.handle?.trim();
  if (!handle || !Array.isArray(data?.tweets)) {
    return NextResponse.json(
      { error: "data.profile.handle and data.tweets are required." },
      { status: 400 },
    );
  }

  const entry = formatTwitter(data);
  const constellationId = (body.constellationId ?? "").trim();

  // If pushing into a known constellation, fill an existing X entry for this handle
  // (e.g. the placeholder a public submission queued) rather than inserting a
  // duplicate. Matched case-insensitively on label so handle casing doesn't fork it.
  if (constellationId) {
    const db = supabase();
    if (db) {
      const { data: rows } = await db
        .from("entries")
        .select("id, label")
        .eq("constellation_id", constellationId)
        .eq("source", "twitter");
      const match = (rows ?? []).find(
        (r) => (r.label ?? "").toLowerCase() === entry.label.toLowerCase(),
      );
      if (match) {
        const { error } = await db
          .from("entries")
          .update({ label: entry.label, raw_text: entry.rawText })
          .eq("id", match.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 502 });
        return NextResponse.json({
          constellationId,
          entryId: match.id,
          tweets: data.tweets.length,
          updated: true,
        });
      }
    }
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
    tweets: data.tweets.length,
  });
}

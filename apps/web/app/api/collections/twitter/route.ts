import { NextResponse } from "next/server";
import { createEntry } from "@/lib/collections/entries";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

// POST { constellationId?, handle } → queue an X / Twitter handle as a pending
// entry. The deployed app does NOT scrape (see lib/collections/twitter.ts): the
// post material is filled in later, off-platform, by the local bridge
// (constello-x → /api/admin/ingest-twitter), which reconciles into THIS entry by
// matching its label. Until then the handle sits in the pending queue as
// "being read…", so a submission is never lost.
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

  // Label MUST match formatTwitter's `X · @<handle>` so the later bridge push
  // reconciles into this entry instead of creating a duplicate.
  const result = await createEntry({
    constellationId: body.constellationId,
    source: "twitter",
    label: `X · @${handle}`,
    rawText: `Pending X / Twitter capture for @${handle}. Posts are added off-platform by the local bridge.`,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  // The handle doubles as a notification contact, but stays UNVERIFIED until it's
  // confirmed to follow @constello (the follow gate in lib/notify). Notifications
  // are a public @mention — the knock only, never the bearer link. Best-effort.
  const db = supabase();
  if (db) {
    await db.from("contacts").upsert(
      { constellation_id: result.constellationId, channel: "twitter", address: `@${handle}`, verified: false },
      { onConflict: "constellation_id,channel,address" },
    );
  }

  return NextResponse.json({
    constellationId: result.constellationId,
    entryId: result.entryId,
    pending: true,
  });
}

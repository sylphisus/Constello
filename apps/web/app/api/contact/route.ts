import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

// POST { constellationId, channel, address } → register a contact so the person
// is notified when their reading lands. Public (people opt themselves in). Email
// is the common case from the constellation page; twitter is auto-captured from
// the X tab; imessage arrives via the inbound webhook.
const CHANNELS = new Set(["email", "imessage", "twitter"]);

export async function POST(req: Request) {
  let body: { constellationId?: string; channel?: string; address?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const constellationId = (body.constellationId ?? "").trim();
  const channel = (body.channel ?? "").trim();
  const address = (body.address ?? "").trim();
  if (!constellationId || !CHANNELS.has(channel) || !address) {
    return NextResponse.json(
      { error: "constellationId, channel, address are required." },
      { status: 400 },
    );
  }

  const db = supabase();
  if (!db) return NextResponse.json({ error: "No persistence." }, { status: 500 });

  const { error } = await db.from("contacts").upsert(
    { constellation_id: constellationId, channel, address, verified: channel === "email" },
    { onConflict: "constellation_id,channel,address" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 502 });

  return NextResponse.json({ ok: true });
}

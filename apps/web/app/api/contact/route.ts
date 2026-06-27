import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { resolveMember } from "@/lib/notify/discord";

export const runtime = "nodejs";

// POST { constellationId, channel, address } → register a contact so the person
// is notified when their reading lands. Public (people opt themselves in). Email
// is the common case from the constellation page; twitter is the typed X handle;
// discord is a typed username we resolve to a server member. `imessage` is NOT
// accepted here on purpose — it's created only by the inbound webhook (the "text
// us first" consent), so we can never cold-text a number that didn't message us.
const CHANNELS = new Set(["email", "twitter", "discord"]);

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

  // Per-channel address + consent gate. Email is verified on opt-in; twitter
  // stays unverified until the follow gate; discord resolves the typed username
  // to a snowflake id and is verified iff that id is a member of the mutual
  // server (we store the id, not the username, so a rename can't break the ping).
  let storeAddress = address;
  let verified = channel === "email";
  if (channel === "discord") {
    const id = await resolveMember(address);
    if (id) {
      storeAddress = id;
      verified = true;
    }
  }

  const { error } = await db.from("contacts").upsert(
    { constellation_id: constellationId, channel, address: storeAddress, verified },
    { onConflict: "constellation_id,channel,address" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 502 });

  return NextResponse.json({ ok: true, verified });
}

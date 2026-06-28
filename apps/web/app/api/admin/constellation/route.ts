import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

// DELETE { constellationId } → erase a whole constellation and everything under it.
// Every dependent table (entries, readings, essences, contacts, notifications)
// is `on delete cascade` on constellations(id), and discord_messages is
// `on delete set null`, so dropping the one row tears down the world cleanly.
// Unlike /api/admin/entry this does delete readings — it's the explicit "remove
// this constellation" action, used for test/junk worlds.
export async function DELETE(req: Request) {
  let body: { constellationId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const constellationId = (body.constellationId ?? "").trim();
  if (!constellationId) {
    return NextResponse.json({ error: "constellationId is required." }, { status: 400 });
  }

  const db = supabase();
  if (!db) return NextResponse.json({ error: "No persistence." }, { status: 500 });

  const { error } = await db.from("constellations").delete().eq("id", constellationId);
  if (error) return NextResponse.json({ error: error.message }, { status: 502 });

  return NextResponse.json({ ok: true });
}

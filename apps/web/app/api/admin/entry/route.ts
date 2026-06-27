import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

// DELETE { entryId } → drop a pending entry that never got a reading.
// For abandoned/mistaken queue items (e.g. a mistyped X handle). Refuses to
// delete an entry that already has a reading, so this can't silently orphan one.
export async function DELETE(req: Request) {
  let body: { entryId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const entryId = (body.entryId ?? "").trim();
  if (!entryId) {
    return NextResponse.json({ error: "entryId is required." }, { status: 400 });
  }

  const db = supabase();
  if (!db) return NextResponse.json({ error: "No persistence." }, { status: 500 });

  const { data: reading } = await db
    .from("readings")
    .select("entry_id")
    .eq("entry_id", entryId)
    .maybeSingle();
  if (reading) {
    return NextResponse.json(
      { error: "Entry already has a reading; not deleting." },
      { status: 409 },
    );
  }

  const { error } = await db.from("entries").delete().eq("id", entryId);
  if (error) return NextResponse.json({ error: error.message }, { status: 502 });

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { findDuplicateEntry } from "@/lib/collections/entries";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

// POST { constellationId?, label?, rawText } → store an entry as PENDING.
// No model call: readings are fulfilled by hand later (manual alpha). A new
// constellation is created when no id is given; otherwise the entry is attached
// to the existing one. Returns the constellation id so the client can route to
// /c/{constellationId}.
export async function POST(req: Request) {
  let body: { constellationId?: string; label?: string; rawText?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const rawText = (body.rawText ?? "").trim();
  const label = (body.label ?? "").trim();
  if (!rawText) {
    return NextResponse.json({ error: "An entry is required." }, { status: 400 });
  }

  const db = supabase();
  if (!db) {
    return NextResponse.json(
      { error: "Persistence is not configured." },
      { status: 500 },
    );
  }

  // Global duplicate guard: if this exact text already exists anywhere, route to
  // that constellation instead of creating a second entry.
  const dup = await findDuplicateEntry(db, "text", label, rawText);
  if (dup)
    return NextResponse.json({
      constellationId: dup.constellationId,
      entryId: dup.id,
      duplicate: true,
    });

  // Resolve or create the constellation this entry belongs to.
  let constellationId = (body.constellationId ?? "").trim();
  if (constellationId) {
    const { data, error } = await db
      .from("constellations")
      .select("id")
      .eq("id", constellationId)
      .maybeSingle();
    if (error) return NextResponse.json({ error: "Lookup failed." }, { status: 502 });
    if (!data)
      return NextResponse.json({ error: "Unknown constellation." }, { status: 404 });
  } else {
    const { data, error } = await db
      .from("constellations")
      .insert({})
      .select("id")
      .single();
    if (error || !data)
      return NextResponse.json(
        { error: "Could not create constellation." },
        { status: 502 },
      );
    constellationId = data.id;
  }

  const { data: entry, error: entryErr } = await db
    .from("entries")
    .insert({ constellation_id: constellationId, label, raw_text: rawText })
    .select("id")
    .single();
  if (entryErr || !entry) {
    // The unique backstop (entries_text_uniq) caught a race the pre-insert guard
    // missed: re-run the lookup and route to the winner.
    if (entryErr?.code === "23505") {
      const won = await findDuplicateEntry(db, "text", label, rawText);
      if (won)
        return NextResponse.json({
          constellationId: won.constellationId,
          entryId: won.id,
          duplicate: true,
        });
    }
    return NextResponse.json({ error: "Could not save entry." }, { status: 502 });
  }

  return NextResponse.json({ constellationId, entryId: entry.id });
}

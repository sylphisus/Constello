import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { notifyReadingReady } from "@/lib/notify";

export const runtime = "nodejs";

// POST { constellationId, artifact } → store/replace the cross-entry essence.
// One current essence per constellation (upsert on constellation_id).
export async function POST(req: Request) {
  let body: { constellationId?: string; artifact?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const constellationId = (body.constellationId ?? "").trim();
  const artifact = (body.artifact ?? "").trim();
  if (!constellationId || !artifact) {
    return NextResponse.json(
      { error: "constellationId and artifact are required." },
      { status: 400 },
    );
  }

  const db = supabase();
  if (!db) return NextResponse.json({ error: "No persistence." }, { status: 500 });

  const { error } = await db.from("essences").upsert(
    { constellation_id: constellationId, artifact, updated_at: new Date().toISOString() },
    { onConflict: "constellation_id" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 502 });

  // Notify the person their essence landed (best-effort; never fails the save).
  try {
    await notifyReadingReady({ constellationId, kind: "essence", ref: constellationId });
  } catch (err) {
    console.error("[admin/essence] notify failed:", err);
  }

  return NextResponse.json({ ok: true });
}

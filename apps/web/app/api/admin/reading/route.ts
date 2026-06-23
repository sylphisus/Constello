import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

// POST { entryId, artifact } → store the hand-fulfilled reading for an entry.
// upsert on entry_id so re-pasting replaces a prior reading.
//
// TODO (embed phase): after saving, embed the artifact with voyage-4-large,
// (re)compute the constellation's signature, and append the prior signature to
// signature_history so old links redirect. Deferred until matching is wired.
export async function POST(req: Request) {
  let body: { entryId?: string; artifact?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const entryId = (body.entryId ?? "").trim();
  const artifact = (body.artifact ?? "").trim();
  if (!entryId || !artifact) {
    return NextResponse.json(
      { error: "entryId and artifact are required." },
      { status: 400 },
    );
  }

  const db = supabase();
  if (!db) return NextResponse.json({ error: "No persistence." }, { status: 500 });

  const { error } = await db
    .from("readings")
    .upsert({ entry_id: entryId, artifact }, { onConflict: "entry_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 502 });

  return NextResponse.json({ ok: true });
}

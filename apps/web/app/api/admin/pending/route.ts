import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

// GET → the fulfillment queues for the admin view:
//  - pending: entries with no reading yet (one Opus call each, run by hand)
//  - essenceQueue: constellations with ≥2 readings (eligible for a cross-entry essence)
export async function GET() {
  const db = supabase();
  if (!db) return NextResponse.json({ error: "No persistence." }, { status: 500 });

  const { data: entries } = await db
    .from("entries")
    .select("id, constellation_id, label, raw_text, created_at")
    .order("created_at", { ascending: true });
  const { data: readings } = await db.from("readings").select("entry_id");
  const { data: essences } = await db.from("essences").select("constellation_id");

  const fulfilled = new Set((readings ?? []).map((r) => r.entry_id));
  const pending = (entries ?? []).filter((e) => !fulfilled.has(e.id));

  const readingsPerConstellation = new Map<string, number>();
  for (const e of entries ?? []) {
    if (fulfilled.has(e.id)) {
      readingsPerConstellation.set(
        e.constellation_id,
        (readingsPerConstellation.get(e.constellation_id) ?? 0) + 1,
      );
    }
  }
  const hasEssence = new Set((essences ?? []).map((x) => x.constellation_id));
  const essenceQueue = [...readingsPerConstellation.entries()]
    .filter(([, n]) => n >= 2)
    .map(([constellationId, readings]) => ({
      constellationId,
      readings,
      hasEssence: hasEssence.has(constellationId),
    }));

  return NextResponse.json({ pending, essenceQueue });
}

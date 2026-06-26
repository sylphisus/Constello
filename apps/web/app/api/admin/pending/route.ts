import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

// GET → everything the admin console needs in one call:
//  - stats:        population totals at a glance
//  - constellations: the full roster (every world, with status), newest first
//  - pending:       entries with no reading yet (one Opus call each, by hand)
//  - essenceQueue:  constellations with ≥2 readings (eligible for an essence)
export async function GET() {
  const db = supabase();
  if (!db) return NextResponse.json({ error: "No persistence." }, { status: 500 });

  const { data: constellations } = await db
    .from("constellations")
    .select("id, signature, created_at");
  const { data: entries } = await db
    .from("entries")
    .select("id, constellation_id, source, label, raw_text, created_at")
    .order("created_at", { ascending: true });
  const { data: readings } = await db.from("readings").select("entry_id");
  const { data: essences } = await db.from("essences").select("constellation_id");
  // Twitter handles awaiting a follow-check before any public @mention can go out.
  const { data: unverifiedTwitter } = await db
    .from("contacts")
    .select("id, constellation_id, address, created_at")
    .eq("channel", "twitter")
    .eq("verified", false)
    .order("created_at", { ascending: true });

  const fulfilled = new Set((readings ?? []).map((r) => r.entry_id));
  const hasEssence = new Set((essences ?? []).map((x) => x.constellation_id));
  const pending = (entries ?? []).filter((e) => !fulfilled.has(e.id));

  // Per-constellation rollups, keyed by id.
  type Roll = { entries: number; readings: number; sources: Set<string> };
  const roll = new Map<string, Roll>();
  for (const e of entries ?? []) {
    const r = roll.get(e.constellation_id) ?? { entries: 0, readings: 0, sources: new Set() };
    r.entries += 1;
    r.sources.add(e.source);
    if (fulfilled.has(e.id)) r.readings += 1;
    roll.set(e.constellation_id, r);
  }

  const roster = (constellations ?? [])
    .map((c) => {
      const r = roll.get(c.id);
      return {
        id: c.id,
        createdAt: c.created_at,
        signature: c.signature as string | null,
        entries: r?.entries ?? 0,
        readings: r?.readings ?? 0,
        sources: r ? [...r.sources].sort() : [],
        hasEssence: hasEssence.has(c.id),
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const essenceQueue = [...roll.entries()]
    .filter(([, r]) => r.readings >= 2)
    .map(([constellationId, r]) => ({
      constellationId,
      readings: r.readings,
      hasEssence: hasEssence.has(constellationId),
    }));

  const stats = {
    constellations: (constellations ?? []).length,
    entries: (entries ?? []).length,
    readings: (readings ?? []).length,
    pending: pending.length,
    essences: (essences ?? []).length,
  };

  const pendingFollows = (unverifiedTwitter ?? []).map((c) => ({
    contactId: c.id,
    constellationId: c.constellation_id,
    handle: c.address,
    createdAt: c.created_at,
  }));

  return NextResponse.json({
    stats,
    constellations: roster,
    pending,
    essenceQueue,
    pendingFollows,
  });
}

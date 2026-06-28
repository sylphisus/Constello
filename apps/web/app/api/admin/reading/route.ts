import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { notifyReadingReady } from "@/lib/notify";
import { embedReading } from "@/lib/embed";
import { parseEmbedding, signatureFromEmbeddings } from "@/lib/signature";

export const runtime = "nodejs";

// POST { entryId, artifact } → store the hand-fulfilled reading for an entry.
// upsert on entry_id so re-pasting replaces a prior reading.
//
// On save we also embed the artifact (voyage-4-large) and recompute the
// constellation's signature — its live star-coordinate "shape" derived from all
// its reading embeddings (lib/signature). The new signature becomes the
// constellation's URL; the prior coordinate simply stops resolving (people
// re-find via the map or by re-entering a collection). All embedding work is
// best-effort: a missing VOYAGE_API_KEY just leaves the reading without a vector
// and the signature unchanged.
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

  // Embed the artifact (the "world") before saving. Null if unconfigured/failed —
  // the reading still saves, just without a vector, and the signature won't move.
  const vector = await embedReading(artifact);
  const row: { entry_id: string; artifact: string; embedding?: number[] } = {
    entry_id: entryId,
    artifact,
  };
  if (vector) row.embedding = vector;

  const { error } = await db
    .from("readings")
    .upsert(row, { onConflict: "entry_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 502 });

  // This reading reflects the current material — clear any pending re-read flag so
  // the entry drops out of the queue (a no-op for sources that never set it).
  await db.from("entries").update({ needs_reread: false }).eq("id", entryId);

  // Which constellation does this entry belong to? Needed for both the signature
  // recompute and the notification.
  const { data: entry } = await db
    .from("entries")
    .select("constellation_id")
    .eq("id", entryId)
    .maybeSingle();
  const constellationId = entry?.constellation_id as string | undefined;

  // Recompute the signature from every embedded reading in this constellation
  // (best-effort; never fails the save).
  if (constellationId) {
    try {
      await recomputeSignature(db, constellationId);
    } catch (err) {
      console.error("[admin/reading] signature recompute failed:", err);
    }
  }

  // Notify the person their reading landed (best-effort; never fails the save).
  try {
    if (constellationId) {
      await notifyReadingReady({
        constellationId,
        kind: "reading",
        ref: entryId,
      });
    }
  } catch (err) {
    console.error("[admin/reading] notify failed:", err);
  }

  return NextResponse.json({ ok: true });
}

// Derive the constellation's star-coordinate signature from all its embedded
// readings and point the constellation at it.
//
// Two constellations can round to the same coordinate (similar worlds land near
// each other — see lib/signature). When that happens it's a real, mutual event,
// so BOTH wear a suffix: the pair becomes base-1 and base-2 (and -3…), not
// "winner keeps base, loser gets -2". A constellation alone at a coordinate stays
// bare — the suffix only marks an actual overlap.
//
// Uniqueness is enforced by the DB index on constellations.signature, checked
// against *live* signatures only (a vacated coordinate frees up). That index also
// makes assignment race-safe: if a simultaneous writer takes our target first the
// update fails with 23505 and we recompute the next free index and retry.
async function recomputeSignature(
  db: NonNullable<ReturnType<typeof supabase>>,
  constellationId: string,
) {
  const { data: ents } = await db
    .from("entries")
    .select("id")
    .eq("constellation_id", constellationId);
  const entryIds = (ents ?? []).map((e) => e.id);
  if (!entryIds.length) return;

  const { data: rds } = await db
    .from("readings")
    .select("embedding")
    .in("entry_id", entryIds);

  const embeddings = (rds ?? [])
    .map((r) => parseEmbedding(r.embedding))
    .filter((e): e is number[] => e !== null);

  const base = signatureFromEmbeddings(embeddings);
  if (!base) return;

  const { data: cur } = await db
    .from("constellations")
    .select("signature")
    .eq("id", constellationId)
    .maybeSingle();
  const currentSig = cur?.signature ?? null;

  for (let attempt = 0; attempt < 16; attempt++) {
    const peers = await peersAt(db, base, constellationId);

    let target: string;
    if (peers.length === 0) {
      target = base; // alone → bare coordinate
    } else {
      // Pull any still-bare peer into the pair (base → base-1), then take my own
      // suffix beside them. Promotion is best-effort; the unique index keeps it
      // safe under contention.
      for (const p of peers) {
        if (p.signature === base) {
          const promoted = nextIndexSig(base, peers.filter((x) => x.id !== p.id));
          await db.from("constellations").update({ signature: promoted }).eq("id", p.id);
        }
      }
      target = nextIndexSig(base, await peersAt(db, base, constellationId));
    }

    if (target === currentSig) return;

    const { error } = await db
      .from("constellations")
      .update({ signature: target })
      .eq("id", constellationId);
    if (!error) return;
    if (error.code !== "23505") throw new Error(error.message); // not the race → real failure
    // 23505: someone took `target` first — loop, recompute the next free index.
  }
}

// Live constellations sitting on this coordinate cell (the bare base or a base-N
// suffix), excluding the given one.
async function peersAt(
  db: NonNullable<ReturnType<typeof supabase>>,
  base: string,
  excludeId: string,
): Promise<{ id: string; signature: string }[]> {
  const { data } = await db
    .from("constellations")
    .select("id, signature")
    .like("signature", `${base}%`)
    .neq("id", excludeId);
  const re = new RegExp(`^${escapeRegExp(base)}-\\d+$`);
  return (data ?? [])
    .filter((p) => p.signature === base || (p.signature && re.test(p.signature)))
    .map((p) => ({ id: p.id, signature: p.signature as string }));
}

// Smallest base-N (N ≥ 1) not already held by one of these peers.
function nextIndexSig(base: string, peers: { signature: string }[]): string {
  const used = new Set(
    peers
      .map((p) => p.signature.slice(base.length).match(/^-(\d+)$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => parseInt(m[1], 10)),
  );
  let n = 1;
  while (used.has(n)) n++;
  return `${base}-${n}`;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AddEntry from "./AddEntry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // pending → fulfilled should always be fresh

// A constellation: its fulfilled readings (each rendered as its own sealed
// world) and its pending pieces. The uuid is the stable link the person returns
// to; the signature (the live shape) appears once it's been read + embedded.
export default async function ConstellationPage({
  params,
}: {
  params: Promise<{ constellationId: string }>;
}) {
  const { constellationId } = await params;
  const db = supabase();
  if (!db) {
    return (
      <main className="wrap">
        <p className="error">Persistence not configured.</p>
      </main>
    );
  }

  const { data: constellation } = await db
    .from("constellations")
    .select("id, signature, created_at")
    .eq("id", constellationId)
    .maybeSingle();
  if (!constellation) notFound();

  const { data: entries } = await db
    .from("entries")
    .select("id, label, raw_text, created_at")
    .eq("constellation_id", constellationId)
    .order("created_at", { ascending: true });

  const entryIds = (entries ?? []).map((e) => e.id);
  let readings: { entry_id: string; artifact: string }[] = [];
  if (entryIds.length) {
    const r = await db
      .from("readings")
      .select("entry_id, artifact")
      .in("entry_id", entryIds);
    readings = r.data ?? [];
  }
  const readingByEntry = new Map(readings.map((r) => [r.entry_id, r.artifact]));

  const { data: essence } = await db
    .from("essences")
    .select("artifact")
    .eq("constellation_id", constellationId)
    .maybeSingle();

  const fulfilled = (entries ?? []).filter((e) => readingByEntry.has(e.id)).length;
  const pending = (entries?.length ?? 0) - fulfilled;

  return (
    <main className="wrap">
      <div className="mark">
        <h1>Constello</h1>
        <p>{constellation.signature ?? "your constellation is still forming"}</p>
      </div>

      {essence?.artifact && (
        <section className="section-gap">
          <p className="essence-eyebrow">Your essence</p>
          <iframe sandbox="" srcDoc={essence.artifact} title="essence" style={frame} />
        </section>
      )}

      {(entries ?? []).map((e) => {
        const artifact = readingByEntry.get(e.id);
        return (
          <article className="section-gap" key={e.id}>
            {e.label && <p className="essence-eyebrow">{e.label}</p>}
            {artifact ? (
              <iframe
                sandbox=""
                srcDoc={artifact}
                title={e.label || "reading"}
                style={frame}
              />
            ) : (
              <p className="thinking">being read…</p>
            )}
          </article>
        );
      })}

      <AddEntry constellationId={constellationId} />

      <p className="persist-flag">
        {fulfilled} read · {pending} pending · this link is your constellation —
        return to it
      </p>
    </main>
  );
}

const frame: CSSProperties = {
  width: "100%",
  height: 640,
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 12,
  background: "transparent",
};

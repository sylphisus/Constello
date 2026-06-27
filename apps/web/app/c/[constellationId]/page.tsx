import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { buildReadingDoc } from "@/lib/reading-doc";
import AddEntry from "./AddEntry";
import NotifyMe from "./NotifyMe";
import ReadingFrame from "./ReadingFrame";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // pending → fulfilled should always be fresh

// A constellation: its fulfilled readings (each artifact sealed in its own
// themed iframe — see ReadingFrame) and its pending pieces. The uuid is the
// stable link the person returns to; the signature (the live shape) appears once it's
// been read + embedded.
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
        <section className="essence-block">
          <p className="essence-eyebrow">Your essence</p>
          <ReadingFrame doc={buildReadingDoc(essence.artifact)} title="essence" />
        </section>
      )}

      {(entries ?? []).map((e) => {
        const artifact = readingByEntry.get(e.id);
        return (
          <article className="reading-card" key={e.id}>
            {e.label && <p className="essence-eyebrow">{e.label}</p>}
            {artifact ? (
              <ReadingFrame doc={buildReadingDoc(artifact)} title={e.label || "reading"} />
            ) : (
              <p className="thinking">being read…</p>
            )}
          </article>
        );
      })}

      <AddEntry constellationId={constellationId} />

      <NotifyMe
        constellationId={constellationId}
        imessageNumber={process.env.IMESSAGE_NUMBER}
        discordEnabled={Boolean(
          process.env.DISCORD_BOT_TOKEN &&
            process.env.DISCORD_GUILD_ID &&
            process.env.DISCORD_CHANNEL_ID,
        )}
      />

      <p className="persist-flag">
        {fulfilled} read · {pending} pending · this link is your constellation —
        return to it
      </p>
    </main>
  );
}

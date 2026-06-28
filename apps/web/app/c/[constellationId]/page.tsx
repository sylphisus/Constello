import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { buildReadingDoc } from "@/lib/reading-doc";
import { isUuid, baseCoordinate } from "@/lib/signature";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { matchSummary } from "@/lib/sky";
import AddEntry from "./AddEntry";
import NotifyMe from "./NotifyMe";
import PasswordGate from "./PasswordGate";
import ReadingFrame from "./ReadingFrame";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // pending → fulfilled should always be fresh

// A constellation is reachable by two kinds of link: its uuid (the stable link
// the person first gets) and its signature — the live star-coordinate shape it
// earns once it's been read + embedded (lib/signature). Once a signature exists
// it becomes the canonical URL: the uuid redirects to it, so a person's link
// always reflects the world they've built. A superseded signature isn't kept —
// it stops resolving, and the person re-finds their constellation via the map or
// by re-entering one of their collections.
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

  // The path segment is either a uuid or a signature. A signature resolves to
  // whoever currently holds it; a superseded one just 404s (no history). Querying
  // constellations.id with a non-uuid would be a Postgres type error, so branch.
  let resolvedId = constellationId;
  if (!isUuid(constellationId)) {
    const { data: holder } = await db
      .from("constellations")
      .select("id")
      .eq("signature", constellationId)
      .maybeSingle();
    if (!holder) notFound();
    resolvedId = holder.id;
  }

  const { data: constellation } = await db
    .from("constellations")
    .select("id, signature, created_at, password_hash")
    .eq("id", resolvedId)
    .maybeSingle();
  if (!constellation) notFound();

  // Canonicalize: once a signature exists, that's the URL. Redirect the uuid and
  // any superseded signature to the current one.
  if (constellation.signature && constellationId !== constellation.signature) {
    redirect(`/c/${constellation.signature}`);
  }

  // A constellation is private: only its owner (a session vouching for this id)
  // can open it. Everyone else — including someone who has the link — gets the
  // gate, which sets the password on first arrival (claim) or checks it after.
  const session = verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (session !== resolvedId) {
    return (
      <PasswordGate
        constellationId={resolvedId}
        hasPassword={Boolean(constellation.password_hash)}
      />
    );
  }

  const { data: entries } = await db
    .from("entries")
    .select("id, label, raw_text, created_at")
    .eq("constellation_id", resolvedId)
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
    .eq("constellation_id", resolvedId)
    .maybeSingle();

  const fulfilled = (entries ?? []).filter((e) => readingByEntry.has(e.id)).length;
  const pending = (entries?.length ?? 0) - fulfilled;

  // How many of your collections rhyme with someone else's (full-dim cosine).
  // The where — which constellations — lives on the sky.
  const sum = await matchSummary(resolvedId);
  const sumParts = [
    sum.exact > 0 ? `${sum.exact} exact` : null,
    sum.near > 0 ? `${sum.near} nearly identical` : null,
  ].filter(Boolean);

  // Anyone else sitting on this exact coordinate cell? (other constellations whose
  // signature is the bare base or a base-N suffix). If so, this is a real overlap —
  // both wear the suffix and we surface the link to the other world.
  let matches: { id: string; signature: string }[] = [];
  if (constellation.signature) {
    const base = baseCoordinate(constellation.signature);
    const { data: peerRows } = await db
      .from("constellations")
      .select("id, signature")
      .like("signature", `${base}%`)
      .neq("id", resolvedId);
    const suffixRe = new RegExp(
      `^${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-\\d+$`,
    );
    matches = (peerRows ?? [])
      .filter((p) => p.signature === base || (p.signature && suffixRe.test(p.signature)))
      .map((p) => ({ id: p.id, signature: p.signature as string }));
  }

  // The coordinate is the person's address — show it directly. On an overlap the
  // suffix turns gold and explains itself on hover, with a link to the twin world.
  let coordEl: ReactNode;
  if (!constellation.signature) {
    coordEl = <p>your constellation is still forming</p>;
  } else if (matches.length === 0) {
    coordEl = <p>{constellation.signature}</p>;
  } else {
    const base = baseCoordinate(constellation.signature);
    const suffix = constellation.signature.slice(base.length);
    coordEl = (
      <p>
        {base}
        <span className="coord-overlap">
          <span className="coord-suffix">{suffix}</span>
          <span className="coord-pop">
            {matches.length > 1
              ? `${matches.length} other constellations landed on this exact coordinate`
              : "another constellation landed on this exact coordinate"}{" "}
            — a rare overlap in the embedding sky. <a href="/sky">see the sky →</a>
          </span>
        </span>
      </p>
    );
  }

  return (
    <main className="wrap">
      <div className="mark">
        <h1>Constello</h1>
        {coordEl}
      </div>

      {sumParts.length > 0 && (
        <p className="match-summary">
          <a className="text-link" href="/sky">
            {sumParts.join(" · ")}{" "}
            {sum.exact + sum.near === 1 ? "match" : "matches"} with others — see the sky →
          </a>
        </p>
      )}

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

      <AddEntry constellationId={resolvedId} />

      <NotifyMe
        constellationId={resolvedId}
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

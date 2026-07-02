import { supabase } from "@/lib/supabase";
import type { EntrySource } from "@/lib/types";

// Shared "resolve-or-create constellation, then attach one entry" used by the
// API-backed collection routes (lastfm, twitter). Mirrors /api/submit's logic;
// kept here so each new source route stays a thin fetch → format → createEntry.

export type CreateEntryResult =
  | { ok: true; constellationId: string; entryId: string; duplicate?: boolean }
  | { ok: false; status: number; error: string };

// Sources that carry a global identity in their deterministic label (`X ·
// @handle`, `Last.fm · user`, …) — the same identity is the same collection, so
// these dedupe by label. This MUST mirror the DB backstop `entries_label_uniq`
// (db/migration.collections.sql). 'text', 'images', and 'apple-notes' are
// deliberately absent: they carry no global identity — each is its own world —
// so they never auto-merge across people (matching: no DB constraint for them).
const LABEL_IDENTITY_SOURCES: ReadonlySet<EntrySource> = new Set([
  "lastfm",
  "twitter",
  "pinterest",
  "spotify",
  "obsidian",
  "google-docs",
  "notion",
]);

// Find the entry (and its constellation) that already holds this collection, or
// null. Identity-source duplicates match on label; 'text' on its raw body; the
// remaining own-world sources have no global identity, so never report a dup.
export async function findDuplicateEntry(
  db: NonNullable<ReturnType<typeof supabase>>,
  source: EntrySource,
  label: string,
  rawText: string,
): Promise<{ id: string; constellationId: string } | null> {
  let q = db
    .from("entries")
    .select("id, constellation_id")
    .eq("source", source)
    .limit(1);
  if (source === "text") {
    q = q.eq("raw_text", rawText);
  } else if (LABEL_IDENTITY_SOURCES.has(source)) {
    // `ilike` (no wildcards) is a case-insensitive exact match, so @Sylphie and
    // @sylphie collapse.
    q = q.ilike("label", label);
  } else {
    return null; // images, apple-notes: own world, never auto-merge.
  }
  const { data } = await q.maybeSingle();
  return data ? { id: data.id, constellationId: data.constellation_id } : null;
}

export async function createEntry(input: {
  constellationId?: string;
  source: EntrySource;
  label: string;
  rawText: string;
}): Promise<CreateEntryResult> {
  const db = supabase();
  if (!db) return { ok: false, status: 500, error: "Persistence is not configured." };

  // Global duplicate guard: if this exact collection already exists anywhere,
  // route to that constellation instead of creating a second entry. Some sources
  // are exempt — they carry no global identity (their label is a generic title),
  // so every one is its own world: arbitrary `images`, and `apple-notes`
  // (recreated by hand, no stable handle/URL to dedupe on).
  const dup =
    input.source === "images" || input.source === "apple-notes"
      ? null
      : await findDuplicateEntry(db, input.source, input.label, input.rawText);
  if (dup)
    return { ok: true, constellationId: dup.constellationId, entryId: dup.id, duplicate: true };

  let constellationId = (input.constellationId ?? "").trim();
  if (constellationId) {
    const { data, error } = await db
      .from("constellations")
      .select("id")
      .eq("id", constellationId)
      .maybeSingle();
    if (error) return { ok: false, status: 502, error: "Lookup failed." };
    if (!data) return { ok: false, status: 404, error: "Unknown constellation." };
  } else {
    const { data, error } = await db
      .from("constellations")
      .insert({})
      .select("id")
      .single();
    if (error || !data)
      return { ok: false, status: 502, error: "Could not create constellation." };
    constellationId = data.id;
  }

  const { data: entry, error: entryErr } = await db
    .from("entries")
    .insert({
      constellation_id: constellationId,
      source: input.source,
      label: input.label,
      raw_text: input.rawText,
    })
    .select("id")
    .single();
  if (entryErr || !entry) {
    // The unique backstop (entries_label_uniq/entries_text_uniq) caught a race
    // the pre-insert guard missed: re-run the lookup and route to the winner.
    if (entryErr?.code === "23505") {
      const won = await findDuplicateEntry(db, input.source, input.label, input.rawText);
      if (won)
        return { ok: true, constellationId: won.constellationId, entryId: won.id, duplicate: true };
    }
    return { ok: false, status: 502, error: "Could not save entry." };
  }

  return { ok: true, constellationId, entryId: entry.id };
}

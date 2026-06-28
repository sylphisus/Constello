import { supabase } from "@/lib/supabase";
import type { EntrySource } from "@/lib/types";

// Shared "resolve-or-create constellation, then attach one entry" used by the
// API-backed collection routes (lastfm, twitter). Mirrors /api/submit's logic;
// kept here so each new source route stays a thin fetch → format → createEntry.

export type CreateEntryResult =
  | { ok: true; constellationId: string; entryId: string; duplicate?: boolean }
  | { ok: false; status: number; error: string };

// A collection's identity, used to dedupe globally. The non-text sources carry
// it in their deterministic label (`X · @handle`, `Last.fm · user`, `Pinterest ·
// @user`); text has no reliable label, so the pasted body itself is the
// identity. Returns the entry
// (and its constellation) that already holds this collection, or null.
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
  // `ilike` (no wildcards) gives a case-insensitive exact match, so @Sylphie and
  // @sylphie collapse; text matches on the raw body instead.
  q = source === "text" ? q.eq("raw_text", rawText) : q.ilike("label", label);
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
  // route to that constellation instead of creating a second entry. Image
  // collections are exempt — arbitrary images carry no global identity (their
  // label is a generic title), so every one is its own world.
  const dup =
    input.source === "images"
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
  if (entryErr || !entry)
    return { ok: false, status: 502, error: "Could not save entry." };

  return { ok: true, constellationId, entryId: entry.id };
}

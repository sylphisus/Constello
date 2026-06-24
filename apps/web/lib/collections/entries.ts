import { supabase } from "@/lib/supabase";
import type { EntrySource } from "@/lib/types";

// Shared "resolve-or-create constellation, then attach one entry" used by the
// API-backed collection routes (lastfm, twitter). Mirrors /api/submit's logic;
// kept here so each new source route stays a thin fetch → format → createEntry.

export type CreateEntryResult =
  | { ok: true; constellationId: string; entryId: string }
  | { ok: false; status: number; error: string };

export async function createEntry(input: {
  constellationId?: string;
  source: EntrySource;
  label: string;
  rawText: string;
}): Promise<CreateEntryResult> {
  const db = supabase();
  if (!db) return { ok: false, status: 500, error: "Persistence is not configured." };

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

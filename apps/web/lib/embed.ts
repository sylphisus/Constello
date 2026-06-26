// Voyage embeddings for the constellation signal. Per the design thesis we
// embed the READING (the world someone is building), never the raw entry (the
// furniture). One vector per reading.
//
// Best-effort, like lib/supabase: if VOYAGE_API_KEY isn't set the reading still
// saves — it just lands without a vector and can be backfilled later.

const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";
const MODEL = "voyage-4-large";
export const EMBEDDING_DIM = 1024; // voyage-4-large default; matches readings.embedding vector(1024)

// The artifact is a self-contained markdown world; embed its meaning, not its
// syntax. Strip the lightweight markdown markers (and any stray inline HTML,
// which markdown passes through), keep link/image text, collapse whitespace.
function markdownToText(md: string): string {
  return md
    .replace(/<[^>]+>/g, " ") // stray inline HTML
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1") // links/images → their text
    .replace(/`{1,3}([^`]*)`{1,3}/g, "$1") // code spans/fences
    .replace(/^\s{0,3}#{1,6}\s+/gm, "") // headings
    .replace(/[*_~>#-]/g, " ") // emphasis, blockquote, list/rule markers
    .replace(/\s+/g, " ")
    .trim();
}

/** Embed a reading artifact. Returns the vector, or null if unconfigured/failed. */
export async function embedReading(artifact: string): Promise<number[] | null> {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) {
    console.warn("[embed] VOYAGE_API_KEY not set — reading saved without an embedding.");
    return null;
  }

  const input = markdownToText(artifact);
  if (!input) return null;

  try {
    const res = await fetch(VOYAGE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      // Voyage truncates over-length input by default (32K ctx), so no manual cap.
      body: JSON.stringify({
        model: MODEL,
        input,
        input_type: "document",
        output_dimension: EMBEDDING_DIM,
      }),
    });

    if (!res.ok) {
      console.error(`[embed] Voyage ${res.status}: ${await res.text()}`);
      return null;
    }

    const json = (await res.json()) as { data?: { embedding?: number[] }[] };
    const vec = json.data?.[0]?.embedding;
    return Array.isArray(vec) ? vec : null;
  } catch (err) {
    console.error("[embed] request failed:", err);
    return null;
  }
}

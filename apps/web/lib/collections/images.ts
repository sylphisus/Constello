import { randomUUID, createHash } from "crypto";
import { uploadImage } from "@/lib/storage";
import type { supabase } from "@/lib/supabase";

// Shared logic for the general image collection: the caps, what counts as a
// valid image, and the "upload bytes to R2 + insert one metadata row each" step
// used by both the create route and the editor (add). Validation and storage
// live here so each route stays a thin parse → validate → store.

export const MAX_PER_UPLOAD = 10; // images per single submit/add
export const MAX_PER_COLLECTION = 30; // total a collection can hold
export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB/image (matches the bucket cap)

// Web-renderable formats only — the owner sees these back and the hand-read
// views them in the browser, so e.g. HEIC (which browsers can't draw) is out.
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
export const ACCEPT = Object.keys(EXT).join(",");

/** Image files posted under the multipart field "images" (empty ones dropped). */
export function imageFilesFrom(form: FormData): File[] {
  return form.getAll("images").filter((v): v is File => v instanceof File && v.size > 0);
}

/** Null if the batch is acceptable, else a {status, error} the route returns. */
export function validateBatch(
  files: File[],
  existingCount: number,
): { status: number; error: string } | null {
  if (files.length === 0) return { status: 400, error: "Add at least one image." };
  if (files.length > MAX_PER_UPLOAD)
    return { status: 400, error: `Up to ${MAX_PER_UPLOAD} images at a time.` };
  if (existingCount + files.length > MAX_PER_COLLECTION)
    return {
      status: 400,
      error: `A collection holds up to ${MAX_PER_COLLECTION} images.`,
    };
  for (const f of files) {
    if (!EXT[f.type])
      return { status: 415, error: `${f.name || "A file"} isn't a JPEG, PNG, WebP, or GIF.` };
    if (f.size > MAX_FILE_BYTES)
      return { status: 413, error: `${f.name || "A file"} is over 10 MB.` };
  }
  return null;
}

type Db = NonNullable<ReturnType<typeof supabase>>;

// An image read off the wire once: its bytes, content type, and the SHA-256 that
// identifies it for exact-duplicate routing. Read each File a single time here so
// the dedupe check and the upload share the work.
export interface PreparedImage {
  bytes: Uint8Array;
  contentType: string;
  sha256: string;
}

export async function prepareImages(files: File[]): Promise<PreparedImage[]> {
  return Promise.all(
    files.map(async (file) => {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      return { bytes, contentType: file.type, sha256 };
    }),
  );
}

// Exact-duplicate lookup: if any of these hashes already exists, return the
// constellation (and the entry) that holds it — newest first. Used to route a
// re-submitted image back to its existing world instead of minting a new one.
export async function findConstellationByHashes(
  db: Db,
  hashes: string[],
): Promise<{ constellationId: string; entryId: string } | null> {
  if (!hashes.length) return null;
  const { data } = await db
    .from("entry_images")
    .select("entry_id, created_at, entries!inner(constellation_id)")
    .in("sha256", hashes)
    .order("created_at", { ascending: false })
    .limit(1);
  const row = data?.[0] as { entry_id: string; entries: { constellation_id: string } } | undefined;
  if (!row) return null;
  return { constellationId: row.entries.constellation_id, entryId: row.entry_id };
}

// Upload each prepared image to R2 under constellations/{cid}/{entryId}/… and
// insert one entry_images row per object, numbered from startPosition. Returns
// how many landed. Caller is responsible for validateBatch + the needs_reread
// flag (and the dedupe check, if routing is wanted).
export async function storeImages(
  db: Db,
  opts: {
    constellationId: string;
    entryId: string;
    items: PreparedImage[];
    startPosition: number;
  },
): Promise<number> {
  const rows: { entry_id: string; storage_path: string; sha256: string; position: number }[] = [];
  let position = opts.startPosition;
  for (const item of opts.items) {
    const ext = EXT[item.contentType];
    const path = `constellations/${opts.constellationId}/${opts.entryId}/${randomUUID()}.${ext}`;
    await uploadImage(path, item.bytes, item.contentType);
    rows.push({
      entry_id: opts.entryId,
      storage_path: path,
      sha256: item.sha256,
      position: position++,
    });
  }
  const { error } = await db.from("entry_images").insert(rows);
  if (error) throw new Error(error.message);
  return rows.length;
}

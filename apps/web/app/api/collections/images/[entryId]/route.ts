import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { deleteImage, storageConfigured } from "@/lib/storage";
import { imageFilesFrom, validateBatch, prepareImages, storeImages } from "@/lib/collections/images";

export const runtime = "nodejs";

// The image-collection editor (owner-only). Every mutation flips needs_reread on
// the entry, which re-surfaces it in the admin pending queue WITHOUT dropping the
// prior reading — the owner keeps seeing the old reading until the re-read lands.
// Editing again before that just leaves the flag set; the current image set is
// always what gets read next.
//
//   POST   multipart { images: File[] }  → add images to the collection
//   DELETE { imageId }                   → remove one image (bytes + row)

type Db = NonNullable<ReturnType<typeof supabase>>;

// Resolve the entry's owning constellation and confirm the caller holds a session
// for it. Returns the db + constellationId, or a NextResponse to return as-is.
async function authorize(
  entryId: string,
): Promise<{ db: Db; constellationId: string } | NextResponse> {
  const db = supabase();
  if (!db) return NextResponse.json({ error: "No persistence." }, { status: 500 });

  const { data: entry } = await db
    .from("entries")
    .select("constellation_id, source")
    .eq("id", entryId)
    .maybeSingle();
  if (!entry || entry.source !== "images")
    return NextResponse.json({ error: "No such image collection." }, { status: 404 });

  const session = verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (session !== entry.constellation_id)
    return NextResponse.json({ error: "Not your collection." }, { status: 403 });

  return { db, constellationId: entry.constellation_id };
}

async function queueReread(db: Db, entryId: string) {
  await db.from("entries").update({ needs_reread: true }).eq("id", entryId);
}

export async function POST(req: Request, ctx: { params: Promise<{ entryId: string }> }) {
  if (!storageConfigured())
    return NextResponse.json({ error: "Image storage is not configured." }, { status: 500 });

  const { entryId } = await ctx.params;
  const auth = await authorize(entryId);
  if (auth instanceof NextResponse) return auth;
  const { db, constellationId } = auth;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected a multipart upload." }, { status: 400 });
  }
  const files = imageFilesFrom(form);

  // Cap against what's already there, and append after the current last image.
  const { data: existing } = await db
    .from("entry_images")
    .select("position")
    .eq("entry_id", entryId)
    .order("position", { ascending: false })
    .limit(1);
  const { count } = await db
    .from("entry_images")
    .select("id", { count: "exact", head: true })
    .eq("entry_id", entryId);

  const bad = validateBatch(files, count ?? 0);
  if (bad) return NextResponse.json({ error: bad.error }, { status: bad.status });

  const startPosition = (existing?.[0]?.position ?? -1) + 1;
  try {
    const items = await prepareImages(files);
    await storeImages(db, { constellationId, entryId, items, startPosition });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed." },
      { status: 502 },
    );
  }

  await queueReread(db, entryId);
  return NextResponse.json({ added: files.length });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ entryId: string }> }) {
  const { entryId } = await ctx.params;
  const auth = await authorize(entryId);
  if (auth instanceof NextResponse) return auth;
  const { db } = auth;

  let body: { imageId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const imageId = (body.imageId ?? "").trim();
  if (!imageId) return NextResponse.json({ error: "imageId is required." }, { status: 400 });

  const { data: img } = await db
    .from("entry_images")
    .select("id, storage_path")
    .eq("id", imageId)
    .eq("entry_id", entryId) // scope to this entry so a stray id can't reach across
    .maybeSingle();
  if (!img) return NextResponse.json({ error: "No such image." }, { status: 404 });

  // Delete the bytes first; a dangling row is worse than an orphaned object.
  try {
    await deleteImage(img.storage_path);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Delete failed." },
      { status: 502 },
    );
  }
  await db.from("entry_images").delete().eq("id", imageId);

  await queueReread(db, entryId);
  return NextResponse.json({ ok: true });
}

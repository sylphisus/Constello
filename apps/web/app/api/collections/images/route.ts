import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createEntry } from "@/lib/collections/entries";
import {
  imageFilesFrom,
  validateBatch,
  prepareImages,
  findConstellationByHashes,
  storeImages,
} from "@/lib/collections/images";
import { storageConfigured } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

export const runtime = "nodejs";

// POST multipart { images: File[] (≤10), label?, constellationId? } → create a
// new image collection. The images are uploaded to R2; one pending entry is
// created and the reading is fulfilled by hand later (the images ARE the
// material). Adding to an EXISTING constellation requires owning it (a session
// for that id); a bare submit with no constellationId mints a new one, same as
// /api/submit.
export async function POST(req: Request) {
  if (!storageConfigured())
    return NextResponse.json({ error: "Image storage is not configured." }, { status: 500 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected a multipart upload." }, { status: 400 });
  }

  const files = imageFilesFrom(form);
  const bad = validateBatch(files, 0);
  if (bad) return NextResponse.json({ error: bad.error }, { status: bad.status });

  const label = String(form.get("label") ?? "").trim() || "Images";
  const constellationId = String(form.get("constellationId") ?? "").trim();

  // Only the owner can add to an existing constellation.
  if (constellationId) {
    const session = verifySession((await cookies()).get(SESSION_COOKIE)?.value);
    if (session !== constellationId)
      return NextResponse.json({ error: "Not your constellation." }, { status: 403 });
  }

  const db = supabase();
  if (!db) return NextResponse.json({ error: "No persistence." }, { status: 500 });

  // Read the bytes + hashes once. On a fresh submit (no constellationId), an
  // exact image we've seen before routes back to its existing constellation
  // instead of minting a new one — the same global-dedupe behaviour the other
  // sources get from their deterministic labels.
  const items = await prepareImages(files);
  if (!constellationId) {
    const dup = await findConstellationByHashes(
      db,
      items.map((i) => i.sha256),
    );
    if (dup)
      return NextResponse.json({
        constellationId: dup.constellationId,
        entryId: dup.entryId,
        duplicate: true,
      });
  }

  const result = await createEntry({
    constellationId: constellationId || undefined,
    source: "images",
    label,
    rawText: "Image collection — the images are the material (viewed in the console).",
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  try {
    await storeImages(db, {
      constellationId: result.constellationId,
      entryId: result.entryId,
      items,
      startPosition: 0,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed." },
      { status: 502 },
    );
  }

  return NextResponse.json({
    constellationId: result.constellationId,
    entryId: result.entryId,
  });
}

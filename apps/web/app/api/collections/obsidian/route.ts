import { NextResponse } from "next/server";
import { formatObsidian, type ObsidianFile } from "@/lib/collections/obsidian";
import { createEntry } from "@/lib/collections/entries";

export const runtime = "nodejs";

// Total upload guard — the client already filters to .md, but cap the payload so
// a giant vault can't post an unbounded body. ~4MB of markdown is a large vault.
const MAX_TOTAL_CHARS = 4_000_000;

// POST { constellationId?, vaultName, files: [{path, content}] } → format the
// vault into one entry (stored pending) and return the constellation id. Like
// every source, the reading is fulfilled by hand later.
export async function POST(req: Request) {
  let body: { constellationId?: string; vaultName?: string; files?: ObsidianFile[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const vaultName = (body.vaultName ?? "").trim() || "vault";
  const files = (Array.isArray(body.files) ? body.files : [])
    .filter((f) => f && typeof f.path === "string" && typeof f.content === "string");
  if (!files.length) {
    return NextResponse.json(
      { error: "No markdown notes found in that folder." },
      { status: 400 },
    );
  }

  const total = files.reduce((n, f) => n + f.content.length, 0);
  if (total > MAX_TOTAL_CHARS) {
    return NextResponse.json(
      { error: "That vault is too large to import in one go." },
      { status: 413 },
    );
  }

  const entry = formatObsidian({ vaultName, files });
  const result = await createEntry({
    constellationId: body.constellationId,
    source: "obsidian",
    label: entry.label,
    rawText: entry.rawText,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({
    constellationId: result.constellationId,
    entryId: result.entryId,
  });
}

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { isUuid } from "@/lib/signature";
import { hashPassword } from "@/lib/auth";

export const runtime = "nodejs";

// Admin-only (Basic auth via middleware). POST { constellationId, password } →
// recover a locked-out constellation. With a password, set it (hand it to the
// person); without one, clear it so the next visitor re-claims. See the
// auth-model: there's no self-serve reset, this is the recovery path.
export async function POST(req: Request) {
  let body: { constellationId?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const constellationId = (body.constellationId ?? "").trim();
  if (!isUuid(constellationId)) {
    return NextResponse.json({ error: "Bad constellation id." }, { status: 400 });
  }
  const password = body.password ?? "";

  const db = supabase();
  if (!db) return NextResponse.json({ error: "No persistence." }, { status: 500 });

  const { error } = await db
    .from("constellations")
    .update({ password_hash: password ? hashPassword(password) : null })
    .eq("id", constellationId);
  if (error) return NextResponse.json({ error: error.message }, { status: 502 });

  return NextResponse.json({ ok: true, mode: password ? "set" : "cleared" });
}

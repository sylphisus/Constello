import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

export const runtime = "nodejs";

// POST { constellationId, content } → queue an owner's chat message about their
// own constellation (its readings + essence). Owner-only: the session cookie
// must vouch for this constellation. No model call — the reply is fulfilled by
// hand from the admin console (manual alpha) and appears back in the thread.
export async function POST(req: Request) {
  let body: { constellationId?: string; content?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const constellationId = (body.constellationId ?? "").trim();
  const content = (body.content ?? "").trim();
  if (!constellationId || !content) {
    return NextResponse.json({ error: "A message is required." }, { status: 400 });
  }

  const session = verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (session !== constellationId) {
    return NextResponse.json({ error: "Not your constellation." }, { status: 403 });
  }

  const db = supabase();
  if (!db) {
    return NextResponse.json(
      { error: "Persistence is not configured." },
      { status: 500 },
    );
  }

  const { error } = await db
    .from("constellation_messages")
    .insert({ constellation_id: constellationId, role: "user", content });
  if (error) {
    return NextResponse.json({ error: "Could not send." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { isUuid } from "@/lib/signature";
import { createRequest } from "@/lib/share";
import { notifyConnection } from "@/lib/notify";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

// POST { targetId } → request to see targetId. This shares MINE with them first
// (reciprocity), then logs the request and notifies them about the request ONLY
// (the reciprocal share is silent — no double-notify). Actor = the session.
export async function POST(req: Request) {
  const me = verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!me) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  let body: { targetId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const targetId = (body.targetId ?? "").trim();
  if (!isUuid(targetId)) return NextResponse.json({ error: "Bad target." }, { status: 400 });
  if (targetId === me) return NextResponse.json({ error: "That's you." }, { status: 400 });

  const db = supabase();
  if (!db) return NextResponse.json({ error: "No persistence." }, { status: 500 });
  const { data: t } = await db.from("constellations").select("id").eq("id", targetId).maybeSingle();
  if (!t) return NextResponse.json({ error: "Not found." }, { status: 404 });

  await createRequest(me, targetId);
  try {
    await notifyConnection({ recipientId: targetId, kind: "request", ref: me });
  } catch (err) {
    console.error("[request] notify failed:", err);
  }
  return NextResponse.json({ ok: true });
}

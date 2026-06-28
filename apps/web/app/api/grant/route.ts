import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { isUuid } from "@/lib/signature";
import { grantRequest } from "@/lib/share";
import { notifyConnection } from "@/lib/notify";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

// POST { requesterId } → grant a pending request: open MY constellation to the
// requester and clear the request. Granting is a share, so they get the normal
// "shared with you" notification. Actor (grantor) = the session.
export async function POST(req: Request) {
  const me = verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!me) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  let body: { requesterId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const requesterId = (body.requesterId ?? "").trim();
  if (!isUuid(requesterId)) return NextResponse.json({ error: "Bad requester." }, { status: 400 });
  if (requesterId === me) return NextResponse.json({ error: "That's you." }, { status: 400 });

  const db = supabase();
  if (!db) return NextResponse.json({ error: "No persistence." }, { status: 500 });
  const { data: r } = await db.from("constellations").select("id").eq("id", requesterId).maybeSingle();
  if (!r) return NextResponse.json({ error: "Not found." }, { status: 404 });

  await grantRequest(me, requesterId);
  try {
    await notifyConnection({ recipientId: requesterId, kind: "share", ref: me });
  } catch (err) {
    console.error("[grant] notify failed:", err);
  }
  return NextResponse.json({ ok: true });
}

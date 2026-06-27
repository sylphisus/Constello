import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

// BlueBubbles inbound webhook — the "text us first" opt-in. The Mac running
// BlueBubbles POSTs every iMessage event here; we act only on inbound new-message
// events whose text carries a constellation uuid, capturing the sender's handle
// as a verified `imessage` contact for that constellation. The text itself is the
// consent — and this is the ONLY way an imessage contact is created (the public
// /api/contact no longer accepts the channel), so we can only ever reply to
// someone who messaged us first.
//
// Public route ON PURPOSE: it lives outside /api/admin so the Basic-auth
// middleware doesn't gate it. BlueBubbles doesn't sign its webhooks, so we
// authenticate with a shared secret in the query string — register the webhook
// URL as  https://.../api/inbound/imessage?secret=<BLUEBUBBLES_WEBHOOK_SECRET>
//   https://docs.bluebubbles.app/server/developer-guides/rest-api-and-webhooks

function authed(req: Request): boolean {
  const secret = process.env.BLUEBUBBLES_WEBHOOK_SECRET;
  const given = new URL(req.url).searchParams.get("secret");
  if (!secret || !given) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export async function POST(req: Request) {
  if (!authed(req)) return new NextResponse("bad secret", { status: 401 });

  let body: { type?: string; data?: Record<string, unknown> };
  try {
    body = JSON.parse(await req.text());
  } catch {
    return new NextResponse("bad json", { status: 400 });
  }

  // Only inbound new messages — ignore our own sends and other event types.
  const data = (body.data ?? {}) as Record<string, unknown>;
  if (body.type !== "new-message" || data.isFromMe === true) {
    return NextResponse.json({ ok: true });
  }

  const handle = (data.handle ?? {}) as Record<string, unknown>;
  const sender = handle.address as string | undefined;
  const text = data.text as string | undefined;
  const constellationId = text?.match(UUID)?.[0];

  const db = supabase();
  // Ack regardless — a non-matching text is just someone saying hi.
  if (!sender || !constellationId || !db) return NextResponse.json({ ok: true });

  await db.from("contacts").upsert(
    { constellation_id: constellationId, channel: "imessage", address: sender, verified: true },
    { onConflict: "constellation_id,channel,address" },
  );

  return NextResponse.json({ ok: true });
}

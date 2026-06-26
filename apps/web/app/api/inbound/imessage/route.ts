import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

// Photon (spectrum-ts) inbound webhook — the "text us first" opt-in. A person
// texts our managed iMessage line with their constellation id; we capture their
// handle as a verified `imessage` contact for that constellation. Inbound-first
// means the text itself is the consent — they never hand us their number.
//
// Public route ON PURPOSE: it lives outside /api/admin so the Basic-auth
// middleware doesn't gate it. It's authenticated instead by the Spectrum HMAC
// signature: HMAC-SHA256 over `v0:<timestamp>:<rawBody>`, 5-minute replay window,
// computed over the exact bytes on the wire.
//   https://photon.codes/docs/spectrum-ts/webhooks
//
// NOTE: the signature header names and the inbound JSON field names below are
// read defensively — confirm them against a real Spectrum payload before relying
// on this in production.

function verify(raw: string, sig: string | null, ts: string | null): boolean {
  const secret = process.env.PHOTON_WEBHOOK_SECRET;
  if (!secret || !sig || !ts) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false; // replay window
  const expected = createHmac("sha256", secret).update(`v0:${ts}:${raw}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export async function POST(req: Request) {
  const raw = await req.text();
  if (!verify(raw, req.headers.get("x-spectrum-signature"), req.headers.get("x-spectrum-timestamp"))) {
    return new NextResponse("bad signature", { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return new NextResponse("bad json", { status: 400 });
  }

  // Normalized inbound shape: sender handle + text content. Read defensively.
  const msg = (body.message ?? body) as Record<string, unknown>;
  const sender = (msg.sender ?? msg.from) as string | undefined;
  const content = (msg.content ?? {}) as Record<string, unknown>;
  const text = (content.text ?? msg.text) as string | undefined;

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

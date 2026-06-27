import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

// POST { contactId, verified } → flip a contact's `verified` flag. Used by the
// admin to mark a twitter handle done — i.e. the follow was checked and the
// knock was posted by hand from @03constello (verified=true drops it off the
// "X handles to notify" list). Gated by Basic auth (middleware).
export async function POST(req: Request) {
  let body: { contactId?: string; verified?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const contactId = (body.contactId ?? "").trim();
  if (!contactId) {
    return NextResponse.json({ error: "contactId is required." }, { status: 400 });
  }

  const db = supabase();
  if (!db) return NextResponse.json({ error: "No persistence." }, { status: 500 });

  const { error } = await db
    .from("contacts")
    .update({ verified: body.verified ?? true })
    .eq("id", contactId);
  if (error) return NextResponse.json({ error: error.message }, { status: 502 });

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

// POST { contactId, verified } → flip a contact's `verified` flag. Used by the
// admin to confirm a twitter handle follows @03constello before any public mention
// goes out (the follow gate in lib/notify). Gated by Basic auth (middleware).
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

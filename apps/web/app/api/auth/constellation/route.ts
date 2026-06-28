import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  SESSION_COOKIE,
  REMEMBER_MAX_AGE,
  hashPassword,
  verifyPassword,
  signSession,
} from "@/lib/auth";

export const runtime = "nodejs";

// POST { constellationId, password, remember } → claim or log in to a constellation.
// First time (no password set): the password is set, claiming it. After that the
// password must match. On success we set the signed session cookie; `remember`
// makes it persist on the device (else it expires when the browser closes).
export async function POST(req: Request) {
  let body: { constellationId?: string; password?: string; remember?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const constellationId = (body.constellationId ?? "").trim();
  const password = body.password ?? "";
  if (!constellationId || !password) {
    return NextResponse.json(
      { error: "constellationId and password are required." },
      { status: 400 },
    );
  }

  const db = supabase();
  if (!db) return NextResponse.json({ error: "No persistence." }, { status: 500 });

  const { data: c } = await db
    .from("constellations")
    .select("id, password_hash")
    .eq("id", constellationId)
    .maybeSingle();
  if (!c) return NextResponse.json({ error: "Not found." }, { status: 404 });

  if (!c.password_hash) {
    // First arrival → claim by setting the password.
    const { error } = await db
      .from("constellations")
      .update({ password_hash: hashPassword(password) })
      .eq("id", constellationId);
    if (error) return NextResponse.json({ error: error.message }, { status: 502 });
  } else if (!verifyPassword(password, c.password_hash)) {
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }

  const maxAge = body.remember ? REMEMBER_MAX_AGE : undefined;
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, signSession(constellationId, maxAge ?? REMEMBER_MAX_AGE), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    ...(maxAge ? { maxAge } : {}), // omit maxAge → session cookie (clears on browser close)
  });
  return res;
}

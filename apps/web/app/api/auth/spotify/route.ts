import { NextResponse } from "next/server";
import { authorizeUrl, redirectUri } from "@/lib/spotify-oauth";

export const runtime = "nodejs";

// GET /api/auth/spotify?constellationId=… → start the Spotify connect flow.
// We mint a random `state` (CSRF) and stash it — together with the optional
// constellation the library should attach to — in a short-lived httpOnly cookie,
// then bounce the person to Spotify's consent page. The callback verifies the
// state and reads the constellation back out. No constellationId means "begin a
// new one", exactly like the homepage text/lastfm flows.
export async function GET(req: Request) {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(
      new URL("/?spotifyError=Spotify+is+not+configured+yet.", req.url),
    );
  }

  const constellationId = new URL(req.url).searchParams.get("constellationId") ?? "";
  const state = crypto.randomUUID();
  const redirect = redirectUri(req);

  const res = NextResponse.redirect(authorizeUrl(clientId, redirect, state));
  res.cookies.set(
    "spotify_oauth",
    Buffer.from(JSON.stringify({ state, constellationId })).toString("base64"),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600, // 10 min to complete consent
    },
  );
  return res;
}

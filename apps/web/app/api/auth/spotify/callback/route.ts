import { NextResponse } from "next/server";
import { exchangeCode, redirectUri } from "@/lib/spotify-oauth";
import { fetchSpotify, formatSpotify } from "@/lib/collections/spotify";
import { createEntry } from "@/lib/collections/entries";

export const runtime = "nodejs";

// GET /api/auth/spotify/callback?code=…&state=… — Spotify sends the person back
// here after consent. We verify the state cookie, trade the code for an access
// token, pull their library once, format it into one pending entry (read by hand
// like every other source), discard the token, and route to the constellation.
// Errors funnel home with a human message in ?spotifyError.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const fail = (msg: string) =>
    NextResponse.redirect(new URL(`/?spotifyError=${encodeURIComponent(msg)}`, req.url));

  // Spotify can return an error instead of a code (e.g. the person declined).
  const oauthErr = url.searchParams.get("error");
  if (oauthErr) return fail("Spotify connection was cancelled.");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return fail("Spotify returned an incomplete response.");

  // Verify state against the cookie and recover the target constellation.
  const raw = req.headers.get("cookie")?.match(/(?:^|;\s*)spotify_oauth=([^;]+)/)?.[1];
  let constellationId = "";
  try {
    const stash = JSON.parse(Buffer.from(decodeURIComponent(raw ?? ""), "base64").toString());
    if (!raw || stash.state !== state) return fail("Spotify session expired — please retry.");
    constellationId = typeof stash.constellationId === "string" ? stash.constellationId : "";
  } catch {
    return fail("Spotify session expired — please retry.");
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return fail("Spotify is not configured yet.");

  let entry: { label: string; rawText: string };
  try {
    const token = await exchangeCode(clientId, clientSecret, code, redirectUri(req));
    entry = formatSpotify(await fetchSpotify(token));
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Spotify import failed.");
  }

  const result = await createEntry({
    constellationId: constellationId || undefined,
    source: "spotify",
    label: entry.label,
    rawText: entry.rawText,
  });
  if (!result.ok) return fail(result.error);

  const res = NextResponse.redirect(new URL(`/c/${result.constellationId}`, req.url));
  res.cookies.delete("spotify_oauth");
  return res;
}

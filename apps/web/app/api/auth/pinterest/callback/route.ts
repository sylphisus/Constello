import { NextResponse } from "next/server";
import { exchangeCode, redirectUri } from "@/lib/pinterest-oauth";
import { fetchPinterest, formatPinterest } from "@/lib/collections/pinterest";
import { createEntry } from "@/lib/collections/entries";

export const runtime = "nodejs";

// GET /api/auth/pinterest/callback?code=…&state=… — Pinterest sends the person
// back here after consent. We verify the state cookie, trade the code for an
// access token, pull their boards once, format them into one pending entry
// (read by hand like every other source), discard the token, and route to the
// constellation. Errors funnel home with a human message in ?pinterestError.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const fail = (msg: string) =>
    NextResponse.redirect(new URL(`/?pinterestError=${encodeURIComponent(msg)}`, req.url));

  // Pinterest can return an error instead of a code (e.g. the person declined).
  const oauthErr = url.searchParams.get("error");
  if (oauthErr) return fail("Pinterest connection was cancelled.");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return fail("Pinterest returned an incomplete response.");

  // Verify state against the cookie and recover the target constellation.
  const raw = req.headers.get("cookie")?.match(/(?:^|;\s*)pinterest_oauth=([^;]+)/)?.[1];
  let constellationId = "";
  try {
    const stash = JSON.parse(Buffer.from(decodeURIComponent(raw ?? ""), "base64").toString());
    if (!raw || stash.state !== state) return fail("Pinterest session expired — please retry.");
    constellationId = typeof stash.constellationId === "string" ? stash.constellationId : "";
  } catch {
    return fail("Pinterest session expired — please retry.");
  }

  const clientId = process.env.PINTEREST_CLIENT_ID;
  const clientSecret = process.env.PINTEREST_CLIENT_SECRET;
  if (!clientId || !clientSecret) return fail("Pinterest is not configured yet.");

  let entry: { label: string; rawText: string };
  try {
    const token = await exchangeCode(clientId, clientSecret, code, redirectUri(req));
    entry = formatPinterest(await fetchPinterest(token));
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Pinterest import failed.");
  }

  const result = await createEntry({
    constellationId: constellationId || undefined,
    source: "pinterest",
    label: entry.label,
    rawText: entry.rawText,
  });
  if (!result.ok) return fail(result.error);

  const res = NextResponse.redirect(new URL(`/c/${result.constellationId}`, req.url));
  res.cookies.delete("pinterest_oauth");
  return res;
}

import { NextResponse } from "next/server";
import { exchangeCode, redirectUri } from "@/lib/notion-oauth";
import { fetchNotion, formatNotion } from "@/lib/collections/notion";
import { createEntry } from "@/lib/collections/entries";

export const runtime = "nodejs";

// GET /api/auth/notion/callback?code=…&state=… — Notion sends the person back
// here after they pick which databases to share. We verify the state cookie,
// trade the code for an access token, pull the granted databases once, format
// them into one pending entry (read by hand like every other source), discard
// the token, and route to the constellation. Errors funnel home with a human
// message in ?notionError.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const fail = (msg: string) =>
    NextResponse.redirect(new URL(`/?notionError=${encodeURIComponent(msg)}`, req.url));

  // Notion can return an error instead of a code (e.g. the person declined).
  if (url.searchParams.get("error")) return fail("Notion connection was cancelled.");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return fail("Notion returned an incomplete response.");

  // Verify state against the cookie and recover the target constellation.
  const raw = req.headers.get("cookie")?.match(/(?:^|;\s*)notion_oauth=([^;]+)/)?.[1];
  let constellationId = "";
  try {
    const stash = JSON.parse(Buffer.from(decodeURIComponent(raw ?? ""), "base64").toString());
    if (!raw || stash.state !== state) return fail("Notion session expired — please retry.");
    constellationId = typeof stash.constellationId === "string" ? stash.constellationId : "";
  } catch {
    return fail("Notion session expired — please retry.");
  }

  const clientId = process.env.NOTION_CLIENT_ID;
  const clientSecret = process.env.NOTION_CLIENT_SECRET;
  if (!clientId || !clientSecret) return fail("Notion is not configured yet.");

  let entry: { label: string; rawText: string };
  try {
    const token = await exchangeCode(clientId, clientSecret, code, redirectUri(req));
    entry = formatNotion(await fetchNotion(token.accessToken, token.workspaceName));
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Notion import failed.");
  }

  const result = await createEntry({
    constellationId: constellationId || undefined,
    source: "notion",
    label: entry.label,
    rawText: entry.rawText,
  });
  if (!result.ok) return fail(result.error);

  const res = NextResponse.redirect(new URL(`/c/${result.constellationId}`, req.url));
  res.cookies.delete("notion_oauth");
  return res;
}

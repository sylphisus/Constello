import { NextResponse } from "next/server";
import { authorizeUrl, redirectUri } from "@/lib/notion-oauth";

export const runtime = "nodejs";

// GET /api/auth/notion?constellationId=… → start the Notion connect flow. We mint
// a random `state` (CSRF) and stash it — with the optional constellation the
// databases should attach to — in a short-lived httpOnly cookie, then bounce the
// person to Notion's consent page (where they pick which databases to share).
// No constellationId means "begin a new one", like the other connect flows.
export async function GET(req: Request) {
  const clientId = process.env.NOTION_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(
      new URL("/?notionError=Notion+is+not+configured+yet.", req.url),
    );
  }

  const constellationId = new URL(req.url).searchParams.get("constellationId") ?? "";
  const state = crypto.randomUUID();
  const redirect = redirectUri(req);

  const res = NextResponse.redirect(authorizeUrl(clientId, redirect, state));
  res.cookies.set(
    "notion_oauth",
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

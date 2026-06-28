// Notion OAuth 2.0 (authorization-code) helpers, shared by the connect initiator
// and its callback. Mirrors lib/pinterest-oauth.ts: the deployed app holds no
// Notion token — it trades the one-time code for an access token, pulls the
// granted databases once, and discards it. No refresh, no token table.
//
// Notion's own consent screen IS the picker: the person chooses exactly which
// pages/databases to share with the integration, so there's no scope string to
// set here — access is whatever they grant.

const AUTHORIZE_URL = "https://api.notion.com/v1/oauth/authorize";
const TOKEN_URL = "https://api.notion.com/v1/oauth/token";

export interface NotionToken {
  accessToken: string;
  workspaceName: string | null;
}

/**
 * The redirect URI must match one registered in the Notion integration exactly.
 * Derived from the request origin so dev (localhost) and prod (constello.xyz)
 * both work; NOTION_REDIRECT_URI overrides when the origin can't be trusted.
 */
export function redirectUri(req: Request): string {
  const override = process.env.NOTION_REDIRECT_URI;
  if (override) return override;
  return `${new URL(req.url).origin}/api/auth/notion/callback`;
}

export function authorizeUrl(clientId: string, redirect: string, state: string): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirect);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("owner", "user");
  url.searchParams.set("state", state);
  return url.toString();
}

/** Exchange the authorization code for an access token (HTTP Basic: id:secret). */
export async function exchangeCode(
  clientId: string,
  clientSecret: string,
  code: string,
  redirect: string,
): Promise<NotionToken> {
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirect,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || typeof json.access_token !== "string") {
    const msg =
      typeof json.error_description === "string"
        ? json.error_description
        : `token exchange failed (${res.status})`;
    throw new Error(`Notion OAuth: ${msg}`);
  }
  return {
    accessToken: json.access_token,
    workspaceName: typeof json.workspace_name === "string" ? json.workspace_name : null,
  };
}

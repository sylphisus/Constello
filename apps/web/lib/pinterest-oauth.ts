// Pinterest OAuth 2.0 (authorization-code) helpers, shared by the connect
// initiator and its callback. The deployed app holds no Pinterest token: it
// trades the one-time code for an access token, pulls the boards once, and
// discards it. No refresh, no token table — onboarding is a single pull.

// Public read scopes only. Secret boards/pins are deliberately excluded
// (CREDENTIALS.md: "only public boards read") — to include them, add
// `boards:read_secret,pins:read_secret` here AND in the Pinterest app's scopes.
export const PINTEREST_SCOPES = "user_accounts:read,boards:read,pins:read";

const AUTHORIZE_URL = "https://www.pinterest.com/oauth/";
const TOKEN_URL = "https://api.pinterest.com/v5/oauth/token";

/**
 * The redirect URI must match one registered in the Pinterest app dashboard
 * exactly. We derive it from the incoming request origin so dev (localhost) and
 * prod (constello.xyz) both work; PINTEREST_REDIRECT_URI overrides when the
 * proxy-derived origin can't be trusted.
 */
export function redirectUri(req: Request): string {
  const override = process.env.PINTEREST_REDIRECT_URI;
  if (override) return override;
  return `${new URL(req.url).origin}/api/auth/pinterest/callback`;
}

export function authorizeUrl(clientId: string, redirect: string, state: string): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirect);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", PINTEREST_SCOPES);
  url.searchParams.set("state", state);
  return url.toString();
}

/** Exchange the authorization code for an access token (HTTP Basic: id:secret). */
export async function exchangeCode(
  clientId: string,
  clientSecret: string,
  code: string,
  redirect: string,
): Promise<string> {
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirect,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || typeof json.access_token !== "string") {
    const msg =
      typeof json.message === "string" ? json.message : `token exchange failed (${res.status})`;
    throw new Error(`Pinterest OAuth: ${msg}`);
  }
  return json.access_token;
}

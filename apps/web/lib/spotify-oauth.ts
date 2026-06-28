// Spotify OAuth 2.0 (authorization-code) helpers, shared by the connect
// initiator and its callback. Like Pinterest, the deployed app holds no Spotify
// token: it trades the one-time code for an access token, pulls the library
// once, and discards it. No refresh, no token table — onboarding is a single
// pull.

// Read scopes only. Playlists (private + collaborative), top artists/tracks,
// saved library, and followed artists — everything that traces taste. To narrow
// what's read, remove a scope here AND it stops being requested at consent.
export const SPOTIFY_SCOPES = [
  "user-top-read",
  "user-library-read",
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-follow-read",
].join(" ");

const AUTHORIZE_URL = "https://accounts.spotify.com/authorize";
const TOKEN_URL = "https://accounts.spotify.com/api/token";

/**
 * The redirect URI must match one registered in the Spotify app dashboard
 * exactly. We derive it from the incoming request origin so dev (localhost) and
 * prod (constello.xyz) both work; SPOTIFY_REDIRECT_URI overrides when the
 * proxy-derived origin can't be trusted.
 */
export function redirectUri(req: Request): string {
  const override = process.env.SPOTIFY_REDIRECT_URI;
  if (override) return override;
  return `${new URL(req.url).origin}/api/auth/spotify/callback`;
}

export function authorizeUrl(clientId: string, redirect: string, state: string): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirect);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SPOTIFY_SCOPES);
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
      typeof json.error_description === "string"
        ? json.error_description
        : `token exchange failed (${res.status})`;
    throw new Error(`Spotify OAuth: ${msg}`);
  }
  return json.access_token;
}

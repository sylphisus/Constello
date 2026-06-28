// Spotify collection adapter (CONSTELLO_BUILD.md §6 — a collection source that
// "plugs in without philosophical gatekeeping"). Of the music sources this is
// the richest: Last.fm is passive scrobbles, but a Spotify library is curated —
// playlists are deliberate collections, named and described by the person, the
// most literal "world they're building." We present them faithfully and let the
// hand-read weigh them.
//
// Like Pinterest, Spotify has no public-by-username read — the library requires
// the person's OAuth grant. So the fetch takes an access token obtained by the
// connect flow (app/api/auth/spotify/*); the formatter is pure and
// provider-agnostic, turning normalized data into the one entry read by hand.

const API = "https://api.spotify.com/v1";

// How much to pull. The hand-read sees the shape of the library, not every
// track; caps keep one onboarding to a bounded handful of requests.
const MAX_PLAYLISTS = 50;
const TRACKS_PER_PLAYLIST = 20;
const TOP_LIMIT = 50;
const SAVED_LIMIT = 50;
const FOLLOWING_LIMIT = 50;

export interface SpotifyProfile {
  displayName: string | null;
  id: string | null;
  followerCount: number | null;
}

export interface SpotifyTrack {
  title: string;
  artists: string; // joined artist names
}

export interface SpotifyPlaylist {
  name: string;
  description: string | null;
  ownedBySelf: boolean;
  ownerName: string | null;
  trackTotal: number | null;
  tracks: SpotifyTrack[];
}

export interface SpotifyData {
  profile: SpotifyProfile;
  topArtists: string[];
  topTracks: SpotifyTrack[];
  followedArtists: string[];
  savedAlbums: { title: string; artists: string }[];
  playlists: SpotifyPlaylist[];
}

// ── Fetch ──────────────────────────────────────────────────────────────────────
// Token-scoped: every call carries the user's bearer access token. We never store
// it (one-shot pull at onboarding); the route discards it after this returns.

async function get(token: string, path: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = json.error as Record<string, unknown> | undefined;
    const msg = str(err?.message) || `Spotify request failed (${res.status}).`;
    throw new Error(`Spotify: ${msg}`);
  }
  return json;
}

export async function fetchSpotify(token: string): Promise<SpotifyData> {
  const account = await get(token, "/me");
  const profile: SpotifyProfile = {
    displayName: str(account.display_name) || null,
    id: str(account.id) || null,
    followerCount: numOrNull((account.followers as Record<string, unknown>)?.total),
  };
  const selfId = profile.id;

  // Taste, in five faithful pulls plus a sample of each playlist's tracks. Each
  // top-level pull is one request; long_term is the most settled signal.
  const [topArtistsJson, topTracksJson, followingJson, savedJson, playlistsJson] =
    await Promise.all([
      get(token, `/me/top/artists?time_range=long_term&limit=${TOP_LIMIT}`),
      get(token, `/me/top/tracks?time_range=long_term&limit=${TOP_LIMIT}`),
      get(token, `/me/following?type=artist&limit=${FOLLOWING_LIMIT}`),
      get(token, `/me/albums?limit=${SAVED_LIMIT}`),
      get(token, `/me/playlists?limit=${MAX_PLAYLISTS}`),
    ]);

  const topArtists = asArray(topArtistsJson.items).map((a) => str(a.name)).filter(Boolean);
  const topTracks = asArray(topTracksJson.items).map(parseTrack);

  const followedArtists = asArray((followingJson.artists as Record<string, unknown>)?.items)
    .map((a) => str(a.name))
    .filter(Boolean);

  const savedAlbums = asArray(savedJson.items)
    .map((it) => it.album as Record<string, unknown>)
    .filter(Boolean)
    .map((al) => ({ title: str(al.name), artists: joinArtists(al.artists) }));

  const playlistItems = asArray(playlistsJson.items).slice(0, MAX_PLAYLISTS);
  const playlists: SpotifyPlaylist[] = await Promise.all(
    playlistItems.map(async (p) => {
      const id = str(p.id);
      const owner = p.owner as Record<string, unknown> | undefined;
      let tracks: SpotifyTrack[] = [];
      try {
        const tracksJson = await get(
          token,
          `/playlists/${id}/tracks?limit=${TRACKS_PER_PLAYLIST}&fields=items(track(name,artists(name)))`,
        );
        tracks = asArray(tracksJson.items)
          .map((it) => it.track as Record<string, unknown>)
          .filter(Boolean)
          .map(parseTrack);
      } catch {
        // A single playlist failing shouldn't sink the whole import — present
        // the playlist without its sampled tracks.
      }
      return {
        name: str(p.name),
        description: str(p.description) || null,
        ownedBySelf: !!selfId && str(owner?.id) === selfId,
        ownerName: str(owner?.display_name) || null,
        trackTotal: numOrNull((p.tracks as Record<string, unknown>)?.total),
        tracks,
      };
    }),
  );

  return { profile, topArtists, topTracks, followedArtists, savedAlbums, playlists };
}

function parseTrack(t: Record<string, unknown> | undefined): SpotifyTrack {
  return { title: str(t?.name), artists: joinArtists(t?.artists) };
}

function joinArtists(v: unknown): string {
  return asArray(v)
    .map((a) => str(a.name))
    .filter(Boolean)
    .join(", ");
}

// Spotify is well-behaved JSON, but keep the same defensive accessors as the
// other adapters so a missing/oddly-shaped field never throws.
function asArray(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
}
function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function numOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ── Format ───────────────────────────────────────────────────────────────────

/** Pure: normalized data → the entry text the reading is drawn from. */
export function formatSpotify(data: SpotifyData): { label: string; rawText: string } {
  const p = data.profile;
  const handle = p.displayName ?? p.id ?? "unknown";
  const lines: string[] = [];

  lines.push(`Spotify library for ${handle}.`);

  if (data.topArtists.length) {
    lines.push("", `Top artists: ${data.topArtists.join(", ")}`);
  }
  if (data.topTracks.length) {
    lines.push("", "Top tracks:");
    for (const t of data.topTracks) lines.push(`  - ${trackLine(t)}`);
  }
  if (data.followedArtists.length) {
    lines.push("", `Following: ${data.followedArtists.join(", ")}`);
  }
  if (data.savedAlbums.length) {
    lines.push("", "Saved albums:");
    for (const a of data.savedAlbums) {
      lines.push(`  - ${a.artists ? `${a.artists} — ` : ""}${a.title}`);
    }
  }

  for (const pl of data.playlists) {
    const meta = [
      pl.ownedBySelf ? null : pl.ownerName ? `by ${pl.ownerName}` : "followed",
      pl.trackTotal != null ? `${pl.trackTotal} tracks` : null,
    ]
      .filter(Boolean)
      .join(", ");
    lines.push("", `Playlist: ${pl.name}${meta ? ` (${meta})` : ""}`);
    if (pl.description) lines.push(`  ${pl.description}`);
    for (const t of pl.tracks) lines.push(`  - ${trackLine(t)}`);
  }

  return { label: `Spotify · ${handle}`, rawText: lines.join("\n") };
}

function trackLine(t: SpotifyTrack): string {
  return t.artists ? `${t.artists} — ${t.title}` : t.title;
}

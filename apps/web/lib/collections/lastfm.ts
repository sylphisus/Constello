// Last.fm collection adapter (CONSTELLO_BUILD.md §6.2).
//
// Two halves, deliberately separate so the formatter is pure and testable
// without network or keys:
//   - fetchLastfm(username): pulls public listening data via the Last.fm API.
//   - formatLastfm(data):    turns normalized data into the { label, rawText }
//                            that becomes one entry, read by hand.
//
// In the manual alpha a collection is one entry → one reading artifact, so we
// keep the *whole* listening self in a single entry rather than pocket-splitting
// (§6.2's pockets were for the automated pipeline; the hand-read sees it whole).

const API = "https://ws.audioscrobbler.com/2.0/";

export interface LastfmData {
  username: string;
  topArtistsOverall: { name: string; playcount: number }[];
  topArtistsRecent: { name: string; playcount: number }[]; // last 3 months
  topAlbums: { name: string; artist: string; playcount: number }[];
  topTracks: { name: string; artist: string; playcount: number }[];
  recentTracks: { name: string; artist: string; nowPlaying: boolean }[];
}

// ── Fetch ────────────────────────────────────────────────────────────────────

/** Throws a clean error if the key is missing or the username is unknown. */
export async function fetchLastfm(username: string): Promise<LastfmData> {
  const key = process.env.LASTFM_API_KEY;
  if (!key) {
    throw new Error(
      "LASTFM_API_KEY is not set. Add it to the workspace-root .env.local.",
    );
  }

  const call = async (
    method: string,
    params: Record<string, string>,
  ): Promise<unknown> => {
    const url = new URL(API);
    url.searchParams.set("method", method);
    url.searchParams.set("user", username);
    url.searchParams.set("api_key", key);
    url.searchParams.set("format", "json");
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

    const res = await fetch(url, { headers: { "User-Agent": "Constello/alpha" } });
    const json = (await res.json()) as Record<string, unknown>;
    // Last.fm returns 200 with an { error, message } body for bad users/keys.
    if (typeof json.error === "number") {
      throw new Error(`Last.fm: ${json.message ?? "request failed"}`);
    }
    if (!res.ok) throw new Error(`Last.fm request failed (${res.status}).`);
    return json;
  };

  const [artistsAll, artistsRecent, albums, tracks, recent] = await Promise.all([
    call("user.gettopartists", { period: "overall", limit: "30" }),
    call("user.gettopartists", { period: "3month", limit: "20" }),
    call("user.gettopalbums", { period: "overall", limit: "20" }),
    call("user.gettoptracks", { period: "overall", limit: "30" }),
    call("user.getrecenttracks", { limit: "30" }),
  ]);

  return {
    username,
    topArtistsOverall: parseArtists(artistsAll),
    topArtistsRecent: parseArtists(artistsRecent),
    topAlbums: parseAlbums(albums),
    topTracks: parseTracks(tracks),
    recentTracks: parseRecent(recent),
  };
}

// Last.fm collapses single-result lists to an object and omits keys when empty,
// so every accessor below tolerates missing / non-array shapes.
function asArray(v: unknown): Record<string, unknown>[] {
  if (Array.isArray(v)) return v as Record<string, unknown>[];
  if (v && typeof v === "object") return [v as Record<string, unknown>];
  return [];
}
function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function artistName(v: unknown): string {
  if (v && typeof v === "object") return str((v as Record<string, unknown>).name);
  return str(v);
}

function parseArtists(json: unknown): LastfmData["topArtistsOverall"] {
  const root = (json as Record<string, unknown>)?.topartists as Record<string, unknown>;
  return asArray(root?.artist).map((a) => ({
    name: str(a.name),
    playcount: num(a.playcount),
  }));
}
function parseAlbums(json: unknown): LastfmData["topAlbums"] {
  const root = (json as Record<string, unknown>)?.topalbums as Record<string, unknown>;
  return asArray(root?.album).map((a) => ({
    name: str(a.name),
    artist: artistName(a.artist),
    playcount: num(a.playcount),
  }));
}
function parseTracks(json: unknown): LastfmData["topTracks"] {
  const root = (json as Record<string, unknown>)?.toptracks as Record<string, unknown>;
  return asArray(root?.track).map((t) => ({
    name: str(t.name),
    artist: artistName(t.artist),
    playcount: num(t.playcount),
  }));
}
function parseRecent(json: unknown): LastfmData["recentTracks"] {
  const root = (json as Record<string, unknown>)?.recenttracks as Record<string, unknown>;
  return asArray(root?.track).map((t) => {
    const attr = (t["@attr"] as Record<string, unknown>) ?? {};
    const artist = t.artist as Record<string, unknown> | undefined;
    return {
      name: str(t.name),
      artist: str(artist?.["#text"]) || artistName(t.artist),
      nowPlaying: str(attr.nowplaying) === "true",
    };
  });
}

// ── Format ───────────────────────────────────────────────────────────────────

/** Pure: normalized data → the entry text the reading is drawn from. */
export function formatLastfm(data: LastfmData): { label: string; rawText: string } {
  const lines: string[] = [];
  lines.push(`Last.fm listening history for ${data.username}.`);

  const artistList = (a: { name: string; playcount: number }[]) =>
    a.map((x, i) => `${i + 1}. ${x.name} (${x.playcount.toLocaleString()} plays)`);

  if (data.topArtistsOverall.length) {
    lines.push("", "Most-played artists of all time:", ...artistList(data.topArtistsOverall));
  }
  if (data.topArtistsRecent.length) {
    lines.push("", "Most-played artists, last 3 months:", ...artistList(data.topArtistsRecent));
  }
  if (data.topAlbums.length) {
    lines.push(
      "",
      "Most-played albums of all time:",
      ...data.topAlbums.map(
        (a, i) => `${i + 1}. ${a.name} — ${a.artist} (${a.playcount.toLocaleString()} plays)`,
      ),
    );
  }
  if (data.topTracks.length) {
    lines.push(
      "",
      "Most-played tracks of all time:",
      ...data.topTracks.map(
        (t, i) => `${i + 1}. ${t.name} — ${t.artist} (${t.playcount.toLocaleString()} plays)`,
      ),
    );
  }
  if (data.recentTracks.length) {
    lines.push(
      "",
      "Recently played (most recent first):",
      ...data.recentTracks.map(
        (t) => `- ${t.name} — ${t.artist}${t.nowPlaying ? " (now playing)" : ""}`,
      ),
    );
  }

  return { label: `Last.fm · ${data.username}`, rawText: lines.join("\n") };
}

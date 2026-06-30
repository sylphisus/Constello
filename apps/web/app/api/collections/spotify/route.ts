import { NextResponse } from "next/server";
import { createEntry } from "@/lib/collections/entries";

export const runtime = "nodejs";

// POST { constellationId?, url } → queue a public Spotify playlist/album/artist
// link as a pending entry. The per-user Spotify API is shelved (OAuth dev-mode
// caps real access at 5 users, and app-level reads of playlists/users are a hard
// 403), so the music source mirrors the Pinterest board flow instead: the link
// renders as an inline dark embed on the constellation page and is read by hand.
// The embed / screenshots ARE the read; raw_text just carries the canonical link
// so the console can open it. (Receiptify-style screenshots take the image-upload
// path — POST to /api/collections/images with a "Spotify · …" label.)
export async function POST(req: Request) {
  let body: { constellationId?: string; url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const link = normalizeSpotifyUrl(body.url ?? "");
  if (!link) {
    return NextResponse.json(
      { error: "A public Spotify playlist, album, or artist link is required." },
      { status: 400 },
    );
  }

  // Label encodes type/id so re-pasting the same playlist dedupes into the same
  // world instead of forking a new one — mirrors the deterministic labels of the
  // other sources. The prefix on raw_text is what the console keys off to show
  // the read-from-embed flow (see SPOTIFY_PLACEHOLDER_PREFIX in app/admin/page.tsx).
  const result = await createEntry({
    constellationId: body.constellationId,
    source: "spotify",
    label: `Spotify · ${link.type}/${link.id}`,
    rawText: `Pending Spotify capture — read by hand from the inline embed / screenshots. Link: ${link.url}`,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({
    constellationId: result.constellationId,
    entryId: result.entryId,
    pending: true,
  });
}

// Accept what someone pastes — an open.spotify.com link (with or without scheme,
// a /intl-xx locale prefix, or a ?si=… share token) or the spotify:type:id URI —
// and reduce it to {type, id, url}. Embeddable types only; reject anything else.
const EMBEDDABLE = new Set(["playlist", "album", "artist", "track"]);

function normalizeSpotifyUrl(raw: string): { type: string; id: string; url: string } | null {
  let s = raw.trim();
  if (!s) return null;

  // spotify:playlist:ID URI form (what the desktop app's "copy link" can yield).
  const uri = /^spotify:(playlist|album|artist|track):([A-Za-z0-9]+)$/i.exec(s);
  if (uri) {
    const type = uri[1].toLowerCase();
    return { type, id: uri[2], url: `https://open.spotify.com/${type}/${uri[2]}` };
  }

  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    if (!/(^|\.)spotify\.com$/i.test(u.hostname)) return null;
    // Path is /{type}/{id}, optionally prefixed with /embed or a /intl-xx locale.
    const parts = u.pathname.split("/").filter(Boolean);
    while (parts.length && (parts[0] === "embed" || /^intl-/i.test(parts[0]))) parts.shift();
    const [type, id] = parts;
    if (!type || !id || !EMBEDDABLE.has(type.toLowerCase())) return null;
    const t = type.toLowerCase();
    return { type: t, id, url: `https://open.spotify.com/${t}/${id}` };
  } catch {
    return null;
  }
}

import { NextResponse } from "next/server";
import { createEntry } from "@/lib/collections/entries";

export const runtime = "nodejs";

// POST { constellationId?, url } → queue a Pinterest board as a pending entry.
//
// The deployed app can't open a headed browser, and the v5 API only returns pin
// *text* — useless for a board that's almost all imagery. So the board is captured
// later, off-platform, by the local pinterest-capture tool (scroll-screenshots →
// read by hand in claude.ai). Until then it sits pending, so a submission is never
// lost. Unlike the X bridge, this is "screenshots only": nothing is pushed back to
// fill raw_text — the screenshots ARE the read. raw_text just carries the board
// URL so the console can print the exact capture command.
export async function POST(req: Request) {
  let body: { constellationId?: string; url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const url = await resolveBoardUrl(body.url ?? "");
  if (!url) {
    return NextResponse.json({ error: "A valid Pinterest board URL is required." }, { status: 400 });
  }

  // Label encodes the board path (user/board) so re-queuing the same board dedupes
  // instead of forking a new world — mirrors the deterministic labels of the other
  // sources. The prefix on raw_text is what the console keys off to show the
  // capture flow (see PIN_PLACEHOLDER_PREFIX in app/admin/page.tsx).
  const path = new URL(url).pathname.replace(/^\/+|\/+$/g, "");
  const result = await createEntry({
    constellationId: body.constellationId,
    source: "pinterest",
    label: `Pinterest · ${path}`,
    rawText: `Pending Pinterest capture — read by hand from screenshots (the v5 API can't see a visual board). Board: ${url}`,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({
    constellationId: result.constellationId,
    entryId: result.entryId,
    pending: true,
  });
}

// Accept either a full pinterest.com board URL or a pin.it short link — what
// Pinterest's "Copy link" / share button hands you. A short link is opaque (its
// path is a code, not user/board), so we follow its redirect server-side to the
// real board URL, then normalize that. Returns null if it isn't a board.
async function resolveBoardUrl(raw: string): Promise<string | null> {
  const direct = normalizeBoardUrl(raw);
  if (direct) return direct;
  if (!isPinIt(raw)) return null;
  try {
    const res = await fetch(withScheme(raw), {
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    return normalizeBoardUrl(res.url); // strips the invite_code/sender tracking params
  } catch {
    return null;
  }
}

// Accept what someone would paste (with or without scheme/www, trailing slash,
// query/hash) and reduce it to a clean board URL; reject non-Pinterest hosts.
function normalizeBoardUrl(raw: string): string | null {
  if (!raw.trim()) return null;
  try {
    const u = new URL(withScheme(raw));
    if (!/(^|\.)pinterest\.[a-z.]+$/i.test(u.hostname)) return null;
    const path = u.pathname.replace(/^\/+|\/+$/g, "");
    if (!path) return null; // a board needs a user/board path, not the bare host
    return `${u.origin}/${path}/`;
  } catch {
    return null;
  }
}

function isPinIt(raw: string): boolean {
  try {
    return new URL(withScheme(raw)).hostname.toLowerCase() === "pin.it";
  } catch {
    return false;
  }
}

function withScheme(raw: string): string {
  const s = raw.trim();
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

// Pinterest collection adapter (CONSTELLO_BUILD.md §6 — a collection source that
// "plugs in without philosophical gatekeeping"). Boards are the most literal
// collection of all: a person's pins are the things they kept because some world
// in them rhymed. We present them faithfully and let the hand-read weigh them.
//
// Unlike Last.fm, Pinterest has no public-by-username API — reading someone's
// boards requires their OAuth grant. So the fetch takes an access token obtained
// by the connect flow (app/api/auth/pinterest/*); the formatter is pure and
// provider-agnostic, turning normalized data into the one entry read by hand.

const API = "https://api.pinterest.com/v5";

// How much to pull. The hand-read sees the shape of the boards, not every pin;
// caps keep one onboarding to a bounded handful of requests.
const MAX_BOARDS = 50;
const PINS_PER_BOARD = 30;

export interface PinterestProfile {
  username: string | null;
  about: string | null;
  websiteUrl: string | null;
  profileImage: string | null;
  pinCount: number | null;
  boardCount: number | null;
  followerCount: number | null;
  followingCount: number | null;
}

export interface PinterestPin {
  title: string | null;
  description: string | null;
  altText: string | null;
  note: string | null; // the pinner's private note on the pin, if any
  link: string | null; // the source the pin links out to
}

export interface PinterestBoard {
  id: string;
  name: string;
  description: string | null;
  privacy: string | null;
  pinCount: number | null;
  pins: PinterestPin[];
}

export interface PinterestData {
  profile: PinterestProfile;
  boards: PinterestBoard[];
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
    const msg = str(json.message) || `Pinterest request failed (${res.status}).`;
    throw new Error(`Pinterest: ${msg}`);
  }
  return json;
}

export async function fetchPinterest(token: string): Promise<PinterestData> {
  const account = await get(token, "/user_account");
  const profile: PinterestProfile = {
    username: str(account.username) || null,
    about: str(account.about) || null,
    websiteUrl: str(account.website_url) || null,
    profileImage: str(account.profile_image) || null,
    pinCount: numOrNull(account.pin_count),
    boardCount: numOrNull(account.board_count),
    followerCount: numOrNull(account.follower_count),
    followingCount: numOrNull(account.following_count),
  };

  const boardsJson = await get(token, `/boards?page_size=${MAX_BOARDS}`);
  const boardItems = asArray(boardsJson.items).slice(0, MAX_BOARDS);

  const boards: PinterestBoard[] = await Promise.all(
    boardItems.map(async (b) => {
      const id = str(b.id);
      let pins: PinterestPin[] = [];
      try {
        const pinsJson = await get(token, `/boards/${id}/pins?page_size=${PINS_PER_BOARD}`);
        pins = asArray(pinsJson.items).slice(0, PINS_PER_BOARD).map(parsePin);
      } catch {
        // A single board failing (e.g. a deleted/secret edge case) shouldn't sink
        // the whole import — present the board without its pins.
      }
      return {
        id,
        name: str(b.name),
        description: str(b.description) || null,
        privacy: str(b.privacy) || null,
        pinCount: numOrNull(b.pin_count),
        pins,
      };
    }),
  );

  return { profile, boards };
}

function parsePin(p: Record<string, unknown>): PinterestPin {
  return {
    title: str(p.title) || null,
    description: str(p.description) || null,
    altText: str(p.alt_text) || null,
    note: str(p.note) || null,
    link: str(p.link) || null,
  };
}

// Pinterest is well-behaved JSON, but keep the same defensive accessors as the
// Last.fm adapter so a missing/oddly-shaped field never throws.
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
export function formatPinterest(data: PinterestData): { label: string; rawText: string } {
  const p = data.profile;
  const handle = p.username ?? "unknown";
  const lines: string[] = [];

  lines.push(`Pinterest boards for @${handle}.`);
  if (p.about) lines.push(`Bio: ${p.about}`);
  if (p.websiteUrl) lines.push(`Website: ${p.websiteUrl}`);
  if (p.boardCount != null || p.pinCount != null) {
    lines.push(`${p.boardCount ?? "?"} boards · ${p.pinCount ?? "?"} pins.`);
  }

  for (const board of data.boards) {
    const meta = [board.privacy && board.privacy !== "PUBLIC" ? board.privacy.toLowerCase() : null,
      board.pinCount != null ? `${board.pinCount} pins` : null]
      .filter(Boolean)
      .join(", ");
    lines.push("", `Board: ${board.name}${meta ? ` (${meta})` : ""}`);
    if (board.description) lines.push(`  ${board.description}`);
    for (const pin of board.pins) {
      // A pin's signal is whatever text it carries — collapse to one readable line.
      const text = [pin.title, pin.description, pin.note, pin.altText]
        .map((t) => (t ?? "").replace(/\s*\n+\s*/g, " ").trim())
        .filter(Boolean)
        .join(" — ");
      const linkHost = hostOf(pin.link);
      if (text || linkHost) {
        lines.push(`  - ${text}${text && linkHost ? " " : ""}${linkHost ? `[${linkHost}]` : ""}`);
      }
    }
  }

  return { label: `Pinterest · @${handle}`, rawText: lines.join("\n") };
}

// A bare pin (just an image, no text) still carries a signal in where it links —
// the host alone (e.g. "etsy.com") is often enough to read the register.
function hostOf(link: string | null): string | null {
  if (!link) return null;
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

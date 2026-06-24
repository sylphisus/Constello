// Twitter / X collection adapter (CONSTELLO_BUILD.md §6 — a future adapter that
// "plugs in without philosophical gatekeeping"). Performance is read at the
// reading layer, not gated here (§6.5): we present the material faithfully and
// let the hand-read weigh it.
//
// The fetch source is still being chosen (official X API v2 vs. a third-party),
// so fetchTwitter is the *single swap point*. The formatter is provider-agnostic:
// any source just has to produce the normalized TwitterData below.

export interface TwitterProfile {
  handle: string; // without the leading '@'
  displayName: string | null;
  bio: string | null;
  location: string | null;
  followersCount: number | null;
  followingCount: number | null;
  joined: string | null;
}

export interface Tweet {
  text: string;
  isReply: boolean;
  isRetweet: boolean;
}

export interface TwitterData {
  profile: TwitterProfile;
  tweets: Tweet[]; // most recent first
}

// ── Fetch (swap point) ─────────────────────────────────────────────────────────

/**
 * Not wired yet — the API source is being decided. To connect: implement this to
 * return a normalized TwitterData (profile + recent tweets, most recent first)
 * from whatever provider we land on, gated on its credential env var. Everything
 * downstream (formatTwitter, the route, the UI) already works against this shape.
 */
export async function fetchTwitter(_handle: string): Promise<TwitterData> {
  throw new Error(
    "X / Twitter import isn't connected yet — wire fetchTwitter in lib/collections/twitter.ts once the API source is chosen.",
  );
}

// ── Format ───────────────────────────────────────────────────────────────────

/** Pure: normalized data → the entry text the reading is drawn from. */
export function formatTwitter(data: TwitterData): { label: string; rawText: string } {
  const p = data.profile;
  const lines: string[] = [];

  const name = p.displayName ? ` (${p.displayName})` : "";
  lines.push(`X / Twitter profile for @${p.handle}${name}.`);
  if (p.bio) lines.push(`Bio: ${p.bio}`);
  if (p.location) lines.push(`Location: ${p.location}`);
  if (p.joined) lines.push(`Joined: ${p.joined}`);
  if (p.followersCount != null || p.followingCount != null) {
    lines.push(
      `Following ${p.followingCount ?? "?"} · Followed by ${p.followersCount ?? "?"}.`,
    );
  }

  if (data.tweets.length) {
    lines.push("", "Their posts (most recent first; replies and retweets marked):");
    for (const t of data.tweets) {
      const tag = t.isRetweet ? "[retweet] " : t.isReply ? "[reply] " : "";
      // Collapse internal newlines so each post stays one readable line.
      lines.push(`- ${tag}${t.text.replace(/\s*\n+\s*/g, " ").trim()}`);
    }
  }

  return { label: `X · @${p.handle}`, rawText: lines.join("\n") };
}

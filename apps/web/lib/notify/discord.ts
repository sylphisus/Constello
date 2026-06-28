// Discord notification — a PUBLIC @mention in a designated channel of a mutual
// server (the "knock", never the link — exactly like the twitter channel). A
// channel is visible to all its members, so it can't carry the bearer URL; the
// person reaches their reading via the link they already hold.
//
// Identity: contacts store the Discord *snowflake id* (resolved from the typed
// username at opt-in by resolveMember below), so a username change can't break
// the ping. The `verified` gate is set at opt-in: we only ping handles that
// resolved to a real member of the mutual server — server membership is the
// consent gate, mirroring the twitter follow-gate.
//
// Env-gated + best-effort: needs DISCORD_BOT_TOKEN. Resolution uses
// DISCORD_GUILD_ID (the bot needs the Server Members privileged intent); sending
// uses DISCORD_CHANNEL_ID. No gateway connection — REST only, so it runs fine on
// serverless functions.
//   https://discord.com/developers/docs/resources/guild#search-guild-members
//   https://discord.com/developers/docs/resources/channel#create-message

const API = "https://discord.com/api/v10";

function botHeaders(token: string): Record<string, string> {
  return { Authorization: `Bot ${token}`, "Content-Type": "application/json" };
}

// Resolve a typed username to a guild member's snowflake id. Returns null if the
// bot isn't configured or the username isn't a member of the mutual server.
export async function resolveMember(username: string): Promise<string | null> {
  const token = process.env.DISCORD_BOT_TOKEN;
  const guild = process.env.DISCORD_GUILD_ID;
  if (!token || !guild) return null;
  const q = username.trim().replace(/^@/, "");
  if (!q) return null;

  try {
    const res = await fetch(
      `${API}/guilds/${guild}/members/search?query=${encodeURIComponent(q)}&limit=10`,
      { headers: botHeaders(token) },
    );
    if (!res.ok) {
      console.error(`[notify/discord] member search ${res.status}: ${await res.text()}`);
      return null;
    }
    const members = (await res.json()) as { user?: { id: string; username: string } }[];
    const exact = members.find((m) => m.user?.username?.toLowerCase() === q.toLowerCase());
    return exact?.user?.id ?? null;
  } catch (err) {
    console.error("[notify/discord] member search failed:", err);
    return null;
  }
}

// Post a reply to a specific message — threads natively off it (the user sees a
// reply to their own @mention/question). Used by the conversational channel, not
// the notify knock. Returns true on a 2xx.
export async function sendDiscordReply(args: {
  channelId: string;
  replyToMessageId: string;
  content: string;
}): Promise<boolean> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    console.warn("[notify/discord] DISCORD_BOT_TOKEN not set — reply skipped.");
    return false;
  }
  try {
    const res = await fetch(`${API}/channels/${args.channelId}/messages`, {
      method: "POST",
      headers: botHeaders(token),
      body: JSON.stringify({
        content: args.content,
        message_reference: { message_id: args.replyToMessageId },
        // Don't ping anyone via the reply text itself; the native reply already
        // notifies the person being replied to.
        allowed_mentions: { parse: [], replied_user: true },
      }),
    });
    if (!res.ok) {
      console.error(`[notify/discord] reply ${res.status}: ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[notify/discord] reply failed:", err);
    return false;
  }
}

// Ping a resolved member id with a contentless knock in the designated channel.
export async function sendDiscordPing(userId: string, text: string): Promise<boolean> {
  const token = process.env.DISCORD_BOT_TOKEN;
  const channel = process.env.DISCORD_CHANNEL_ID;
  if (!token || !channel) {
    console.warn("[notify/discord] DISCORD_BOT_TOKEN / DISCORD_CHANNEL_ID not set — skipped.");
    return false;
  }
  try {
    const res = await fetch(`${API}/channels/${channel}/messages`, {
      method: "POST",
      headers: botHeaders(token),
      body: JSON.stringify({
        content: `<@${userId}> ${text}`,
        allowed_mentions: { users: [userId] },
      }),
    });
    if (!res.ok) {
      console.error(`[notify/discord] post ${res.status}: ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[notify/discord] post failed:", err);
    return false;
  }
}

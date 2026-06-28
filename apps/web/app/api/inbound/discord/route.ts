import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { supabase } from "@/lib/supabase";
import { sendDiscordReply } from "@/lib/notify/discord";

export const runtime = "nodejs";

function appUrl(): string {
  return (process.env.APP_URL ?? "https://constello.xyz").replace(/\/$/, "");
}

// Discord inbound webhook — the conversational channel. The gateway listener
// (apps/bot/) holds the websocket Discord requires to deliver real message
// content, and forwards exactly the messages that @mention the bot or reply to
// it. Each lands here as an inbound question; Ethan answers by hand from the
// admin console (see /api/admin/discord-reply).
//
// Public route ON PURPOSE: it lives outside /api/admin so the Basic-auth
// middleware doesn't gate it. The listener authenticates with a shared secret in
// the query string (the gateway gives us no signature to verify), exactly like
// the BlueBubbles inbound — register the listener with
//   https://constello.xyz/api/inbound/discord?secret=<DISCORD_INBOUND_SECRET>

function authed(req: Request): boolean {
  const secret = process.env.DISCORD_INBOUND_SECRET;
  const given = new URL(req.url).searchParams.get("secret");
  if (!secret || !given) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

interface InboundBody {
  messageId?: string; // snowflake of the user's message (the reply target)
  userId?: string; // author snowflake — joins to contacts.address
  username?: string;
  channelId?: string;
  guildId?: string;
  content?: string;
}

export async function POST(req: Request) {
  if (!authed(req)) return new NextResponse("bad secret", { status: 401 });

  let body: InboundBody;
  try {
    body = JSON.parse(await req.text());
  } catch {
    return new NextResponse("bad json", { status: 400 });
  }

  const { messageId, userId, username, channelId, guildId, content } = body;
  if (!messageId || !userId || !channelId || !content?.trim()) {
    return new NextResponse("missing fields", { status: 400 });
  }

  const db = supabase();
  if (!db) return NextResponse.json({ ok: true }); // no persistence — ack and drop

  // Resolve the author's constellation from their Discord snowflake. Discord
  // contacts store the snowflake (resolved at opt-in), so this is a clean join;
  // null when the author hasn't linked a constellation yet (an "unlinked" knock).
  const { data: contact } = await db
    .from("contacts")
    .select("constellation_id")
    .eq("channel", "discord")
    .eq("address", userId)
    .limit(1)
    .maybeSingle();

  // Idempotent on the message snowflake — a gateway resume can redeliver. The
  // partial unique index is the race backstop; this check is the common path.
  const { data: prior } = await db
    .from("discord_messages")
    .select("id")
    .eq("discord_message_id", messageId)
    .eq("direction", "in")
    .maybeSingle();
  if (prior) return NextResponse.json({ ok: true });

  const constellationId = contact?.constellation_id ?? null;

  // A stranger with no constellation can't be matched — onboard them instead of
  // queuing a question Ethan can't answer: auto-reply with a link to start one,
  // and log the message already-answered so it stays out of the admin inbox (and
  // a gateway redelivery doesn't re-invite them).
  if (!constellationId) {
    await sendDiscordReply({
      channelId,
      replyToMessageId: messageId,
      content: `you don't have a constellation yet — start one at ${appUrl()}, then connect Discord and ask again.`,
    });
    await db.from("discord_messages").insert({
      discord_message_id: messageId,
      discord_user_id: userId,
      discord_username: username ?? "",
      channel_id: channelId,
      guild_id: guildId ?? null,
      constellation_id: null,
      content: content.trim(),
      direction: "in",
      answered: true,
    });
    return NextResponse.json({ ok: true });
  }

  await db.from("discord_messages").insert({
    discord_message_id: messageId,
    discord_user_id: userId,
    discord_username: username ?? "",
    channel_id: channelId,
    guild_id: guildId ?? null,
    constellation_id: constellationId,
    content: content.trim(),
    direction: "in",
  });

  return NextResponse.json({ ok: true });
}

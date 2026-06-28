import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendDiscordReply } from "@/lib/notify/discord";

export const runtime = "nodejs";

// The conversational inbox + the context that answers "who is my closest match
// on this server?" — the core movement of the project, fulfilled by hand.
//
//  GET  → unanswered inbound questions, each with an assembled context bundle:
//         the asker's world (essence + readings) and their nearest server-mates
//         by embedding similarity (nearest_servermates RPC), each with a score
//         and their essence. A ready-to-paste `contextText` is included so the
//         admin just copies it into claude.ai.
//  POST → { id, content } posts `content` as a native Discord reply to the
//         question, marks it answered, and logs the outbound row.

interface MatchRow {
  constellation_id: string;
  similarity: number;
  signature: string | null;
  essence: string | null;
}

// Fetch the asker's own world: current essence + every fulfilled reading artifact.
async function askerWorld(
  db: NonNullable<ReturnType<typeof supabase>>,
  constellationId: string,
): Promise<{ essence: string | null; readings: string[] }> {
  const { data: essence } = await db
    .from("essences")
    .select("artifact")
    .eq("constellation_id", constellationId)
    .maybeSingle();

  const { data: entries } = await db
    .from("entries")
    .select("id")
    .eq("constellation_id", constellationId);
  const ids = (entries ?? []).map((e) => e.id);

  let readings: string[] = [];
  if (ids.length) {
    const { data: rows } = await db
      .from("readings")
      .select("artifact")
      .in("entry_id", ids);
    readings = (rows ?? []).map((r) => r.artifact as string);
  }
  return { essence: (essence?.artifact as string) ?? null, readings };
}

// Assemble the plain-text bundle Ethan pastes into claude.ai. Data, not depth:
// the question, the asker's world, and the candidate worlds with scores. The
// frame is minimal and neutral — Opus draws the recognition, we don't command it.
function buildContextText(args: {
  question: string;
  asker: { essence: string | null; readings: string[] } | null;
  matches: MatchRow[];
}): string {
  const parts: string[] = [];
  parts.push("# Constello — match conversation\n");
  parts.push(`A member asked, in the server:\n> ${args.question}\n`);

  parts.push("\n## The asker's world\n");
  if (!args.asker) {
    parts.push("(This person has not linked a constellation yet — no world to read.)\n");
  } else {
    parts.push(args.asker.essence ?? "(No essence written yet.)");
    if (args.asker.readings.length) {
      parts.push("\n\n### Their readings\n");
      args.asker.readings.forEach((r, i) => parts.push(`\n--- reading ${i + 1} ---\n${r}\n`));
    }
  }

  parts.push("\n## Nearest server-mates (by embedding similarity)\n");
  if (!args.matches.length) {
    parts.push("(No other read members on the server to match against yet.)\n");
  } else {
    args.matches.forEach((m, i) => {
      parts.push(
        `\n### Match ${i + 1} — similarity ${m.similarity.toFixed(3)} — constellation ${m.constellation_id}\n`,
      );
      parts.push(m.essence ?? "(No essence written yet for this match.)");
      parts.push("\n");
    });
  }

  parts.push(
    "\nConduct a personal analysis: who, among these, is this person's closest match on the server, and why? Speak to them directly.",
  );
  return parts.join("");
}

export async function GET() {
  const db = supabase();
  if (!db) return NextResponse.json({ error: "No persistence." }, { status: 500 });

  const { data: msgs } = await db
    .from("discord_messages")
    .select(
      "id, discord_message_id, discord_user_id, discord_username, channel_id, guild_id, constellation_id, content, created_at",
    )
    .eq("direction", "in")
    .eq("answered", false)
    .order("created_at", { ascending: true });

  const questions = [];
  for (const m of msgs ?? []) {
    const constellationId = m.constellation_id as string | null;
    let asker: { essence: string | null; readings: string[] } | null = null;
    let matches: MatchRow[] = [];

    if (constellationId) {
      asker = await askerWorld(db, constellationId);
      const { data: near } = await db.rpc("nearest_servermates", {
        asker: constellationId,
        k: 5,
      });
      matches = (near ?? []) as MatchRow[];
    }

    questions.push({
      id: m.id,
      discordMessageId: m.discord_message_id,
      userId: m.discord_user_id,
      username: m.discord_username,
      channelId: m.channel_id,
      constellationId,
      content: m.content,
      createdAt: m.created_at,
      asker,
      matches,
      contextText: buildContextText({ question: m.content as string, asker, matches }),
    });
  }

  return NextResponse.json({ questions });
}

export async function POST(req: Request) {
  const db = supabase();
  if (!db) return NextResponse.json({ error: "No persistence." }, { status: 500 });

  let body: { id?: string; content?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  if (!body.id || !body.content?.trim()) {
    return NextResponse.json({ error: "id and content required" }, { status: 400 });
  }

  const { data: msg } = await db
    .from("discord_messages")
    .select("id, discord_message_id, discord_user_id, discord_username, channel_id, guild_id")
    .eq("id", body.id)
    .maybeSingle();
  if (!msg) return NextResponse.json({ error: "no such message" }, { status: 404 });

  const ok = await sendDiscordReply({
    channelId: msg.channel_id as string,
    replyToMessageId: msg.discord_message_id as string,
    content: body.content.trim(),
  });
  if (!ok) return NextResponse.json({ error: "discord send failed" }, { status: 502 });

  // Log the outbound for the record, and close the question.
  await db.from("discord_messages").insert({
    discord_message_id: msg.discord_message_id,
    discord_user_id: msg.discord_user_id,
    discord_username: msg.discord_username,
    channel_id: msg.channel_id,
    guild_id: msg.guild_id,
    content: body.content.trim(),
    direction: "out",
    answered: true,
  });
  await db.from("discord_messages").update({ answered: true }).eq("id", body.id);

  return NextResponse.json({ ok: true });
}

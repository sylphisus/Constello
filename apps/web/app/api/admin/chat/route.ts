import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

// The on-platform chat inbox (manual alpha). A constellation's owner asks about
// their own world — the readings of their collections + their essence — and
// Ethan answers by hand:
//
//  GET  → unanswered owner messages, each with a ready-to-paste `contextText`:
//         their essence, the reading of each collection, and the conversation so
//         far. The frame is minimal and neutral — Opus draws the depth, we don't
//         command it (same discipline as the reading prompt).
//  POST → { id, content } saves `content` as the 'assistant' reply in the thread
//         and marks the question answered. It appears on the owner's page.

type Db = NonNullable<ReturnType<typeof supabase>>;

interface ThreadMsg {
  role: string;
  content: string;
  created_at: string;
}

// The asker's own world: current essence + every collection (source · label)
// paired with its reading, so Opus is grounded in what's actually been entered.
async function world(
  db: Db,
  constellationId: string,
): Promise<{
  essence: string | null;
  collections: { source: string; label: string; reading: string | null }[];
}> {
  const { data: essence } = await db
    .from("essences")
    .select("artifact")
    .eq("constellation_id", constellationId)
    .maybeSingle();

  const { data: entries } = await db
    .from("entries")
    .select("id, source, label")
    .eq("constellation_id", constellationId)
    .order("created_at", { ascending: true });
  const rows = entries ?? [];
  const ids = rows.map((e) => e.id as string);

  let readingByEntry = new Map<string, string>();
  if (ids.length) {
    const { data: rs } = await db
      .from("readings")
      .select("entry_id, artifact")
      .in("entry_id", ids);
    readingByEntry = new Map(
      (rs ?? []).map((r) => [r.entry_id as string, r.artifact as string]),
    );
  }

  const collections = rows.map((e) => ({
    source: e.source as string,
    label: (e.label as string) || "",
    reading: readingByEntry.get(e.id as string) ?? null,
  }));
  return { essence: (essence?.artifact as string) ?? null, collections };
}

function buildContextText(args: {
  essence: string | null;
  collections: { source: string; label: string; reading: string | null }[];
  thread: ThreadMsg[];
}): string {
  const parts: string[] = [];
  parts.push("# Constello — a conversation about your constellation\n");
  parts.push(
    "This person is talking with you about their own constellation — the world traced by the things they collect. Their essence and the reading of each collection are below, followed by the conversation so far.\n",
  );

  parts.push("\n## Their essence\n");
  parts.push(args.essence ?? "(No essence written yet.)");

  parts.push("\n\n## Their collections\n");
  if (!args.collections.length) {
    parts.push("(No collections yet.)\n");
  } else {
    args.collections.forEach((c, i) => {
      const head = [c.source, c.label].filter(Boolean).join(" · ");
      parts.push(`\n### Collection ${i + 1} — ${head}\n`);
      parts.push(c.reading ?? "(Not read yet.)");
      parts.push("\n");
    });
  }

  parts.push("\n## The conversation so far\n");
  args.thread.forEach((m) => {
    parts.push(`\n**${m.role === "user" ? "Them" : "You"}:** ${m.content}\n`);
  });

  parts.push(
    "\nRespond to their latest message directly, grounded in their essence and readings above. Speak to them.",
  );
  return parts.join("");
}

export async function GET() {
  const db = supabase();
  if (!db) return NextResponse.json({ error: "No persistence." }, { status: 500 });

  const { data: pending } = await db
    .from("constellation_messages")
    .select("id, constellation_id, content, created_at")
    .eq("role", "user")
    .eq("answered", false)
    .order("created_at", { ascending: true });

  const questions = [];
  for (const m of pending ?? []) {
    const constellationId = m.constellation_id as string;
    const { essence, collections } = await world(db, constellationId);
    // The thread up to and including this question.
    const { data: thread } = await db
      .from("constellation_messages")
      .select("role, content, created_at")
      .eq("constellation_id", constellationId)
      .lte("created_at", m.created_at)
      .order("created_at", { ascending: true });

    questions.push({
      id: m.id,
      constellationId,
      content: m.content,
      createdAt: m.created_at,
      hasEssence: Boolean(essence),
      readings: collections.filter((c) => c.reading).length,
      contextText: buildContextText({
        essence,
        collections,
        thread: (thread ?? []) as ThreadMsg[],
      }),
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
    .from("constellation_messages")
    .select("id, constellation_id")
    .eq("id", body.id)
    .maybeSingle();
  if (!msg) return NextResponse.json({ error: "no such message" }, { status: 404 });

  // Save the reply in the thread, then close the question.
  await db.from("constellation_messages").insert({
    constellation_id: msg.constellation_id,
    role: "assistant",
    content: body.content.trim(),
    answered: true,
  });
  await db
    .from("constellation_messages")
    .update({ answered: true })
    .eq("id", body.id);

  return NextResponse.json({ ok: true });
}

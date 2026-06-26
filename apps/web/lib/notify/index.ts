import { supabase } from "@/lib/supabase";
import { sendEmail } from "./email";
import { sendImessage } from "./imessage";
import { sendMention } from "./twitter";

// Notify a constellation's contacts that a reading (or its essence) has landed.
// Best-effort and idempotent: each (contact, kind, ref) is sent at most once
// (logged in `notifications`); a missing channel config or a send failure never
// blocks the other channels or the caller.
//
// Private channels (email, imessage, twitter DM) carry the constellation link —
// an unguessable bearer URL. We never put that link on a public surface; a
// public mention could only ever be the knock, never the link (see the design
// note in lib/notify/twitter.ts).

export type NotifyKind = "reading" | "essence";

interface Contact {
  id: string;
  channel: "email" | "imessage" | "twitter";
  address: string;
  verified: boolean;
}

function appUrl(): string {
  return (process.env.APP_URL ?? "https://constello.xyz").replace(/\/$/, "");
}

// Spare, observatory register — the knock, not the meaning. No emoji, no hype.
// `message` carries the bearer link (private channels only); `knock` is linkless
// for the public twitter mention.
function message(kind: NotifyKind, link: string): string {
  return `${knock(kind, true)}\n${link}`;
}

function knock(kind: NotifyKind, capitalize = false): string {
  const line =
    kind === "essence"
      ? "your essence has been written."
      : "your constellation has been read.";
  return capitalize ? line.charAt(0).toUpperCase() + line.slice(1) : line;
}

export async function notifyReadingReady(args: {
  constellationId: string;
  kind: NotifyKind;
  ref: string; // entry_id for a reading, constellation_id for an essence
}): Promise<void> {
  const db = supabase();
  if (!db) return;

  const { data: contacts } = await db
    .from("contacts")
    .select("id, channel, address, verified")
    .eq("constellation_id", args.constellationId);
  if (!contacts?.length) return;

  const link = `${appUrl()}/c/${args.constellationId}`;

  for (const c of contacts as Contact[]) {
    // Never notify an unverified contact. Email opt-in and the iMessage inbound
    // capture set verified=true at the point of consent; a twitter handle stays
    // unverified until it's confirmed to follow @constello (the follow gate).
    if (!c.verified) continue;

    // Skip anything already sent for this exact (contact, kind, ref).
    const { data: prior } = await db
      .from("notifications")
      .select("id")
      .eq("contact_id", c.id)
      .eq("kind", args.kind)
      .eq("ref", args.ref)
      .maybeSingle();
    if (prior) continue;

    let ok = false;
    try {
      if (c.channel === "email") ok = await sendEmail(c.address, args.kind, link);
      else if (c.channel === "imessage")
        ok = await sendImessage(c.address, message(args.kind, link));
      else if (c.channel === "twitter")
        ok = await sendMention(c.address, knock(args.kind)); // linkless — public
    } catch (err) {
      console.error(`[notify] ${c.channel} send threw:`, err);
    }

    if (ok) {
      await db.from("notifications").insert({
        constellation_id: args.constellationId,
        contact_id: c.id,
        kind: args.kind,
        ref: args.ref,
        channel: c.channel,
      });
    }
  }
}

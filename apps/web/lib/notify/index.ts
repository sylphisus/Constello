import { supabase } from "@/lib/supabase";
import { sendEmail } from "./email";
import { sendImessage } from "./imessage";
import { sendDiscordPing } from "./discord";

// Notify a constellation's contacts that a reading (or its essence) has landed.
// Best-effort and idempotent: each (contact, kind, ref) is sent at most once
// (logged in `notifications`); a missing channel config or a send failure never
// blocks the other channels or the caller.
//
// Private channels (email, imessage) carry the constellation link — an
// unguessable bearer URL. Discord is a public @mention in a mutual server, so it
// carries the knock only, never the link (see lib/notify/discord.ts).
//
// The X / twitter channel is NOT auto-sent here: it's handled MANUALLY in the
// admin console (no API token, no cost). Handles are still captured as twitter
// contacts; the admin surfaces each with a follow-check link and a ready-to-paste
// knock that Ethan posts from @03constello by hand.

// reading/essence land on your own constellation; share/request are connection
// events (someone shared with you, or asked to see you).
export type NotifyKind = "reading" | "essence" | "share" | "request";

interface Contact {
  id: string;
  channel: "email" | "imessage" | "twitter" | "discord";
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
      : kind === "share"
        ? "someone shared their constellation with you."
        : kind === "request"
          ? "someone asked to see your constellation."
          : "your constellation has been read.";
  return capitalize ? line.charAt(0).toUpperCase() + line.slice(1) : line;
}

// A reading/essence landed on the recipient's own constellation.
export async function notifyReadingReady(args: {
  constellationId: string;
  kind: NotifyKind;
  ref: string; // entry_id for a reading, constellation_id for an essence
}): Promise<void> {
  return notify({ ...args, link: `${appUrl()}/c/${args.constellationId}` });
}

// A connection event for the recipient: someone shared with them ('share') or
// asked to see them ('request'). `ref` is the *other* constellation's id, so the
// (contact, kind, ref) idempotency key is once-per-other-party. The link goes to
// the recipient's own constellation, from which they open the Connections sidebar.
export async function notifyConnection(args: {
  recipientId: string;
  kind: "share" | "request";
  ref: string;
}): Promise<void> {
  return notify({
    constellationId: args.recipientId,
    kind: args.kind,
    ref: args.ref,
    link: `${appUrl()}/c/${args.recipientId}`,
  });
}

async function notify(args: {
  constellationId: string;
  kind: NotifyKind;
  ref: string;
  link: string;
}): Promise<void> {
  const db = supabase();
  if (!db) return;

  const { data: contacts } = await db
    .from("contacts")
    .select("id, channel, address, verified")
    .eq("constellation_id", args.constellationId);
  if (!contacts?.length) return;

  const link = args.link;

  for (const c of contacts as Contact[]) {
    // Never notify an unverified contact. Email opt-in and the iMessage inbound
    // capture set verified=true at the point of consent; a discord handle is
    // verified at opt-in iff it resolved to a member of the mutual server
    // (membership is the gate). (twitter never auto-sends — see the note above.)
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
      // twitter: intentionally no branch — mentioned by hand from the admin console.
      else if (c.channel === "discord")
        ok = await sendDiscordPing(c.address, knock(args.kind)); // linkless — public
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

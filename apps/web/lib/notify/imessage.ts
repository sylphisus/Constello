// Outbound iMessage via a self-hosted BlueBubbles server — a Mac signed into
// iMessage, reachable from here through a tunnel (replaces the former Photon /
// spectrum-ts path). Best-effort + env-gated: without BLUEBUBBLES_SERVER_URL /
// BLUEBUBBLES_PASSWORD the send is skipped, like the other channels.
//
// We only ever send to a handle that texted us FIRST — the inbound webhook is the
// sole creator of `imessage` contacts (app/api/inbound/imessage; the public
// /api/contact no longer accepts the channel). So every send is a reply inside an
// existing thread, never a cold blast — which is what keeps the Apple ID off the
// spam heuristics.
//   https://docs.bluebubbles.app/server/developer-guides/rest-api-and-webhooks

import { randomUUID } from "node:crypto";

export async function sendImessage(toHandle: string, text: string): Promise<boolean> {
  const server = process.env.BLUEBUBBLES_SERVER_URL;
  const password = process.env.BLUEBUBBLES_PASSWORD;
  if (!server || !password) {
    console.warn("[notify/imessage] BLUEBUBBLES_SERVER_URL / _PASSWORD not set — skipped.");
    return false;
  }

  const url = `${server.replace(/\/$/, "")}/api/v1/message/text?password=${encodeURIComponent(password)}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // `any;-;<addr>` lets the server resolve the existing iMessage/SMS chat for
      // the handle (reply-in-thread). tempGuid is a client-side dedup id.
      body: JSON.stringify({
        chatGuid: `any;-;${toHandle}`,
        tempGuid: `temp-${randomUUID()}`,
        message: text,
      }),
    });
    if (!res.ok) {
      console.error(`[notify/imessage] BlueBubbles ${res.status}: ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[notify/imessage] send failed:", err);
    return false;
  }
}

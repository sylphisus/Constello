// X / Twitter notification — a PUBLIC @mention, follow-gated.
//
// Public by design: broadcasting that someone was read is on-thesis (cultural
// propagation, philosophy §11). But a public tweet is visible to everyone, so it
// can NEVER carry the constellation link (an unguessable bearer URL) — the mention
// is the contentless knock only; the person reaches their reading via the link
// they already hold. Follow-gating doesn't make the tweet private; it's a consent
// + anti-impersonation + deliverability gate: we only mention handles that opted
// in by following @03constello from the same handle they submitted, and mentions
// from followers are filtered less.
//
// The follow requirement is ENFORCED upstream by the `verified` gate in
// lib/notify/index.ts — a twitter contact is only mentioned once it's marked
// verified (= confirmed to follow @03constello). Verifying is manual for the alpha
// (the X follows-lookup is gated on low API tiers); an automated check can flip
// `verified` later.
//
// Env-gated + best-effort: without X_USER_TOKEN (OAuth2 user-context, tweet.write
// + users.read) the send is skipped. ⚠️ This reintroduces an X credential in prod,
// which the project otherwise keeps off-platform (the local gallery-dl bridge).

export async function sendMention(handle: string, text: string): Promise<boolean> {
  const token = process.env.X_USER_TOKEN;
  if (!token) {
    console.warn("[notify/twitter] X_USER_TOKEN not set — skipped.");
    return false;
  }
  const username = handle.replace(/^@/, "");

  try {
    const res = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: `@${username} ${text}` }),
    });
    if (!res.ok) {
      console.error(`[notify/twitter] tweet ${res.status}: ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[notify/twitter] request failed:", err);
    return false;
  }
}

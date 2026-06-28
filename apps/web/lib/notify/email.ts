import type { NotifyKind } from "./index";

// Transactional email via Resend (https://resend.com). Best-effort, like
// lib/embed / lib/supabase: without RESEND_API_KEY + RESEND_FROM the send is
// skipped and the caller logs it instead. RESEND_FROM is an address on a
// domain verified in Resend, e.g. "Constello <readings@constello.xyz>".

export async function sendEmail(
  to: string,
  kind: NotifyKind,
  link: string,
): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!key || !from) {
    console.warn("[notify/email] RESEND_API_KEY / RESEND_FROM not set — skipped.");
    return false;
  }

  const subject =
    kind === "essence"
      ? "Your essence has been written."
      : kind === "share"
        ? "Someone shared their constellation with you."
        : kind === "request"
          ? "Someone asked to see your constellation."
          : "Your constellation has been read.";
  const text = `${subject}\n\n${link}`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, text }),
    });
    if (!res.ok) {
      console.error(`[notify/email] Resend ${res.status}: ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[notify/email] request failed:", err);
    return false;
  }
}

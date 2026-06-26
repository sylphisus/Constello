"use client";

import { useState } from "react";

// Email opt-in: be told when a reading lands. (The iMessage opt-in happens by
// texting our line; the X handle is captured from the X tab.) Spare on purpose —
// the knock, not the meaning.
export default function NotifyMe({ constellationId }: { constellationId: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");

  async function save() {
    if (!email.trim() || state === "busy") return;
    setState("busy");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          constellationId,
          channel: "email",
          address: email.trim(),
        }),
      });
      if (!res.ok) throw new Error();
      setState("done");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return <p className="notify-done">We&apos;ll write when your reading lands.</p>;
  }

  return (
    <div className="notify-me section-gap">
      <input
        className="handle-input"
        type="email"
        placeholder="email — we'll tell you when it's read"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && save()}
      />
      <button
        className="ghost-btn"
        disabled={!email.trim() || state === "busy"}
        onClick={save}
      >
        {state === "busy" ? "…" : "Notify me"}
      </button>
      {state === "error" && <p className="error">Could not save — try again.</p>}
    </div>
  );
}

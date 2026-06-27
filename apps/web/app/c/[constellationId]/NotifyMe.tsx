"use client";

import { useState } from "react";
import { X_HANDLE } from "@/lib/brand";

// Opt-in to be told when a reading lands. Three channels behind one spare chooser
// — the knock, not the meaning:
//   • email     — type it; we write you. (verified on opt-in)
//   • imessage  — a button that opens Messages to our line with the constellation
//                 tag prefilled; *sending it* is the opt-in (the inbound webhook
//                 captures the handle — app/api/inbound/imessage). Shown only when
//                 a line is configured.
//   • x         — type your handle (captured here, unverified) then follow
//                 @03constello so we can publicly @mention you — never the link.
//   • discord   — type your username; we resolve it to a member of the mutual
//                 server and @ping you there when your reading lands (public
//                 knock, never the link). Shown only when the bot is configured.
type Channel = "email" | "imessage" | "twitter" | "discord";

export default function NotifyMe({
  constellationId,
  imessageNumber,
  discordEnabled,
}: {
  constellationId: string;
  imessageNumber?: string;
  discordEnabled?: boolean;
}) {
  const [channel, setChannel] = useState<Channel>("email");

  const tabs: { key: Channel; label: string }[] = [
    { key: "email", label: "Email" },
    ...(imessageNumber ? [{ key: "imessage" as Channel, label: "iMessage" }] : []),
    { key: "twitter", label: "X" },
    ...(discordEnabled ? [{ key: "discord" as Channel, label: "Discord" }] : []),
  ];

  return (
    <div className="notify-me section-gap">
      <div className="mode-tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            className="mode-tab"
            aria-pressed={channel === t.key}
            onClick={() => setChannel(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {channel === "email" && <EmailOptIn constellationId={constellationId} />}
      {channel === "imessage" && imessageNumber && (
        <ImessageOptIn constellationId={constellationId} number={imessageNumber} />
      )}
      {channel === "twitter" && <TwitterOptIn constellationId={constellationId} />}
      {channel === "discord" && <DiscordOptIn constellationId={constellationId} />}
    </div>
  );
}

function EmailOptIn({ constellationId }: { constellationId: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");

  async function save() {
    if (!email.trim() || state === "busy") return;
    setState("busy");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ constellationId, channel: "email", address: email.trim() }),
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
    <>
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
    </>
  );
}

// No API call and no "done" state: the opt-in happens device-side. The deep link
// opens Messages to our line pre-addressed with the constellation tag in the body;
// the inbound webhook reads the uuid out of the text they send.
function ImessageOptIn({
  constellationId,
  number,
}: {
  constellationId: string;
  number: string;
}) {
  const body = `Tell me when my constellation is read — ${constellationId}`;
  const href = `sms:${number}?&body=${encodeURIComponent(body)}`;
  return (
    <>
      <a className="ghost-btn" href={href}>
        Text us to be notified
      </a>
      <p className="note">
        Opens Messages to our line with your constellation tag prefilled — just hit
        send, and we&apos;ll text you the moment your reading lands.
      </p>
    </>
  );
}

function TwitterOptIn({ constellationId }: { constellationId: string }) {
  const [handle, setHandle] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");

  async function save() {
    const address = handle.trim().replace(/^@/, "");
    if (!address || state === "busy") return;
    setState("busy");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ constellationId, channel: "twitter", address }),
      });
      if (!res.ok) throw new Error();
      setState("done");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <p className="notify-done">
        Saved. Now follow{" "}
        <a className="text-link" href={`https://x.com/${X_HANDLE}`} target="_blank" rel="noreferrer">
          @{X_HANDLE} ↗
        </a>{" "}
        from @{handle.trim().replace(/^@/, "")} — that&apos;s how we reach you. We
        @mention you when your reading lands (never the link).
      </p>
    );
  }

  return (
    <>
      <input
        className="handle-input"
        type="text"
        placeholder="your @handle on X"
        value={handle}
        onChange={(e) => setHandle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && save()}
      />
      <button
        className="ghost-btn"
        disabled={!handle.trim() || state === "busy"}
        onClick={save}
      >
        {state === "busy" ? "…" : "Notify me on X"}
      </button>
      {state === "error" && <p className="error">Could not save — try again.</p>}
    </>
  );
}

// Type a Discord username; the server resolves it to a member of the mutual
// server. `verified` in the response is false when the username isn't found in
// the server (or the bot isn't configured) — then they need to join first.
function DiscordOptIn({ constellationId }: { constellationId: string }) {
  const [handle, setHandle] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "notfound" | "error">("idle");

  async function save() {
    const address = handle.trim().replace(/^@/, "");
    if (!address || state === "busy") return;
    setState("busy");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ constellationId, channel: "discord", address }),
      });
      if (!res.ok) throw new Error();
      const { verified } = (await res.json()) as { verified?: boolean };
      setState(verified ? "done" : "notfound");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <p className="notify-done">
        Found you. We&apos;ll @ping you in the server when your reading lands (the
        knock — never the link).
      </p>
    );
  }

  return (
    <>
      <input
        className="handle-input"
        type="text"
        placeholder="your Discord username"
        value={handle}
        onChange={(e) => setHandle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && save()}
      />
      <button
        className="ghost-btn"
        disabled={!handle.trim() || state === "busy"}
        onClick={save}
      >
        {state === "busy" ? "…" : "Notify me on Discord"}
      </button>
      {state === "notfound" && (
        <p className="note">
          Couldn&apos;t find that username in the server — join it first, then try
          again.
        </p>
      )}
      {state === "error" && <p className="error">Could not save — try again.</p>}
    </>
  );
}

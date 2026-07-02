"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

// The owner in conversation with their reading — about their own collections and
// essence. Manual alpha: a sent message is queued (no live model) and the reply
// appears here once it's fulfilled from the admin console. Mirrors AddEntry: on
// send we just refresh, and the new message comes back from the server.
export default function Chat({
  constellationId,
  thread,
}: {
  constellationId: string;
  thread: ChatMessage[];
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // The last message in the thread is the owner's → still awaiting a reply.
  const awaiting =
    thread.length > 0 && thread[thread.length - 1].role === "user";

  async function send() {
    const content = text.trim();
    if (!content || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ constellationId, content }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not send.");
      setText("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="chat-block">
      <p className="chat-eyebrow">Ask about your constellation</p>
      {thread.length === 0 ? (
        <p className="framing">
          Talk to your reading — ask about a collection, a thread in your essence,
          what it sees in you. Replies arrive by hand, like your readings do.
        </p>
      ) : (
        <div className="chat-thread">
          {thread.map((m) => (
            <div key={m.id} className={`chat-msg chat-${m.role}`}>
              {m.content}
            </div>
          ))}
          {awaiting && (
            <p className="thinking chat-pending">
              queued — your reply will appear here…
            </p>
          )}
        </div>
      )}

      <textarea
        className="body-input"
        placeholder="Ask anything about your constellation…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
        }}
      />
      <div className="actions" style={{ marginTop: 12 }}>
        <button
          className="primary-btn"
          disabled={!text.trim() || busy}
          onClick={send}
        >
          {busy ? "Sending…" : "Send"}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </section>
  );
}

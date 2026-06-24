"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Landing / first entry. Stores the first piece (no model call) and routes the
// person to their constellation, where readings appear as they're fulfilled by
// hand. Three sources, same as the add-piece flow:
//   - text:    paste / upload writing        → /api/submit
//   - lastfm:  a Last.fm username            → /api/collections/lastfm
//   - twitter: an X / Twitter handle         → /api/collections/twitter
// No title field — if a piece needs a title, it lives inside the piece.
type Mode = "text" | "lastfm" | "twitter";

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("text");
  const [rawText, setRawText] = useState("");
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const ready = mode === "text" ? rawText.trim() : handle.trim();

  async function onFile(file: File | undefined) {
    if (!file) return;
    setRawText(await file.text());
  }

  async function begin() {
    if (!ready || busy) return;
    setBusy(true);
    setError("");
    try {
      const endpoint = mode === "text" ? "/api/submit" : `/api/collections/${mode}`;
      const payload =
        mode === "text"
          ? { rawText }
          : mode === "lastfm"
            ? { username: handle }
            : { handle };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      router.push(`/c/${data.constellationId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <main className="wrap">
      <div className="mark">
        <h1>Constello</h1>
        <p>Begin your constellation</p>
      </div>

      <p className="framing">
        Bring something you've kept or gathered — writing of your own, what you
        listen to, what you post. It gets read for the world underneath it. You
        can add more pieces after.
      </p>

      <div className="mode-tabs">
        {(["text", "lastfm", "twitter"] as Mode[]).map((m) => (
          <button
            key={m}
            className="mode-tab"
            aria-pressed={mode === m}
            onClick={() => {
              setMode(m);
              setError("");
            }}
          >
            {m === "text" ? "Text" : m === "lastfm" ? "Last.fm" : "X"}
          </button>
        ))}
      </div>

      {mode === "text" ? (
        <>
          <textarea
            className="body-input"
            placeholder="Paste it here…"
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
          />
          <div className="piece-row">
            <label className="file-label">
              or attach a .txt / .md file
              <input
                type="file"
                accept=".txt,.md,.markdown,text/plain,text/markdown"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
            </label>
          </div>
        </>
      ) : (
        <input
          className="handle-input"
          placeholder={mode === "lastfm" ? "your Last.fm username" : "@handle"}
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && begin()}
        />
      )}

      <div className="actions" style={{ marginTop: 16 }}>
        <button className="primary-btn" disabled={!ready || busy} onClick={begin}>
          {busy ? "Beginning…" : "Begin"}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </main>
  );
}

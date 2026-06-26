"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Landing / first entry. Stores the first piece (no model call) and routes the
// person to their constellation, where readings appear as they're fulfilled by
// hand. Four sources, same as the add-piece flow:
//   - text:      paste / upload writing      → /api/submit
//   - lastfm:    a Last.fm username          → /api/collections/lastfm
//   - twitter:   an X / Twitter handle       → /api/collections/twitter
//   - pinterest: connect (OAuth) their boards → /api/auth/pinterest
// No title field — if a piece needs a title, it lives inside the piece.
type Mode = "text" | "lastfm" | "twitter" | "pinterest";

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("text");
  const [rawText, setRawText] = useState("");
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // The Pinterest connect flow round-trips through Pinterest and lands back here
  // with ?pinterestError on failure (declined consent, expired session, etc.).
  useEffect(() => {
    const err = new URLSearchParams(window.location.search).get("pinterestError");
    if (err) {
      setMode("pinterest");
      setError(err);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

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
        {(["text", "lastfm", "twitter", "pinterest"] as Mode[]).map((m) => (
          <button
            key={m}
            className="mode-tab"
            aria-pressed={mode === m}
            onClick={() => {
              setMode(m);
              setError("");
            }}
          >
            {m === "text" ? "Text" : m === "lastfm" ? "Last.fm" : m === "twitter" ? "X" : "Pinterest"}
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
      ) : mode === "pinterest" ? (
        <p className="framing">
          Connect Pinterest to read the worlds in your boards — what you kept, and
          why these and not others. Only your public boards are read.
        </p>
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
        {mode === "pinterest" ? (
          <button
            className="primary-btn"
            onClick={() => (window.location.href = "/api/auth/pinterest")}
          >
            Connect Pinterest
          </button>
        ) : (
          <button className="primary-btn" disabled={!ready || busy} onClick={begin}>
            {busy ? "Beginning…" : "Begin"}
          </button>
        )}
      </div>
      {error && <p className="error">{error}</p>}
    </main>
  );
}

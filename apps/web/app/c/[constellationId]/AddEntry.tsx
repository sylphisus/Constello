"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Add another collection to an existing constellation. Three sources:
//   - text:    paste / upload writing            → /api/submit
//   - lastfm:  a Last.fm username (listening)     → /api/collections/lastfm
//   - twitter: an X / Twitter handle (posting)    → /api/collections/twitter
// All are stored pending; the reading is fulfilled by hand later. No title
// field — a title, if any, lives inside the piece.

type Mode = "text" | "lastfm" | "twitter";

export default function AddEntry({ constellationId }: { constellationId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
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

  async function add() {
    if (!ready || busy) return;
    setBusy(true);
    setError("");
    try {
      const endpoint =
        mode === "text" ? "/api/submit" : `/api/collections/${mode}`;
      const payload =
        mode === "text"
          ? { constellationId, rawText }
          : mode === "lastfm"
            ? { constellationId, username: handle }
            : { constellationId, handle };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add.");
      setRawText("");
      setHandle("");
      setOpen(false);
      // This collection may already live on another constellation (dedupe is
      // global) — in that case route there; otherwise just refresh this one.
      if (data.constellationId && data.constellationId !== constellationId) {
        router.push(`/c/${data.constellationId}`);
      } else {
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="section-gap">
        <button className="ghost-btn" onClick={() => setOpen(true)}>
          + Add another piece
        </button>
      </div>
    );
  }

  return (
    <div className="section-gap">
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
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
      )}

      <div className="actions" style={{ marginTop: 12 }}>
        <button className="primary-btn" disabled={!ready || busy} onClick={add}>
          {busy ? "Adding…" : "Add piece"}
        </button>
        <button className="ghost-btn" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}

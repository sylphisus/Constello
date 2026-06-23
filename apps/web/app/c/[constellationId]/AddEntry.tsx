"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Add another collection to an existing constellation. Stored pending; the
// reading is fulfilled by hand later. No title field — a title, if any, lives
// inside the piece.
export default function AddEntry({ constellationId }: { constellationId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rawText, setRawText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onFile(file: File | undefined) {
    if (!file) return;
    setRawText(await file.text());
  }

  async function add() {
    if (!rawText.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ constellationId, rawText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add.");
      setRawText("");
      setOpen(false);
      router.refresh();
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
      <div className="actions" style={{ marginTop: 12 }}>
        <button
          className="primary-btn"
          disabled={!rawText.trim() || busy}
          onClick={add}
        >
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

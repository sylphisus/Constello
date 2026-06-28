"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import GoogleDocsButton from "@/components/GoogleDocsButton";
import ObsidianButton from "@/components/ObsidianButton";

// Add another collection to an existing constellation. Sources:
//   - text:        paste / upload writing          → /api/submit
//   - lastfm:      a Last.fm username (listening)   → /api/collections/lastfm
//   - twitter:     an X / Twitter handle (posting)  → /api/collections/twitter
//   - pinterest:   connect (OAuth) their boards     → /api/auth/pinterest
//   - spotify:     connect (OAuth) their library    → /api/auth/spotify
//   - notion:      connect (OAuth) databases        → /api/auth/notion
//   - google-docs: pick a doc (Google Picker)       → /api/collections/google-docs
//   - obsidian:    upload a vault folder            → /api/collections/obsidian
//   - images:      upload any images (≤10)          → /api/collections/images
// All are stored pending; the reading is fulfilled by hand later. No title
// field — a title, if any, lives inside the piece.

type Mode =
  | "text"
  | "images"
  | "lastfm"
  | "twitter"
  | "pinterest"
  | "spotify"
  | "notion"
  | "google-docs"
  | "obsidian";

const MODES: Mode[] = [
  "text", "images", "lastfm", "twitter", "pinterest", "spotify", "notion", "google-docs", "obsidian",
];

// Sources that round-trip through an OAuth consent page instead of posting a
// handle/body inline.
const isConnect = (m: Mode) => m === "pinterest" || m === "spotify" || m === "notion";

const labels: Record<Mode, string> = {
  text: "Text",
  images: "Images",
  lastfm: "Last.fm",
  twitter: "X",
  pinterest: "Pinterest",
  spotify: "Spotify",
  notion: "Notion",
  "google-docs": "Google Docs",
  obsidian: "Obsidian",
};

export default function AddEntry({ constellationId }: { constellationId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("text");
  const [rawText, setRawText] = useState("");
  const [handle, setHandle] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const ready =
    mode === "text" ? rawText.trim() : mode === "images" ? files.length : handle.trim();

  async function onFile(file: File | undefined) {
    if (!file) return;
    setRawText(await file.text());
  }

  async function addImages() {
    if (!files.length || busy) return;
    if (files.length > 10) {
      setError("Up to 10 images at a time.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      for (const f of files) body.append("images", f);
      body.append("constellationId", constellationId);
      const res = await fetch("/api/collections/images", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not add.");
      setFiles([]);
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add.");
    } finally {
      setBusy(false);
    }
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
        {MODES.map((m) => (
          <button
            key={m}
            className="mode-tab"
            aria-pressed={mode === m}
            onClick={() => {
              setMode(m);
              setError("");
            }}
          >
            {labels[m]}
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
      ) : mode === "images" ? (
        <>
          <p className="framing">
            Add any set of images you want — up to 10 at a time. The images
            themselves are read.
          </p>
          <div className="piece-row">
            <label className="file-label">
              {files.length ? `${files.length} selected — choose again to change` : "choose images"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                onChange={(e) => setFiles(e.target.files ? Array.from(e.target.files) : [])}
              />
            </label>
          </div>
        </>
      ) : mode === "pinterest" ? (
        <p className="framing">
          Connect Pinterest to add the worlds in your boards. Only your public
          boards are read.
        </p>
      ) : mode === "spotify" ? (
        <p className="framing">
          Connect Spotify to add what you listen to — your playlists, top
          artists, and saved music. Read once, never stored.
        </p>
      ) : mode === "notion" ? (
        <p className="framing">
          Connect Notion and choose which databases to share. Read once, never
          stored.
        </p>
      ) : mode === "google-docs" ? (
        <p className="framing">
          Pick a Google Doc to add a piece of your own writing. Only the doc you
          choose is read.
        </p>
      ) : mode === "obsidian" ? (
        <p className="framing">
          Choose your Obsidian vault folder to add the world in your notes. It’s
          read in your browser; only the notes you import leave your machine.
        </p>
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
        {isConnect(mode) ? (
          <button
            className="primary-btn"
            onClick={() =>
              (window.location.href = `/api/auth/${mode}?constellationId=${encodeURIComponent(
                constellationId,
              )}`)
            }
          >
            Connect {labels[mode]}
          </button>
        ) : mode === "google-docs" ? (
          <GoogleDocsButton constellationId={constellationId} />
        ) : mode === "obsidian" ? (
          <ObsidianButton constellationId={constellationId} />
        ) : mode === "images" ? (
          <button className="primary-btn" disabled={!ready || busy} onClick={addImages}>
            {busy ? "Adding…" : "Add images"}
          </button>
        ) : (
          <button className="primary-btn" disabled={!ready || busy} onClick={add}>
            {busy ? "Adding…" : "Add piece"}
          </button>
        )}
        <button className="ghost-btn" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}

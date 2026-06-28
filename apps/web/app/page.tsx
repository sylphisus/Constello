"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import GoogleDocsButton from "@/components/GoogleDocsButton";
import ObsidianButton from "@/components/ObsidianButton";

// Landing / first entry. Stores the first piece (no model call) and routes the
// person to their constellation, where readings appear as they're fulfilled by
// hand. Sources, same as the add-piece flow:
//   - text:        paste / upload writing        → /api/submit
//   - lastfm:      a Last.fm username            → /api/collections/lastfm
//   - twitter:     an X / Twitter handle         → /api/collections/twitter
//   - pinterest:   connect (OAuth) their boards  → /api/auth/pinterest
//   - spotify:     connect (OAuth) their library → /api/auth/spotify
//   - notion:      connect (OAuth) databases     → /api/auth/notion
//   - google-docs: pick a doc (Google Picker)    → /api/collections/google-docs
//   - obsidian:    upload a vault folder         → /api/collections/obsidian
//   - images:      upload any images (≤10)       → /api/collections/images
// No title field — if a piece needs a title, it lives inside the piece.
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

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("text");
  const [rawText, setRawText] = useState("");
  const [handle, setHandle] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // The OAuth connect flows round-trip through the provider and land back here
  // with ?pinterestError / ?spotifyError on failure (declined consent, expired
  // session, etc.).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    for (const m of ["pinterest", "spotify", "notion"] as const) {
      const err = params.get(`${m}Error`);
      if (err) {
        setMode(m);
        setError(err);
        window.history.replaceState(null, "", window.location.pathname);
        break;
      }
    }
  }, []);

  const ready =
    mode === "text" ? rawText.trim() : mode === "images" ? files.length : handle.trim();

  async function onFile(file: File | undefined) {
    if (!file) return;
    setRawText(await file.text());
  }

  async function beginImages() {
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
      const res = await fetch("/api/collections/images", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      router.push(`/c/${data.constellationId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
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
            Bring any set of images — up to 10 at a time. What you gathered gets
            read for the world underneath it. You can add or remove images after.
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
          Connect Pinterest to read the worlds in your boards — what you kept, and
          why these and not others. Only your public boards are read.
        </p>
      ) : mode === "spotify" ? (
        <p className="framing">
          Connect Spotify to read what you listen to — your playlists, top
          artists, and saved music. Read once, never stored.
        </p>
      ) : mode === "notion" ? (
        <p className="framing">
          Connect Notion and choose which databases to share — what you decided
          was worth tracking, and the columns you track it by. Read once, never
          stored.
        </p>
      ) : mode === "google-docs" ? (
        <p className="framing">
          Pick a Google Doc to read a piece of your own writing — connect, choose
          the doc, and only that doc is read.
        </p>
      ) : mode === "obsidian" ? (
        <p className="framing">
          Choose your Obsidian vault folder to read the world in your notes — the
          notes and the links between them. It’s read in your browser; only the
          notes you import leave your machine.
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
        {isConnect(mode) ? (
          <button
            className="primary-btn"
            onClick={() => (window.location.href = `/api/auth/${mode}`)}
          >
            Connect {labels[mode]}
          </button>
        ) : mode === "google-docs" ? (
          <GoogleDocsButton />
        ) : mode === "obsidian" ? (
          <ObsidianButton />
        ) : mode === "images" ? (
          <button className="primary-btn" disabled={!ready || busy} onClick={beginImages}>
            {busy ? "Beginning…" : "Begin"}
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

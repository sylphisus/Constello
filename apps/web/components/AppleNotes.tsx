"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Apple Notes connect: there's no API and no readable public share, so the way
// in is to recreate the notes by hand in a Notes-style editor and POST them to
// /api/collections/apple-notes. What someone chooses to bring over is the signal.
//
// One textarea per note, Apple Notes' own convention: the first line is the
// title, the rest is the body. The sidebar lists the notes; the editor shows the
// selected one.

type Draft = { id: number; text: string };

// First non-empty line is the title; everything after it is the body.
function splitNote(text: string): { title: string; body: string } {
  const lines = text.split("\n");
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i++;
  const title = (lines[i] ?? "").trim();
  const body = lines.slice(i + 1).join("\n").trim();
  return { title, body };
}

function preview(text: string): { title: string; snippet: string } {
  const { title, body } = splitNote(text);
  return {
    title: title || "New Note",
    snippet: body.replace(/\s+/g, " ").trim() || "No additional text",
  };
}

// Monotonic ids so deleting/reordering never reuses a key.
let seq = 1;

export default function AppleNotes({
  constellationId,
  onCancel,
}: {
  constellationId: string;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Draft[]>([{ id: 0, text: "" }]);
  const [activeId, setActiveId] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const active = drafts.find((d) => d.id === activeId) ?? drafts[0];
  const filled = drafts.filter((d) => d.text.trim());

  function update(text: string) {
    setDrafts((ds) => ds.map((d) => (d.id === activeId ? { ...d, text } : d)));
  }

  function addNote() {
    const id = seq++;
    setDrafts((ds) => [{ id, text: "" }, ...ds]);
    setActiveId(id);
  }

  function removeNote(id: number) {
    setDrafts((ds) => {
      const next = ds.filter((d) => d.id !== id);
      if (!next.length) {
        const fresh = { id: seq++, text: "" };
        setActiveId(fresh.id);
        return [fresh];
      }
      if (id === activeId) setActiveId(next[0].id);
      return next;
    });
  }

  async function submit() {
    if (!filled.length || busy) return;
    setBusy(true);
    setError("");
    try {
      const notes = filled
        .map((d) => splitNote(d.text))
        .map((n) => ({ title: n.title || "Untitled", body: n.body }));
      const res = await fetch("/api/collections/apple-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ constellationId, notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add your notes.");
      if (data.constellationId && data.constellationId !== constellationId) {
        router.push(`/c/${data.constellationId}`);
      } else {
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add your notes.");
      setBusy(false);
    }
  }

  return (
    <>
      <p className="framing">
        Recreate your Apple Notes here — copy over the ones that say something about
        your world. The first line becomes the title, just like in Notes.
      </p>

      <div className="an-app">
        <aside className="an-sidebar">
          <div className="an-sidebar-head">
            <span>Notes</span>
            <button
              className="an-compose"
              onClick={addNote}
              title="New note"
              aria-label="New note"
            >
              ✎
            </button>
          </div>
          <ul className="an-list">
            {drafts.map((d) => {
              const p = preview(d.text);
              return (
                <li key={d.id}>
                  <button
                    className="an-row"
                    aria-pressed={d.id === activeId}
                    onClick={() => setActiveId(d.id)}
                  >
                    <span className="an-row-title">{p.title}</span>
                    <span className="an-row-snippet">{p.snippet}</span>
                  </button>
                  {drafts.length > 1 && (
                    <button
                      className="an-del"
                      title="Delete note"
                      aria-label="Delete note"
                      onClick={() => removeNote(d.id)}
                    >
                      ✕
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </aside>

        <div className="an-editor">
          <textarea
            className="an-text"
            placeholder={"Title\n\nStart typing, or paste a note…"}
            value={active?.text ?? ""}
            onChange={(e) => update(e.target.value)}
            autoFocus
          />
        </div>
      </div>

      <div className="actions" style={{ marginTop: 12 }}>
        <button className="primary-btn" disabled={!filled.length || busy} onClick={submit}>
          {busy
            ? "Adding…"
            : filled.length > 1
              ? `Add ${filled.length} notes`
              : "Add note"}
        </button>
        <button className="ghost-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </>
  );
}

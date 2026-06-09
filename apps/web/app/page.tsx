"use client";

import { useState } from "react";
import type { Node } from "@/lib/types";

type Status = "editing" | "reading" | "read" | "error";

interface Piece {
  id: string; // client-side id
  label: string;
  rawText: string;
  status: Status;
  node?: Node;
  error?: string;
}

function uid() {
  return Math.random().toString(36).slice(2);
}

function blankPiece(): Piece {
  return { id: uid(), label: "", rawText: "", status: "editing" };
}

/** Split prose into paragraphs on blank lines. */
function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Render the light markdown emphasis the model sometimes emits (*x*, **x**, _x_). */
function renderInline(text: string): React.ReactNode[] {
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_/g;
  const out: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) out.push(<strong key={key++}>{m[1]}</strong>);
    else out.push(<em key={key++}>{m[2] ?? m[3]}</em>);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function Page() {
  const [pieces, setPieces] = useState<Piece[]>([blankPiece()]);
  const [synthesis, setSynthesis] = useState<string | null>(null);
  const [synthStatus, setSynthStatus] = useState<"idle" | "composing" | "error">("idle");
  const [synthError, setSynthError] = useState<string>("");
  const [persisted, setPersisted] = useState<boolean | null>(null);

  function patch(id: string, p: Partial<Piece>) {
    setPieces((cur) => cur.map((x) => (x.id === id ? { ...x, ...p } : x)));
  }

  function addPiece() {
    setPieces((cur) => [...cur, blankPiece()]);
  }

  function removePiece(id: string) {
    setPieces((cur) => {
      const next = cur.filter((x) => x.id !== id);
      return next.length ? next : [blankPiece()];
    });
    // The collection changed → any composed essence is now stale.
    setSynthesis(null);
    setSynthStatus("idle");
  }

  async function onFile(id: string, file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    const nameLabel = file.name.replace(/\.(txt|md|markdown)$/i, "");
    setPieces((cur) =>
      cur.map((x) =>
        x.id === id
          ? { ...x, rawText: text, label: x.label.trim() ? x.label : nameLabel }
          : x,
      ),
    );
  }

  async function readPiece(id: string) {
    const piece = pieces.find((x) => x.id === id);
    if (!piece || !piece.rawText.trim()) return;
    patch(id, { status: "reading", error: undefined });
    try {
      const res = await fetch("/api/collections/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: piece.label, rawText: piece.rawText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Reading failed.");
      patch(id, { status: "read", node: data.node });
      setPersisted(data.persisted);
      setSynthesis(null); // collection changed → any prior essence is stale
      setSynthStatus("idle");
    } catch (err) {
      patch(id, {
        status: "error",
        error: err instanceof Error ? err.message : "Reading failed.",
      });
    }
  }

  async function compose() {
    const read = pieces.filter((p) => p.status === "read" && p.node);
    if (read.length === 0) return;
    setSynthStatus("composing");
    setSynthError("");
    try {
      const nodes = read.map((p) => p.node!);
      const submissions = read.map((p) => ({
        id: p.node!.submissionId,
        label: p.label,
        rawText: p.rawText,
      }));
      const res = await fetch("/api/synthesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodes, submissions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Synthesis failed.");
      setSynthesis(data.synthesis.text);
      setSynthStatus("idle");
    } catch (err) {
      setSynthStatus("error");
      setSynthError(err instanceof Error ? err.message : "Synthesis failed.");
    }
  }

  const readCount = pieces.filter((p) => p.status === "read").length;

  return (
    <main className="wrap">
      <div className="mark">
        <h1>Constello</h1>
        <p>The text you've kept</p>
      </div>

      <p className="framing">
        Bring text you've <strong>accumulated or kept</strong> — writing of your
        own, journal or diary entries, passages you've saved, notes you keep
        returning to, a poem you hold onto. Paste it or attach a file. Each thing
        you add is read on its own, for what it is you carry that made you keep it.
      </p>

      {pieces.map((piece) =>
        piece.status === "read" && piece.node ? (
          <article className="reading-card" key={piece.id}>
            <div className="reading-head">
              <h2 className="title">{piece.node.title}</h2>
              <button className="remove" onClick={() => removePiece(piece.id)}>
                Remove
              </button>
            </div>
            <div className="reading">
              {paragraphs(piece.node.reading).map((p, i) => (
                <p key={i}>{renderInline(p)}</p>
              ))}
            </div>
          </article>
        ) : (
          <div className="piece" key={piece.id}>
            <input
              className="label-input"
              placeholder="a short name for this — optional"
              value={piece.label}
              onChange={(e) => patch(piece.id, { label: e.target.value })}
            />
            <textarea
              className="body-input"
              placeholder="Paste your text here…"
              value={piece.rawText}
              onChange={(e) => patch(piece.id, { rawText: e.target.value })}
            />
            <div className="piece-row">
              <label className="file-label">
                Attach a .txt / .md file
                <input
                  type="file"
                  accept=".txt,.md,.markdown,text/plain,text/markdown"
                  onChange={(e) => onFile(piece.id, e.target.files?.[0])}
                />
              </label>
              {pieces.length > 1 && (
                <button className="remove" onClick={() => removePiece(piece.id)}>
                  Remove
                </button>
              )}
            </div>
            <div className="actions" style={{ marginTop: 16 }}>
              <button
                className="primary-btn"
                disabled={!piece.rawText.trim() || piece.status === "reading"}
                onClick={() => readPiece(piece.id)}
              >
                {piece.status === "reading" ? "Reading…" : "Read this"}
              </button>
              {piece.status === "reading" && (
                <span className="thinking">listening for what's underneath</span>
              )}
            </div>
            {piece.error && <p className="error">{piece.error}</p>}
          </div>
        ),
      )}

      <div className="section-gap">
        <button className="ghost-btn" onClick={addPiece}>
          + Add another piece
        </button>
      </div>

      {readCount >= 1 && (
        <div className="essence-block">
          {synthesis ? (
            <>
              <p className="essence-eyebrow">Your essence</p>
              <div className="essence-text">
                {paragraphs(synthesis).map((p, i) => (
                  <p key={i}>{renderInline(p)}</p>
                ))}
              </div>
              <button
                className="ghost-btn section-gap"
                onClick={compose}
                disabled={synthStatus === "composing"}
              >
                {synthStatus === "composing" ? "Recomposing…" : "Recompose"}
              </button>
            </>
          ) : (
            <div className="actions">
              <button
                className="primary-btn"
                onClick={compose}
                disabled={synthStatus === "composing"}
              >
                {synthStatus === "composing" ? "Composing…" : "Compose your essence"}
              </button>
              {synthStatus === "composing" && (
                <span className="thinking">drawing the portrait across everything</span>
              )}
            </div>
          )}
          {synthStatus === "error" && <p className="error">{synthError}</p>}
        </div>
      )}

      {persisted === false && readCount >= 1 && (
        <p className="persist-flag">
          Running without persistence — add your Supabase keys to keep these.
        </p>
      )}
    </main>
  );
}

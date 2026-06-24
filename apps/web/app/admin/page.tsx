"use client";

import { useEffect, useState, type CSSProperties } from "react";

// Fulfillment console (gated by Basic auth in middleware). Lists pending entries
// with a copy-into-claude.ai block and a paste-the-artifact form, plus an
// essence queue for constellations with 2+ readings.

interface PendingEntry {
  id: string;
  constellation_id: string;
  source: string;
  label: string;
  raw_text: string;
  created_at: string;
}
interface EssenceItem {
  constellationId: string;
  readings: number;
  hasEssence: boolean;
}

const PROMPT = "Conduct a personal analysis of this.";

export default function Admin() {
  const [pending, setPending] = useState<PendingEntry[]>([]);
  const [essenceQueue, setEssenceQueue] = useState<EssenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/pending");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load.");
      setPending(data.pending ?? []);
      setEssenceQueue(data.essenceQueue ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  return (
    <main style={page}>
      <h1>Constello · admin</h1>
      {err && <p style={{ color: "crimson" }}>{err}</p>}
      {loading ? (
        <p>Loading…</p>
      ) : (
        <>
          <h2>Pending readings ({pending.length})</h2>
          {pending.length === 0 && <p>Nothing pending.</p>}
          {pending.map((e) => (
            <PendingCard key={e.id} entry={e} onSaved={load} />
          ))}

          <h2 style={{ marginTop: 32 }}>Essence queue ({essenceQueue.length})</h2>
          {essenceQueue.length === 0 && <p>No constellation has 2+ readings yet.</p>}
          {essenceQueue.map((c) => (
            <EssenceCard key={c.constellationId} item={c} onSaved={load} />
          ))}
        </>
      )}
    </main>
  );
}

function PendingCard({ entry, onSaved }: { entry: PendingEntry; onSaved: () => void }) {
  const [artifact, setArtifact] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const copyText = `${PROMPT}\n\n${entry.raw_text}`;

  async function save() {
    if (!artifact.trim() || busy) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/reading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId: entry.id, artifact }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed.");
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed.");
      setBusy(false);
    }
  }

  return (
    <section style={card}>
      <div style={meta}>
        constellation {entry.constellation_id.slice(0, 8)} · {entry.source} ·{" "}
        {entry.label || "(no label)"}
      </div>
      <p style={hint}>Copy into claude.ai:</p>
      <textarea
        readOnly
        value={copyText}
        style={{ ...ta, height: 120 }}
        onFocus={(e) => e.currentTarget.select()}
      />
      <p style={hint}>Paste the artifact HTML back:</p>
      <textarea
        value={artifact}
        onChange={(e) => setArtifact(e.target.value)}
        style={{ ...ta, height: 160 }}
        placeholder="<div>…</div>"
      />
      <button onClick={save} disabled={!artifact.trim() || busy} style={btn}>
        {busy ? "Saving…" : "Save reading"}
      </button>
      {err && <p style={{ color: "crimson" }}>{err}</p>}
    </section>
  );
}

function EssenceCard({ item, onSaved }: { item: EssenceItem; onSaved: () => void }) {
  const [artifact, setArtifact] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    if (!artifact.trim() || busy) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/essence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ constellationId: item.constellationId, artifact }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed.");
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed.");
      setBusy(false);
    }
  }

  return (
    <section style={card}>
      <div style={meta}>
        constellation {item.constellationId.slice(0, 8)} · {item.readings} readings
        {item.hasEssence ? " · has essence (re-paste to replace)" : ""}
      </div>
      <textarea
        value={artifact}
        onChange={(e) => setArtifact(e.target.value)}
        style={{ ...ta, height: 160, marginTop: 8 }}
        placeholder="paste essence artifact HTML"
      />
      <button onClick={save} disabled={!artifact.trim() || busy} style={btn}>
        {busy ? "Saving…" : "Save essence"}
      </button>
      {err && <p style={{ color: "crimson" }}>{err}</p>}
    </section>
  );
}

const page: CSSProperties = {
  maxWidth: 820,
  margin: "0 auto",
  padding: "2rem 1rem",
  fontFamily: "system-ui, sans-serif",
};
const card: CSSProperties = { border: "1px solid #ddd", borderRadius: 8, padding: 16, marginTop: 16 };
const meta: CSSProperties = { fontSize: 12, color: "#888" };
const hint: CSSProperties = { fontSize: 12, color: "#888", margin: "8px 0 4px" };
const ta: CSSProperties = { width: "100%", fontFamily: "monospace", fontSize: 12, padding: 8, boxSizing: "border-box" };
const btn: CSSProperties = { marginTop: 8, padding: "8px 14px", cursor: "pointer" };

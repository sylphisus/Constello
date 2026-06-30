"use client";

import { useEffect, useState } from "react";
import type { Peer } from "@/lib/share";

type Data = {
  loggedIn: boolean;
  incoming: Peer[];
  shared: Peer[];
  pendingCount: number;
};

const row: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  padding: "11px 0",
  borderBottom: "1px solid var(--hair)",
  fontSize: 14,
};

// Connections lives in a slide-in sidebar off the site nav (rather than its own
// page) so you can act on requests without leaving the sky / your constellation.
// Data loads on open from /api/connections; the session is your identity.
export default function ConnectionsDrawer() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/connections");
      setData(await res.json());
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    load();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button onClick={() => setOpen(true)}>Connections</button>

      <div
        className={`drawer-backdrop${open ? " open" : ""}`}
        onClick={() => setOpen(false)}
      />
      <aside className={`drawer${open ? " open" : ""}`} aria-hidden={!open}>
        <div className="mark">
          <h1>Connections</h1>
          <p>who can see you · who you can see</p>
        </div>

        {loading && !data ? (
          <p style={{ color: "var(--ink-faint)", fontSize: 14, marginTop: 28 }}>…</p>
        ) : !data?.loggedIn ? (
          <p className="framing" style={{ marginTop: 28 }}>
            Open your constellation — your link, or by re-entering one of your
            collections — to log in, then come back here.
          </p>
        ) : (
          <Panel data={data} onChange={load} />
        )}
      </aside>
    </>
  );
}

function Panel({ data, onChange }: { data: Data; onChange: () => void }) {
  return (
    <>
      <section style={{ marginTop: 34 }}>
        <p className="eyebrow">requests to see you</p>
        {data.incoming.length === 0 ? (
          <p style={{ color: "var(--ink-faint)", fontSize: 14, marginTop: 10 }}>
            no one&apos;s asked yet.
          </p>
        ) : (
          data.incoming.map((p) => <IncomingRow key={p.id} peer={p} onGranted={onChange} />)
        )}
      </section>

      <section style={{ marginTop: 34 }}>
        <p className="eyebrow">shared with you</p>
        {data.shared.length === 0 ? (
          <p style={{ color: "var(--ink-faint)", fontSize: 14, marginTop: 10 }}>
            nothing yet.
          </p>
        ) : (
          data.shared.map((p) => (
            <div key={p.id} style={row}>
              <a className="text-link" href={`/c/${p.signature ?? p.id}`}>
                open constellation →
              </a>
            </div>
          ))
        )}
      </section>

      {data.pendingCount > 0 && (
        <p style={{ marginTop: 28, fontSize: 13, color: "var(--ink-faint)" }}>
          {data.pendingCount} of your requests {data.pendingCount === 1 ? "is" : "are"} still
          waiting to be granted.
        </p>
      )}
    </>
  );
}

// A pending request to see you. They've already shared theirs (reciprocity), so
// you can see them now; Grant opens yours to them in return.
function IncomingRow({ peer, onGranted }: { peer: Peer; onGranted: () => void }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");

  async function grant() {
    if (state === "busy" || state === "done") return;
    setState("busy");
    try {
      const res = await fetch("/api/grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requesterId: peer.id }),
      });
      if (!res.ok) throw new Error();
      setState("done");
      onGranted();
    } catch {
      setState("error");
    }
  }

  return (
    <div style={row}>
      <a className="text-link" href={`/c/${peer.signature ?? peer.id}`}>
        see theirs →
      </a>
      <button
        className="ghost-btn"
        style={{ width: "auto", marginLeft: "auto", padding: "7px 16px" }}
        onClick={grant}
        disabled={state === "busy" || state === "done"}
      >
        {state === "done" ? "granted ✓" : state === "busy" ? "…" : "grant"}
      </button>
      {state === "error" && <span className="error">failed</span>}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Peer } from "@/lib/share";

const row: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  padding: "11px 0",
  borderBottom: "1px solid var(--hair)",
  fontSize: 14,
};

export default function Connections({
  incoming,
  shared,
  pendingCount,
}: {
  incoming: Peer[];
  shared: Peer[];
  pendingCount: number;
}) {
  return (
    <main className="wrap">
      <div className="mark">
        <h1>Connections</h1>
        <p>who can see you · who you can see</p>
      </div>

      <section style={{ marginTop: 34 }}>
        <p className="eyebrow">requests to see you</p>
        {incoming.length === 0 ? (
          <p style={{ color: "var(--ink-faint)", fontSize: 14, marginTop: 10 }}>
            no one&apos;s asked yet.
          </p>
        ) : (
          incoming.map((p) => <IncomingRow key={p.id} peer={p} />)
        )}
      </section>

      <section style={{ marginTop: 34 }}>
        <p className="eyebrow">shared with you</p>
        {shared.length === 0 ? (
          <p style={{ color: "var(--ink-faint)", fontSize: 14, marginTop: 10 }}>
            nothing yet.
          </p>
        ) : (
          shared.map((p) => (
            <div key={p.id} style={row}>
              <a className="text-link" href={`/c/${p.signature ?? p.id}`}>
                open constellation →
              </a>
            </div>
          ))
        )}
      </section>

      {pendingCount > 0 && (
        <p style={{ marginTop: 28, fontSize: 13, color: "var(--ink-faint)" }}>
          {pendingCount} of your requests {pendingCount === 1 ? "is" : "are"} still
          waiting to be granted.
        </p>
      )}
    </main>
  );
}

// A pending request to see you. They've already shared theirs (reciprocity), so
// you can see them now; Grant opens yours to them in return.
function IncomingRow({ peer }: { peer: Peer }) {
  const router = useRouter();
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
      router.refresh();
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

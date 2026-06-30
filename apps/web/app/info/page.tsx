import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Info — Constello",
  description: "The repo and the docs, kept off the main app.",
};

// Repo + Docs live here, deliberately unlinked from the main app so the
// experience stays clean. Reachable only by knowing /info.
export default function Info() {
  return (
    <main className="wrap">
      <div className="mark">
        <h1>Constello</h1>
        <p>repo · docs</p>
      </div>

      <section style={{ marginTop: 34, display: "flex", flexDirection: "column", gap: 14 }}>
        <a
          className="text-link"
          href="https://github.com/sylphisus/Constello"
          target="_blank"
          rel="noopener noreferrer"
        >
          Repo →
        </a>
        <a className="text-link" href="https://docs.constello.xyz">
          Docs →
        </a>
      </section>
    </main>
  );
}

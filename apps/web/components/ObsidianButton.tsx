"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Obsidian connect: pick the vault folder, read its .md notes in the browser,
// and POST them to /api/collections/obsidian. A vault has no API and never
// leaves the person's machine except as the notes they chose to import.
//
// `webkitdirectory` lets one <input> select a whole folder; it isn't a typed
// React attribute, so we set it on the element directly.
export default function ObsidianButton({
  constellationId,
}: {
  constellationId?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const el = inputRef.current;
    if (el) {
      el.setAttribute("webkitdirectory", "");
      el.setAttribute("directory", "");
    }
  }, []);

  async function onPick(fileList: FileList | null) {
    if (!fileList || busy) return;
    setBusy(true);
    setError("");
    try {
      const md = Array.from(fileList).filter((f) => /\.(md|markdown)$/i.test(f.name));
      if (!md.length) throw new Error("That folder has no markdown notes.");

      // webkitRelativePath is "VaultName/sub/note.md"; the first segment is the
      // vault, the rest is the note's path within it.
      const vaultName = md[0].webkitRelativePath.split("/")[0] || "vault";
      const files = await Promise.all(
        md.map(async (f) => ({
          path: f.webkitRelativePath.split("/").slice(1).join("/") || f.name,
          content: await f.text(),
        })),
      );

      const res = await fetch("/api/collections/obsidian", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ constellationId, vaultName, files }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not import the vault.");
      router.push(`/c/${data.constellationId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not import the vault.");
      setBusy(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".md,.markdown,text/markdown"
        style={{ display: "none" }}
        onChange={(e) => onPick(e.target.files)}
      />
      <button
        className="primary-btn"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? "Reading vault…" : "Choose vault folder"}
      </button>
      {error && <p className="error">{error}</p>}
    </>
  );
}

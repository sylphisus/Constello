// Obsidian vault collection adapter.
//
// A vault has no API — it's a folder of markdown notes on the person's machine.
// So unlike the fetched sources there's no `fetch` half: the client reads the
// `.md` files in the browser (folder picker) and posts their {path, content}.
// This module is the pure formatter — vault files → the one entry read by hand.
//
// What's load-bearing here is the LINK GRAPH. A vault's `[[wikilinks]]` are the
// trace of a world someone is building — which notes they connected, and which
// they left as islands. We keep the note bodies AND surface the adjacency
// explicitly so the hand-read sees the shape, not just the contents.

export interface ObsidianFile {
  /** Path relative to the vault root, e.g. "ideas/exile.md". */
  path: string;
  content: string;
}

export interface ObsidianVault {
  vaultName: string;
  files: ObsidianFile[];
}

// Caps so one upload stays a bounded entry. The hand-read wants the whole world,
// but a runaway vault shouldn't produce a megabyte entry — truncate generously
// and mark where we cut.
const MAX_NOTES = 300;
const MAX_CHARS_PER_NOTE = 6000;

// A note's title is its filename without the .md extension (Obsidian's own
// convention — `[[Some Note]]` resolves to `Some Note.md`).
function noteTitle(path: string): string {
  const base = path.split("/").pop() ?? path;
  return base.replace(/\.m(d|arkdown)$/i, "");
}

// Pull every `[[wikilink]]` target out of a note body. Handles `[[Note]]`,
// `[[Note|alias]]`, and `[[Note#heading]]` — we only keep the note name.
function outgoingLinks(content: string): string[] {
  const links = new Set<string>();
  for (const m of content.matchAll(/\[\[([^\]]+)\]\]/g)) {
    const target = m[1].split("|")[0].split("#")[0].trim();
    if (target) links.add(target);
  }
  return [...links];
}

/** Pure: vault files → the entry text the reading is drawn from. */
export function formatObsidian(vault: ObsidianVault): { label: string; rawText: string } {
  const files = vault.files.slice(0, MAX_NOTES);
  const lines: string[] = [];

  lines.push(`Obsidian vault "${vault.vaultName}".`);
  lines.push(`${vault.files.length} notes${files.length < vault.files.length ? ` (first ${files.length} included)` : ""}.`);

  // ── Link graph ─────────────────────────────────────────────────────────────
  // Only links whose target is another note in this vault count toward the
  // world's structure; links to non-existent notes are still intentions, so we
  // keep them but mark them as unresolved.
  const titles = new Set(files.map((f) => noteTitle(f.path)));
  const graph: string[] = [];
  for (const f of files) {
    const links = outgoingLinks(f.content);
    if (!links.length) continue;
    const rendered = links.map((l) => (titles.has(l) ? l : `${l} (unresolved)`));
    graph.push(`- ${noteTitle(f.path)} → ${rendered.join(", ")}`);
  }
  if (graph.length) {
    lines.push("", "Links between notes (the structure of the vault):", ...graph);
  }

  // ── Note bodies ──────────────────────────────────────────────────────────────
  lines.push("", "Notes:");
  for (const f of files) {
    const body = f.content.trim();
    const clipped =
      body.length > MAX_CHARS_PER_NOTE
        ? `${body.slice(0, MAX_CHARS_PER_NOTE)}\n…(truncated)`
        : body;
    lines.push("", `## ${f.path}`, clipped || "(empty)");
  }

  return { label: `Obsidian · ${vault.vaultName}`, rawText: lines.join("\n") };
}

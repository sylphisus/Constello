// Apple Notes collection adapter.
//
// Apple ships no API for Notes — they live on-device with no public share that's
// readable server-side. So the way in is by hand: the person recreates the notes
// that say something about their world inside a Notes-style editor (see
// components/AppleNotes.tsx), and the client posts {title, body} for each. This
// module is the pure formatter — those notes → the one entry read by hand.
//
// Like Obsidian, the whole set is one collection (one star): what someone chooses
// to bring over is itself the signal. Unlike Obsidian there's no link graph —
// Apple Notes are flat — so we keep just the titles and bodies, in order.

export interface AppleNote {
  /** First line of the note (Apple Notes' own title convention). */
  title: string;
  /** Everything after the first line. */
  body: string;
}

// Caps so one set stays a bounded entry, generously sized for a real Notes app.
const MAX_NOTES = 200;
const MAX_CHARS_PER_NOTE = 8000;

function plural(n: number): string {
  return `${n} note${n === 1 ? "" : "s"}`;
}

/** Pure: recreated notes → the entry text the reading is drawn from. */
export function formatAppleNotes(notes: AppleNote[]): { label: string; rawText: string } {
  const kept = notes.slice(0, MAX_NOTES);
  const lines: string[] = [];

  lines.push(
    `Apple Notes — ${plural(notes.length)}${
      kept.length < notes.length ? ` (first ${kept.length} included)` : ""
    }, recreated by hand.`,
  );

  for (const n of kept) {
    const title = n.title.trim() || "Untitled";
    const body = n.body.trim();
    const clipped =
      body.length > MAX_CHARS_PER_NOTE
        ? `${body.slice(0, MAX_CHARS_PER_NOTE)}\n…(truncated)`
        : body;
    lines.push("", `## ${title}`, clipped || "(no further text)");
  }

  return { label: `Apple Notes · ${plural(notes.length)}`, rawText: lines.join("\n") };
}

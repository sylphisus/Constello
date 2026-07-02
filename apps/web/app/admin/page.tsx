"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { X_HANDLE } from "@/lib/brand";
import { READING_PROMPT } from "@/lib/prompts";

// Fulfillment console (gated by Basic auth in middleware). Three views:
//  - a stats bar + roster of every constellation (the whole population),
//  - the pending queue (entries with no reading yet), grouped by constellation,
//  - the essence queue (constellations with 2+ readings).

interface PendingEntry {
  id: string;
  constellation_id: string;
  source: string;
  label: string;
  raw_text: string;
  created_at: string;
  needs_reread?: boolean;
  images?: { url: string }[];
}
interface RosterItem {
  id: string;
  createdAt: string;
  signature: string | null;
  entries: number;
  readings: number;
  sources: string[];
  hasEssence: boolean;
}
interface EssenceItem {
  constellationId: string;
  readings: number;
  hasEssence: boolean;
}
interface PendingFollow {
  contactId: string;
  constellationId: string;
  handle: string;
  createdAt: string;
}
interface Stats {
  constellations: number;
  entries: number;
  readings: number;
  pending: number;
  essences: number;
}
interface Match {
  constellation_id: string;
  similarity: number;
  signature: string | null;
  essence: string | null;
}
interface Conversation {
  id: string;
  username: string;
  userId: string;
  constellationId: string | null;
  content: string;
  createdAt: string;
  asker: { essence: string | null; readings: string[] } | null;
  matches: Match[];
  contextText: string;
}

// Shared with the automated reading path so the manual and automated prompts
// can't drift (see lib/prompts).
const PROMPT = READING_PROMPT;

// Where the off-platform X bridge lives (the scrape stays local; prod never
// holds a cookie). Used to print a ready-to-paste fulfillment command.
const BRIDGE_DIR = "~/Documents/twitter-preservation";
// A queued-but-unfilled X entry carries this placeholder body (see
// /api/collections/twitter); the posts arrive later via the bridge.
const X_PLACEHOLDER_PREFIX = "Pending X / Twitter capture";

// Where the local Pinterest capture tool lives (in this repo). It can't run in
// prod (headed browser), so the console prints a ready-to-paste local command.
const CAPTURE_DIR = '~/"Documents/constello build/apps/pinterest-capture"';
// A queued Pinterest board carries this placeholder body (see
// /api/collections/pinterest); the board URL is appended after "Board: ".
const PIN_PLACEHOLDER_PREFIX = "Pending Pinterest capture";

// The local command that scroll-screenshots a board. "Screenshots only": it
// writes PNGs you drag into claude.ai by hand — nothing is pushed back, so no
// constellation id or password is needed (unlike the X bridge).
function captureCommand(boardUrl: string): string {
  return `cd ${CAPTURE_DIR}\nnpm start -- "${boardUrl}"`;
}

// Recover the board URL from a queued Pinterest entry's placeholder body.
function pinBoardUrl(rawText: string): string | null {
  return rawText.match(/https?:\/\/\S+/)?.[0] ?? null;
}

// A queued Spotify link carries this placeholder body (see
// /api/collections/spotify); the canonical link is appended after "Link: ". It's
// read from the inline embed on the constellation page (or screenshots), so the
// material is the embed — the prompt goes to claude.ai alone, like a board.
const SPOTIFY_PLACEHOLDER_PREFIX = "Pending Spotify capture";
function spotifyLink(rawText: string): string | null {
  return rawText.match(/https?:\/\/\S+/)?.[0] ?? null;
}

// "X · @handle" → "handle" (the deterministic label formatTwitter writes).
function xHandle(label: string): string | null {
  const m = label.match(/@(\S+)/);
  return m ? m[1] : null;
}

// The exact local command that scrapes the handle and fills THIS entry
// (--constellation-id makes the bridge reconcile into it, not fork a new world).
function bridgeCommand(handle: string, constellationId: string, password: string): string {
  // Inline the real password (the console is authed) so the command runs as-is.
  // Fall back to a clearly-not-a-value placeholder if the server didn't supply it.
  const pw = password || "YOUR_ADMIN_PASSWORD";
  return `cd ${BRIDGE_DIR}\nCONSTELLO_ADMIN_PASSWORD=${pw} uv run constello-x ${handle} --constellation-id ${constellationId}`;
}

// "3d" / "5h" / "just now" — how long ago an ISO timestamp was.
function ago(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function Admin() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [roster, setRoster] = useState<RosterItem[]>([]);
  const [pending, setPending] = useState<PendingEntry[]>([]);
  const [essenceQueue, setEssenceQueue] = useState<EssenceItem[]>([]);
  const [pendingFollows, setPendingFollows] = useState<PendingFollow[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [adminPassword, setAdminPassword] = useState("");
  const [loading, setLoading] = useState(true);
  // True only until the first load settles. Refreshes after that keep the page
  // mounted (so e.g. the queue-confirmation block isn't unmounted mid-refresh).
  const [firstLoad, setFirstLoad] = useState(true);
  const [err, setErr] = useState("");

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const [res, convRes] = await Promise.all([
        fetch("/api/admin/pending"),
        fetch("/api/admin/discord"),
      ]);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load.");
      setStats(data.stats ?? null);
      setRoster(data.constellations ?? []);
      setPending(data.pending ?? []);
      setEssenceQueue(data.essenceQueue ?? []);
      setPendingFollows(data.pendingFollows ?? []);
      setAdminPassword(data.adminPassword ?? "");
      // Conversations are best-effort: a failure here shouldn't blank the console.
      const convData = await convRes.json().catch(() => ({}));
      setConversations(convRes.ok ? (convData.questions ?? []) : []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
      setFirstLoad(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  // Pending entries clustered under their constellation, oldest world first
  // (the one that's been waiting longest leads).
  const pendingGroups = useMemo(() => {
    const m = new Map<string, PendingEntry[]>();
    for (const e of pending) {
      const arr = m.get(e.constellation_id) ?? [];
      arr.push(e);
      m.set(e.constellation_id, arr);
    }
    return [...m.entries()]
      .map(([constellationId, entries]) => ({ constellationId, entries }))
      .sort((a, b) =>
        a.entries[0].created_at.localeCompare(b.entries[0].created_at),
      );
  }, [pending]);

  return (
    <main style={page}>
      <header style={head}>
        <h1 style={mark}>Constello · admin</h1>
        <button onClick={load} disabled={loading} style={ghostBtn}>
          {loading ? "…" : "Refresh"}
        </button>
      </header>
      {err && <p style={{ color: "var(--red)" }}>{err}</p>}

      {stats && <StatBar stats={stats} />}

      <DaemonStatus />

      {loading && firstLoad ? (
        <p style={{ color: "var(--ink-soft)" }}>Loading…</p>
      ) : (
        <>
          <Section title="Conversations" count={conversations.length}>
            {conversations.length === 0 && (
              <Empty>No one is asking the bot anything right now.</Empty>
            )}
            {conversations.map((c) => (
              <ConversationCard key={c.id} item={c} onSent={load} />
            ))}
          </Section>

          <Section title="Constellations" count={roster.length}>
            {roster.length === 0 && <Empty>No constellations yet.</Empty>}
            {roster.map((c) => (
              <RosterRow key={c.id} item={c} onDeleted={load} />
            ))}
          </Section>

          <Section title="Reset a constellation password">
            <ResetPassword />
          </Section>

          <Section title="Queue an X handle">
            <XQueue onQueued={load} password={adminPassword} />
          </Section>

          <Section title="Capture a Pinterest board">
            <PinterestQueue onQueued={load} />
          </Section>

          <Section title="Pending readings" count={pending.length}>
            {pendingGroups.length === 0 && <Empty>Nothing pending.</Empty>}
            {pendingGroups.map((g) => (
              <div key={g.constellationId} style={group}>
                <div style={groupHead}>
                  <Cid id={g.constellationId} />
                  <span style={dim}>
                    {g.entries.length} pending · oldest {ago(g.entries[0].created_at)}
                  </span>
                </div>
                {g.entries.map((e) => (
                  <PendingCard key={e.id} entry={e} onSaved={load} password={adminPassword} />
                ))}
              </div>
            ))}
          </Section>

          <Section title="X handles to notify" count={pendingFollows.length}>
            {pendingFollows.length === 0 && (
              <Empty>No X handles to post.</Empty>
            )}
            {pendingFollows.map((f) => (
              <FollowCard key={f.contactId} item={f} onSaved={load} />
            ))}
          </Section>

          <Section title="Essence queue" count={essenceQueue.length}>
            {essenceQueue.length === 0 && (
              <Empty>No constellation has 2+ readings yet.</Empty>
            )}
            {essenceQueue.map((c) => (
              <EssenceCard key={c.constellationId} item={c} onSaved={load} />
            ))}
          </Section>
        </>
      )}
    </main>
  );
}

function StatBar({ stats }: { stats: Stats }) {
  const cells: [string, number][] = [
    ["constellations", stats.constellations],
    ["entries", stats.entries],
    ["readings", stats.readings],
    ["pending", stats.pending],
    ["essences", stats.essences],
  ];
  return (
    <div style={statBar}>
      {cells.map(([label, n]) => (
        <div key={label} style={statCell}>
          <div style={statNum}>{n}</div>
          <div style={statLabel}>{label}</div>
        </div>
      ))}
    </div>
  );
}

function RosterRow({ item, onDeleted }: { item: RosterItem; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (busy) return;
    if (
      !confirm(
        `Delete constellation ${item.id.slice(0, 8)} and everything under it ` +
          `(${item.entries} entries, ${item.readings} readings` +
          `${item.hasEssence ? ", essence" : ""})? This can't be undone.`,
      )
    )
      return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/constellation", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ constellationId: item.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed.");
      onDeleted();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed.");
      setBusy(false);
    }
  }

  return (
    <div style={rosterRow}>
      <a
        href={`/c/${item.id}`}
        target="_blank"
        rel="noreferrer"
        style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, textDecoration: "none", color: "inherit" }}
      >
        <span style={star(item.readings > 0)}>✦</span>
        <Cid id={item.id} />
        <span style={badges}>
          {item.sources.map((s) => (
            <span key={s} style={sourceBadge}>
              {s}
            </span>
          ))}
        </span>
        <span style={dim}>
          {item.readings}/{item.entries} read
          {item.hasEssence && <span style={essenceDot}> · essence</span>}
          {item.signature == null && <span> · unread</span>}
        </span>
        <span style={{ ...dim, marginLeft: "auto" }}>{ago(item.createdAt)}</span>
      </a>
      <button onClick={remove} disabled={busy} style={{ ...ghostBtn, padding: "4px 10px" }}>
        {busy ? "…" : "Delete"}
      </button>
    </div>
  );
}

function PendingCard({
  entry,
  onSaved,
  password,
}: {
  entry: PendingEntry;
  onSaved: () => void;
  password: string;
}) {
  const [artifact, setArtifact] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // What this entry is, by source. A queued X handle is filled off-platform by the
  // bridge; a queued Pinterest board is read from screenshots (the images ARE the
  // material, so the prompt goes to claude.ai alone). Every other source reads from
  // its raw_text as usual.
  const handle = entry.source === "twitter" ? xHandle(entry.label) : null;
  const awaitingCapture =
    entry.source === "twitter" && entry.raw_text.startsWith(X_PLACEHOLDER_PREFIX);
  const isPinCapture =
    entry.source === "pinterest" && entry.raw_text.startsWith(PIN_PLACEHOLDER_PREFIX);
  const boardUrl = isPinCapture ? pinBoardUrl(entry.raw_text) : null;
  // A queued Spotify link is read from its inline embed (or screenshots), like a
  // board — the material is the embed, so the prompt goes to claude.ai alone.
  const isSpotifyCapture =
    entry.source === "spotify" && entry.raw_text.startsWith(SPOTIFY_PLACEHOLDER_PREFIX);
  const spotifyUrl = isSpotifyCapture ? spotifyLink(entry.raw_text) : null;
  // An image collection's material is the images themselves (like a Pinterest
  // capture) — the prompt goes to claude.ai alongside the dragged-in images.
  const isImages = entry.source === "images";
  const dragMaterial = isPinCapture || isImages || isSpotifyCapture;
  const copyText = dragMaterial ? PROMPT : `${PROMPT}\n\n${entry.raw_text}`;

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

  async function remove() {
    if (busy) return;
    if (!confirm(`Delete this pending ${entry.source} entry? This can't be undone.`)) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/entry", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId: entry.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed.");
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Delete failed.");
      setBusy(false);
    }
  }

  return (
    <section style={card}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <div style={meta}>
          {entry.source} · {entry.label || "(no label)"} · {ago(entry.created_at)} ago
        </div>
        <button onClick={remove} disabled={busy} style={{ ...ghostBtn, marginLeft: "auto" }}>
          Delete
        </button>
      </div>

      {handle && (
        <div style={{ marginTop: 10 }}>
          <p style={hint}>
            {awaitingCapture
              ? "Fill from X — run locally, then Refresh:"
              : "Re-pull from X (run locally, then Refresh):"}
          </p>
          <BridgeBlock
            command={bridgeCommand(handle, entry.constellation_id, password)}
            run={{
              kind: "x-bridge",
              params: { handle, constellationId: entry.constellation_id, adminPassword: password },
            }}
          />
        </div>
      )}

      {isPinCapture && boardUrl && (
        <div style={{ marginTop: 10 }}>
          <p style={hint}>Capture the board locally (screenshots open when it finishes):</p>
          <BridgeBlock command={captureCommand(boardUrl)} run={{ kind: "pinterest", params: { boardUrl } }} />
        </div>
      )}

      {isSpotifyCapture && spotifyUrl && (
        <div style={{ marginTop: 10 }}>
          <p style={hint}>Read it from the inline embed on the constellation page, or open it:</p>
          <a
            href={spotifyUrl}
            target="_blank"
            rel="noreferrer"
            style={{ color: "var(--essence)", wordBreak: "break-all" }}
          >
            {spotifyUrl}
          </a>
        </div>
      )}

      {isImages && (
        <div style={{ marginTop: 10 }}>
          {entry.needs_reread && (
            <p style={{ ...hint, color: "var(--essence)" }}>
              Re-read requested — the images changed.
            </p>
          )}
          {entry.images && entry.images.length > 0 ? (
            <div style={imageGrid}>
              {entry.images.map((im, i) => (
                <a key={i} href={im.url} target="_blank" rel="noreferrer" style={imageCell}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={im.url} alt="" style={imageImg} />
                </a>
              ))}
            </div>
          ) : (
            <p style={hint}>No images on this collection.</p>
          )}
        </div>
      )}

      {awaitingCapture ? (
        <p style={hint}>No posts captured yet. Run the command above, then Refresh.</p>
      ) : (
        <>
          <p style={hint}>
            {isImages
              ? "Drag the images above into claude.ai with this prompt:"
              : isPinCapture
                ? "Drag the screenshots into claude.ai with this prompt:"
                : isSpotifyCapture
                  ? "Read the embed (or drag screenshots) into claude.ai with this prompt:"
                  : "Copy into claude.ai:"}
          </p>
          <textarea
            readOnly
            value={copyText}
            style={{ ...ta, height: 120 }}
            onFocus={(e) => e.currentTarget.select()}
          />
          <p style={hint}>Paste the artifact markdown back:</p>
          <textarea
            value={artifact}
            onChange={(e) => setArtifact(e.target.value)}
            style={{ ...ta, height: 160 }}
            placeholder="# …"
          />
          <button onClick={save} disabled={!artifact.trim() || busy} style={btn}>
            {busy ? "Saving…" : "Save reading"}
          </button>
          {err && <p style={{ color: "var(--red)" }}>{err}</p>}
        </>
      )}
    </section>
  );
}

// A ready-to-paste local command + a copy button. The scrape stays off-platform,
// so fulfillment is "copy → run in your terminal → Refresh", never a prod scrape.
function BridgeBlock({
  command,
  run,
}: {
  command: string;
  run?: { kind: "pinterest" | "x-bridge"; params: Record<string, string> };
}) {
  return (
    <div>
      <pre style={cmd}>{command}</pre>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        {run && <RunButton kind={run.kind} params={run.params} />}
        <CopyButton text={command} label="Copy command" />
      </div>
    </div>
  );
}

// One-click run via the local capture-daemon (apps/capture-daemon, :4599). It runs
// the same command the block shows; we fall back to Copy when the daemon isn't up
// or the browser blocks the loopback call (Safari/Firefox — Chrome/Edge allow it).
const DAEMON = "http://127.0.0.1:4599";
function RunButton({ kind, params }: { kind: "pinterest" | "x-bridge"; params: Record<string, string> }) {
  const [state, setState] = useState<"idle" | "running" | "ok" | "err">("idle");
  const [msg, setMsg] = useState("");
  async function go() {
    setState("running");
    setMsg("");
    try {
      const res = await fetch(`${DAEMON}/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Daemon error.");
      setState("ok");
      setMsg("Started — watch the capture-daemon's terminal.");
      setTimeout(() => setState("idle"), 4000);
    } catch {
      setState("err");
      setMsg("No capture-daemon on :4599 — run `npm start` in apps/capture-daemon (Chrome/Edge), or copy the command.");
    }
  }
  return (
    <>
      <button onClick={go} disabled={state === "running"} style={runBtn}>
        {state === "running" ? "Starting…" : state === "ok" ? "Started ✓" : "▶ Run on this machine"}
      </button>
      {msg && (
        <p style={{ ...hint, width: "100%", color: state === "err" ? "var(--red)" : "var(--ink-faint)" }}>
          {msg}
        </p>
      )}
    </>
  );
}

// Top-of-console banner: is the local capture-daemon reachable? The "Run on this
// machine" buttons need it running. Checks /health on mount; if it's down, shows
// the one command that starts it (Chrome/Edge only — the buttons post to
// http://localhost from an https page).
const DAEMON_START = 'cd ~/"Documents/constello build/apps/capture-daemon" && npm start';
function DaemonStatus() {
  const [up, setUp] = useState<boolean | null>(null);
  async function check() {
    setUp(null);
    try {
      const res = await fetch(`${DAEMON}/health`, { signal: AbortSignal.timeout(1500) });
      setUp(res.ok);
    } catch {
      setUp(false);
    }
  }
  useEffect(() => {
    check();
  }, []);
  return (
    <div style={daemonBar}>
      {up === null ? (
        <span style={dim}>Checking capture-daemon…</span>
      ) : up ? (
        <span style={{ color: "var(--gold)" }}>⚡ capture-daemon connected — “Run on this machine” is live.</span>
      ) : (
        <>
          <span style={dim}>
            capture-daemon not running — start it for one-click captures (Chrome/Edge):
          </span>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 7 }}>
            <pre style={{ ...cmd, margin: 0 }}>{DAEMON_START}</pre>
            <CopyButton text={DAEMON_START} label="Copy" />
            <button onClick={check} style={ghostBtn}>Re-check</button>
          </div>
        </>
      )}
    </div>
  );
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        } catch {
          /* clipboard unavailable (e.g. non-https) — the text is still selectable */
        }
      }}
      style={ghostBtn}
    >
      {done ? "Copied ✓" : label}
    </button>
  );
}

// Seed a new X reading from admin: queues the pending placeholder (same route the
// public X tab uses) and immediately shows the bridge command to fill it.
function XQueue({ onQueued, password }: { onQueued: () => void; password: string }) {
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [queued, setQueued] = useState<{ handle: string; constellationId: string } | null>(null);

  async function queue() {
    const h = handle.trim().replace(/^@/, "");
    if (!h || busy) return;
    setBusy(true);
    setErr("");
    setQueued(null);
    try {
      const res = await fetch("/api/collections/twitter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: h }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to queue.");
      setQueued({ handle: h, constellationId: data.constellationId });
      setHandle("");
      onQueued();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to queue.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={card}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ color: "var(--ink-faint)" }}>@</span>
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && queue()}
          placeholder="x handle"
          style={input}
        />
        <button onClick={queue} disabled={!handle.trim() || busy} style={btn}>
          {busy ? "Queuing…" : "Queue handle"}
        </button>
      </div>
      {err && <p style={{ color: "var(--red)" }}>{err}</p>}
      {queued && (
        <div style={{ marginTop: 14 }}>
          <p style={hint}>
            Queued <strong>@{queued.handle}</strong> → <Cid id={queued.constellationId} />. Run
            locally to fill it, then Refresh:
          </p>
          <BridgeBlock
            command={bridgeCommand(queued.handle, queued.constellationId, password)}
            run={{
              kind: "x-bridge",
              params: { handle: queued.handle, constellationId: queued.constellationId, adminPassword: password },
            }}
          />
        </div>
      )}
    </section>
  );
}

// Seed a new Pinterest reading from admin: queues a pending entry for the board
// (same route a public Pinterest tab would use) and immediately shows the local
// capture command. Screenshots-only — no bridge push-back, so no password here.
function PinterestQueue({ onQueued }: { onQueued: () => void }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [queued, setQueued] = useState<{ url: string; constellationId: string } | null>(null);

  async function queue() {
    const u = url.trim();
    if (!u || busy) return;
    setBusy(true);
    setErr("");
    setQueued(null);
    try {
      const res = await fetch("/api/collections/pinterest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: u }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to queue.");
      setQueued({ url: u, constellationId: data.constellationId });
      setUrl("");
      onQueued();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to queue.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={card}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && queue()}
          placeholder="pinterest.com/user/board/"
          style={input}
        />
        <button onClick={queue} disabled={!url.trim() || busy} style={btn}>
          {busy ? "Queuing…" : "Queue board"}
        </button>
      </div>
      {err && <p style={{ color: "var(--red)" }}>{err}</p>}
      {queued && (
        <div style={{ marginTop: 14 }}>
          <p style={hint}>
            Queued → <Cid id={queued.constellationId} />. Capture locally, then drag the
            screenshots into claude.ai with &ldquo;{PROMPT}&rdquo; and Refresh:
          </p>
          <BridgeBlock command={captureCommand(queued.url)} run={{ kind: "pinterest", params: { boardUrl: queued.url } }} />
        </div>
      )}
    </section>
  );
}

// Recover a locked-out constellation (the auth model has no self-serve reset).
// Set a new password and hand it over (recommended), or clear it so the next
// visitor re-claims. Posts to /api/admin/reset-password (Basic-auth gated).
function ResetPassword() {
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [mode, setMode] = useState("");

  async function submit(clear: boolean) {
    const constellationId = id.trim();
    if (!constellationId || state === "busy") return;
    if (!clear && !password.trim()) return;
    setState("busy");
    setMode("");
    try {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ constellationId, password: clear ? "" : password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed.");
      setMode(data.mode);
      setPassword("");
      setState("done");
    } catch {
      setState("error");
    }
  }

  return (
    <section style={card}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input
          value={id}
          onChange={(e) => setId(e.target.value)}
          placeholder="constellation id (uuid)"
          style={input}
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="new password"
          style={{ ...input, flex: "0 0 180px" }}
        />
        <button onClick={() => submit(false)} disabled={state === "busy"} style={btn}>
          Set
        </button>
        <button onClick={() => submit(true)} disabled={state === "busy"} style={ghostBtn}>
          Clear
        </button>
      </div>
      <p style={hint}>
        Set a new password and hand it to the person (recommended), or clear it so the
        next visitor re-claims.
      </p>
      {state === "done" && (
        <p style={{ ...hint, color: "var(--essence)" }}>Done — password {mode}.</p>
      )}
      {state === "error" && <p style={{ color: "var(--red)" }}>Failed.</p>}
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
        <Cid id={item.constellationId} /> · {item.readings} readings
        {item.hasEssence ? " · has essence (re-paste to replace)" : ""}
      </div>
      <textarea
        value={artifact}
        onChange={(e) => setArtifact(e.target.value)}
        style={{ ...ta, height: 160, marginTop: 8 }}
        placeholder="paste essence artifact markdown"
      />
      <button onClick={save} disabled={!artifact.trim() || busy} style={btn}>
        {busy ? "Saving…" : "Save essence"}
      </button>
      {err && <p style={{ color: "var(--red)" }}>{err}</p>}
    </section>
  );
}

// Manual X notification. No API, no token: surface the handle with a link to
// check the follow + a uniform, paste-ready knock to post from @03constello by
// hand. "Mark posted" flips verified=true so it drops off the list.
function FollowCard({ item, onSaved }: { item: PendingFollow; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const handle = item.handle.replace(/^@/, "");
  // The uniform knock — public, linkless (a post is visible to everyone).
  const postLine = `@${handle} your constellation has been read.`;

  async function markPosted() {
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/verify-contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId: item.contactId, verified: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed.");
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed.");
      setBusy(false);
    }
  }

  return (
    <section style={card}>
      <div style={meta}>
        <Cid id={item.constellationId} /> · @{handle} · {ago(item.createdAt)} ago
      </div>
      <p style={hint}>
        Check @{handle} follows @{X_HANDLE}, post the line below from @{X_HANDLE},
        then mark it posted. (Public mention — the knock only, never the link.)
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "8px 0 4px" }}>
        <a
          href={`https://x.com/${handle}`}
          target="_blank"
          rel="noreferrer"
          style={{ ...ghostBtn, display: "inline-block", textDecoration: "none" }}
        >
          Open @{handle} ↗
        </a>
        <a
          href={`https://x.com/${X_HANDLE}`}
          target="_blank"
          rel="noreferrer"
          style={{ ...ghostBtn, display: "inline-block", textDecoration: "none" }}
        >
          Open @{X_HANDLE} ↗
        </a>
      </div>
      <p style={hint}>Paste this into a post from @{X_HANDLE}:</p>
      <textarea
        readOnly
        value={postLine}
        style={{ ...ta, height: 52 }}
        onFocus={(e) => e.currentTarget.select()}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <CopyButton text={postLine} label="Copy post" />
        <button onClick={markPosted} disabled={busy} style={btn}>
          {busy ? "…" : "Mark posted"}
        </button>
      </div>
      {err && <p style={{ color: "var(--red)" }}>{err}</p>}
    </section>
  );
}

// A conversational question to the bot. The match logic is already done server-
// side: this surfaces the question, the asker's nearest server-mates (with
// scores), and a Copy-ready context bundle Ethan pastes into claude.ai. He pastes
// Opus's answer into the reply box; Send posts it as a native Discord reply.
function ConversationCard({ item, onSent }: { item: Conversation; onSent: () => void }) {
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function send() {
    if (!reply.trim() || busy) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/discord", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, content: reply }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed.");
      onSent();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Send failed.");
      setBusy(false);
    }
  }

  return (
    <section style={card}>
      <div style={meta}>
        @{item.username || item.userId} ·{" "}
        {item.constellationId ? <Cid id={item.constellationId} /> : <span style={{ color: "var(--red)" }}>unlinked</span>} · {ago(item.createdAt)} ago
      </div>
      <p style={{ margin: "10px 0", fontSize: 15, color: "var(--ink)" }}>{item.content}</p>

      {!item.constellationId ? (
        <p style={hint}>
          No constellation linked to this Discord account — they haven&apos;t submitted, or
          haven&apos;t connected Discord on their constellation page. Reply to invite them.
        </p>
      ) : item.matches.length === 0 ? (
        <p style={hint}>No other read members on the server to match against yet.</p>
      ) : (
        <div style={{ margin: "8px 0" }}>
          <p style={hint}>Nearest server-mates:</p>
          {item.matches.map((m) => (
            <div key={m.constellation_id} style={matchRow}>
              <Cid id={m.constellation_id} />
              <span style={dim}>similarity {m.similarity.toFixed(3)}</span>
              {!m.essence && <span style={{ ...dim, color: "var(--ink-faint)" }}>· no essence yet</span>}
            </div>
          ))}
        </div>
      )}

      {item.constellationId && (
        <div style={{ margin: "10px 0" }}>
          <CopyButton text={item.contextText} label="Copy context for Opus" />
        </div>
      )}

      <p style={hint}>Paste Opus&apos;s reply, then send it as a Discord reply:</p>
      <textarea
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        style={{ ...ta, height: 120, fontFamily: "var(--sans)", fontSize: 14 }}
        placeholder="the reply…"
      />
      <button onClick={send} disabled={!reply.trim() || busy} style={btn}>
        {busy ? "Sending…" : "Send reply"}
      </button>
      {err && <p style={{ color: "var(--red)" }}>{err}</p>}
    </section>
  );
}

// ── small presentational helpers ────────────────────────────────────────────

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginTop: 36 }}>
      <h2 style={h2}>
        {title} {count != null && <span style={dim}>({count})</span>}
      </h2>
      {children}
    </section>
  );
}

function Cid({ id }: { id: string }) {
  return <code style={cid}>{id.slice(0, 8)}</code>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p style={{ color: "var(--ink-faint)", fontSize: 14 }}>{children}</p>;
}

// ── styles (Observatory tokens from globals.css) ────────────────────────────

const page: CSSProperties = {
  maxWidth: 860,
  margin: "0 auto",
  padding: "2.5rem 1.25rem 6rem",
  fontFamily: "var(--sans)",
  color: "var(--ink)",
};
const head: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 16,
};
const mark: CSSProperties = {
  fontFamily: "var(--serif)",
  fontWeight: 400,
  fontSize: 26,
  letterSpacing: 0.5,
};
const h2: CSSProperties = {
  fontFamily: "var(--serif)",
  fontWeight: 400,
  fontSize: 19,
  marginBottom: 12,
};
const dim: CSSProperties = { color: "var(--ink-faint)", fontWeight: 400, fontSize: 13 };

const statBar: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, 1fr)",
  gap: 1,
  marginTop: 24,
  border: "1px solid var(--hair)",
  borderRadius: 10,
  overflow: "hidden",
  background: "var(--hair)",
};
const statCell: CSSProperties = {
  background: "var(--bg-soft)",
  padding: "16px 12px",
  textAlign: "center",
};
const statNum: CSSProperties = { fontSize: 26, fontFamily: "var(--serif)", color: "var(--ink)" };
const statLabel: CSSProperties = {
  fontSize: 10,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--ink-faint)",
  marginTop: 4,
};

const rosterRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "11px 14px",
  borderBottom: "1px solid var(--hair)",
  textDecoration: "none",
  color: "var(--ink-soft)",
  fontSize: 13,
};
const star = (lit: boolean): CSSProperties => ({
  color: lit ? "var(--ink)" : "var(--ink-faint)",
  fontSize: 12,
  opacity: lit ? 1 : 0.5,
});
const badges: CSSProperties = { display: "flex", gap: 5 };
const sourceBadge: CSSProperties = {
  fontSize: 10,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--ink-faint)",
  border: "1px solid var(--hair-strong)",
  borderRadius: 4,
  padding: "1px 6px",
};
const essenceDot: CSSProperties = { color: "var(--essence)" };

const group: CSSProperties = {
  marginTop: 18,
  paddingTop: 4,
  borderTop: "1px solid var(--hair)",
};
const groupHead: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 0",
};

const card: CSSProperties = {
  border: "1px solid var(--hair)",
  borderRadius: 10,
  padding: 16,
  marginTop: 12,
  background: "var(--bg-soft)",
};
const meta: CSSProperties = { fontSize: 12, color: "var(--ink-faint)" };
const imageGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))",
  gap: 6,
  marginTop: 6,
};
const imageCell: CSSProperties = {
  display: "block",
  aspectRatio: "1 / 1",
  borderRadius: 6,
  overflow: "hidden",
  border: "1px solid var(--hair)",
};
const imageImg: CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block",
};
const matchRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "5px 0",
  fontSize: 13,
};
const hint: CSSProperties = { fontSize: 12, color: "var(--ink-faint)", margin: "10px 0 4px" };
const cid: CSSProperties = {
  fontFamily: "ui-monospace, monospace",
  fontSize: 12,
  color: "var(--ink)",
  background: "var(--field-bg)",
  border: "1px solid var(--hair)",
  borderRadius: 4,
  padding: "1px 6px",
};
const input: CSSProperties = {
  flex: 1,
  fontFamily: "var(--sans)",
  fontSize: 14,
  padding: "8px 10px",
  background: "var(--field-bg)",
  color: "var(--ink)",
  border: "1px solid var(--hair-strong)",
  borderRadius: 7,
  boxSizing: "border-box",
};
const cmd: CSSProperties = {
  fontFamily: "ui-monospace, monospace",
  fontSize: 12,
  color: "var(--ink)",
  background: "var(--bg)",
  border: "1px solid var(--hair-strong)",
  borderRadius: 8,
  padding: 10,
  margin: "0 0 8px",
  whiteSpace: "pre-wrap",
  overflowX: "auto",
};
const ta: CSSProperties = {
  width: "100%",
  fontFamily: "ui-monospace, monospace",
  fontSize: 12,
  padding: 10,
  boxSizing: "border-box",
  background: "var(--bg)",
  color: "var(--ink)",
  border: "1px solid var(--hair-strong)",
  borderRadius: 8,
  resize: "vertical",
};
const btn: CSSProperties = {
  marginTop: 10,
  padding: "8px 16px",
  cursor: "pointer",
  background: "var(--ink)",
  color: "var(--bg)",
  border: "none",
  borderRadius: 7,
  fontSize: 13,
  fontWeight: 500,
};
const ghostBtn: CSSProperties = {
  padding: "6px 14px",
  cursor: "pointer",
  background: "transparent",
  color: "var(--ink-soft)",
  border: "1px solid var(--hair-strong)",
  borderRadius: 7,
  fontSize: 12,
};
const runBtn: CSSProperties = {
  padding: "6px 14px",
  cursor: "pointer",
  background: "var(--gold)",
  color: "var(--bg)",
  border: "none",
  borderRadius: 7,
  fontSize: 12,
  fontWeight: 600,
};
const daemonBar: CSSProperties = {
  margin: "14px 0 4px",
  padding: "10px 14px",
  border: "1px solid var(--hair)",
  borderRadius: 10,
  background: "var(--field-bg)",
  fontSize: 12.5,
};

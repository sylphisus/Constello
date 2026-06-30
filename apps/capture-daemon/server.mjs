// capture-daemon — a loopback bridge so the admin console can run a capture with
// ONE CLICK instead of copy-pasting a command into a terminal.
//
// The admin console is served from https://www.constello.xyz; this listens on
// http://127.0.0.1:4599. That's a mixed-content request (HTTPS page → HTTP local),
// which Chrome/Edge allow for localhost — and we answer the Private Network Access
// preflight — so the click reaches us. Safari/Firefox block it; the console keeps
// the Copy-command fallback for those.
//
// Safety: binds to loopback only; only runs a FIXED set of commands built from
// structured params (never an arbitrary string from the page); and requires
// Content-Type: application/json, which forces a CORS preflight so the origin
// allowlist below actually gates who can drive it.
//
//   GET  /health                                                    → { ok: true }
//   POST /pinterest  { boardUrl }                                   → pinterest-capture
//   POST /x-bridge   { handle, constellationId, adminPassword }     → constello-x text bridge
//
// Run:  cd apps/capture-daemon && npm start    (keep it running while you fulfil)
// Env:  PORT, PINTEREST_DIR, TWITTER_DIR, ALLOW_ORIGIN

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

const PORT = Number(process.env.PORT) || 4599;
// Defaults match the admin console's CAPTURE_DIR / BRIDGE_DIR (the laptop paths).
const PINTEREST_DIR =
  process.env.PINTEREST_DIR || join(homedir(), "Documents/constello build/apps/pinterest-capture");
const TWITTER_DIR = process.env.TWITTER_DIR || join(homedir(), "Documents/twitter-preservation");

// Origins allowed to drive the daemon (prod + local dev). A page from anywhere
// else fails the preflight and can't reach the run routes.
const ORIGINS = new Set([
  process.env.ALLOW_ORIGIN,
  "https://www.constello.xyz",
  "https://constello.xyz",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
].filter(Boolean));

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ORIGINS.has(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Private-Network", "true"); // PNA preflight
}

function json(res, code, body) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(b || "{}"));
      } catch {
        resolve({});
      }
    });
  });
}

// Spawn a capture in the foreground of the daemon's terminal (stdout inherited) so
// the operator can watch the scroll progress. Non-blocking for the HTTP request:
// we return as soon as it launches; the capture keeps running.
function run(label, cmd, args, opts) {
  console.log(`\n▶ ${label}: (cd ${opts.cwd}) ${cmd} ${args.join(" ")}`);
  const child = spawn(cmd, args, { ...opts, stdio: ["ignore", "inherit", "inherit"] });
  child.on("error", (e) => console.error(`  ✗ ${label} failed to start: ${e.message}`));
  child.on("exit", (code) => console.log(`  ${label} exited (code ${code})`));
  return child.pid;
}

const server = createServer(async (req, res) => {
  setCors(req, res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  if (req.method === "GET" && req.url === "/health") return json(res, 200, { ok: true });

  if (req.method === "POST") {
    // Require JSON — this forces a CORS preflight, so the origin allowlist gates us.
    if (!String(req.headers["content-type"] || "").includes("application/json")) {
      return json(res, 415, { error: "Content-Type must be application/json." });
    }
    const body = await readJson(req);

    if (req.url === "/pinterest") {
      const boardUrl = String(body.boardUrl || "");
      const ok =
        /^https?:\/\/(\w+\.)*pinterest\.[a-z.]+\//i.test(boardUrl) ||
        /^https?:\/\/pin\.it\//i.test(boardUrl);
      if (!ok) return json(res, 400, { error: "Not a Pinterest board URL." });
      const pid = run("pinterest", "npm", ["start", "--", boardUrl], { cwd: PINTEREST_DIR });
      return json(res, 200, { ok: true, pid });
    }

    if (req.url === "/x-bridge") {
      const handle = String(body.handle || "").replace(/^@/, "");
      const constellationId = String(body.constellationId || "");
      if (!/^\w{1,15}$/.test(handle)) return json(res, 400, { error: "Bad handle." });
      if (!/^[\w-]{8,}$/.test(constellationId)) return json(res, 400, { error: "Bad constellation id." });
      const pid = run("x-bridge", "uv", ["run", "constello-x", handle, "--constellation-id", constellationId], {
        cwd: TWITTER_DIR,
        env: {
          ...process.env,
          CONSTELLO_ADMIN_PASSWORD: String(body.adminPassword || process.env.CONSTELLO_ADMIN_PASSWORD || ""),
        },
      });
      return json(res, 200, { ok: true, pid });
    }
  }

  json(res, 404, { error: "Not found." });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`capture-daemon → http://127.0.0.1:${PORT}`);
  console.log(`  pinterest: ${PINTEREST_DIR}`);
  console.log(`  twitter:   ${TWITTER_DIR}`);
  console.log(`  origins:   ${[...ORIGINS].join(", ")}`);
  console.log(`\nKeep this running (Chrome/Edge) while you fulfil from the admin console.`);
});

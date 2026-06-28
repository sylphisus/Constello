// Minimal per-constellation auth. No usernames: a constellation *is* the account,
// claimed by setting a password the first time someone reaches it. Identity is
// what powers the map's cross-person recognition metric (lib/sky). Kept
// deliberately simple — no recovery yet (a forgotten password locks you out; the
// contacts table can power recovery later).

import crypto from "crypto";

export const SESSION_COOKIE = "constello_session";
const KEYLEN = 64;
export const REMEMBER_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

// ── password (scrypt, salted) ────────────────────────────────────────────────
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, KEYLEN).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(password, salt, KEYLEN).toString("hex");
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(test, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ── session (stateless signed cookie: constellationId.expiry.hmac) ────────────
function secret(): string {
  return process.env.SESSION_SECRET ?? "";
}

/** Signed token proving the bearer is `constellationId`, valid for maxAgeSec. */
export function signSession(constellationId: string, maxAgeSec: number): string {
  const exp = Date.now() + maxAgeSec * 1000;
  const payload = `${constellationId}.${exp}`;
  const sig = crypto.createHmac("sha256", secret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

/** The constellation id a session token vouches for, or null if invalid/expired. */
export function verifySession(value: string | undefined): string | null {
  if (!value || !secret()) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [cid, exp, sig] = parts;
  const expected = crypto
    .createHmac("sha256", secret())
    .update(`${cid}.${exp}`)
    .digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  if (Date.now() > Number(exp)) return null;
  return cid;
}

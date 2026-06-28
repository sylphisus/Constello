// The constellation signature: its live "shape" in a shared coordinate frame.
//
// A signature is derived from the constellation's reading embeddings (the worlds
// it's built — see lib/embed). We project the mean embedding onto a FIXED,
// deterministic set of axes and read off celestial-style coordinates:
//
//   RA  — right ascension (0–24h), the angle around the sphere
//   Dec — declination (−90°…+90°), the angle above/below the equator
//   mag — magnitude (1.0 bright … 6.0 faint), from how coherent the readings are
//
// e.g. "14h22-n51-m3.4".
//
// The projection is fixed (seeded, never refit per-request), so two constellations
// with similar worlds land near each other on the same sphere. That's what lets a
// future "map of all users" plot everyone in one consistent sky: position = where
// the world points, brightness = how tightly its readings cohere.

import { EMBEDDING_DIM } from "./embed";

const SEED = 0x6e5701; // fixed: changing this re-places everyone (their old coordinate URLs stop resolving)
const AXES = 3; // x, y, z — one celestial sphere

// Deterministic PRNG so the projection axes are identical across every deploy.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Three orthonormal axes in embedding space (Gaussian vectors, Gram-Schmidt).
function makeAxes(): number[][] {
  const rand = mulberry32(SEED);
  // Box–Muller for standard-normal entries.
  const gauss = () => {
    const u = Math.max(rand(), 1e-12);
    const v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  const axes: number[][] = [];
  for (let i = 0; i < AXES; i++) {
    const a = Array.from({ length: EMBEDDING_DIM }, gauss);
    // Subtract projections onto the already-chosen axes.
    for (const b of axes) {
      const d = dot(a, b);
      for (let k = 0; k < a.length; k++) a[k] -= d * b[k];
    }
    const n = norm(a);
    for (let k = 0; k < a.length; k++) a[k] /= n || 1;
    axes.push(a);
  }
  return axes;
}

const PROJECTION = makeAxes();

// PLANNED UPGRADE — mean-centering / whitening.
// Learned text embeddings are anisotropic: they don't fill the sphere, they sit
// in a narrow cone (the "representation degeneration problem" — Gao et al. 2019,
// arxiv.org/abs/1907.12009; measured in Ethayarajh 2019, arxiv.org/abs/1909.00512).
// So as directions-from-the-origin, every constellation points roughly the same
// way → RA/Dec cluster in one patch of sky → less spread, more collisions.
// The fix is to subtract the dataset mean (optionally divide by per-axis std)
// before projecting, which recenters the cone on the origin and fans the
// directions out over far more of the sphere.
// Why NOT yet: the mean is a GLOBAL quantity across all constellations, so this
// makes the projection a *fitted* thing — re-estimating the mean shifts
// everyone's coordinates (survivable, but their old coordinate URLs stop
// resolving — it's churn). Sequencing: keep this fixed projection until there are
// enough constellations to estimate a stable mean, then switch to a
// centered/whitened projection as a one-time re-place.

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}
function norm(a: number[]): number {
  return Math.sqrt(dot(a, a));
}

/** Parse a stored embedding (Supabase returns pgvector as a "[..]" string). */
export function parseEmbedding(v: unknown): number[] | null {
  if (Array.isArray(v)) return v as number[];
  if (typeof v === "string") {
    try {
      const arr = JSON.parse(v);
      return Array.isArray(arr) ? arr : null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Build the star-coordinate signature from a constellation's reading embeddings.
 * Returns null when there's nothing to read yet (no embedded readings).
 */
export function signatureFromEmbeddings(embeddings: number[][]): string | null {
  const units = embeddings
    .filter((e) => e.length === EMBEDDING_DIM)
    .map((e) => {
      const n = norm(e);
      return n ? e.map((x) => x / n) : null;
    })
    .filter((e): e is number[] => e !== null);

  if (!units.length) return null;

  // Mean of the unit vectors. Its length is the coherence: 1 = all readings
  // point the same way, →0 = scattered.
  const mean = new Array(EMBEDDING_DIM).fill(0);
  for (const u of units) for (let k = 0; k < EMBEDDING_DIM; k++) mean[k] += u[k] / units.length;
  const coherence = norm(mean); // [0,1]

  // Project the mean onto the fixed axes → a direction on the sphere.
  const x = dot(mean, PROJECTION[0]);
  const y = dot(mean, PROJECTION[1]);
  const z = dot(mean, PROJECTION[2]);
  const r = Math.sqrt(x * x + y * y + z * z) || 1;

  // Right ascension: angle in the x–y plane, 0–24h.
  let raTurns = Math.atan2(y, x) / (2 * Math.PI); // (−0.5, 0.5]
  if (raTurns < 0) raTurns += 1;
  const raTotalMin = Math.round(raTurns * 24 * 60) % (24 * 60);
  const raH = Math.floor(raTotalMin / 60);
  const raM = raTotalMin % 60;

  // Declination: angle above/below the equator, −90°…+90°.
  const decDeg = Math.round((Math.asin(Math.max(-1, Math.min(1, z / r))) * 180) / Math.PI);
  const decTag = `${decDeg >= 0 ? "n" : "s"}${Math.abs(decDeg)}`;

  // Magnitude: coherent worlds are bright (low), scattered ones faint (high).
  const mag = (6 - 5 * Math.max(0, Math.min(1, coherence))).toFixed(1);

  return `${raH}h${String(raM).padStart(2, "0")}-${decTag}-m${mag}`;
}

/** Strip the collision suffix ("-1", "-2"…) to get the bare coordinate cell. */
export function baseCoordinate(signature: string): string {
  return signature.replace(/-\d+$/, "");
}

/** Is this path segment a constellation uuid (vs. a signature)? */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

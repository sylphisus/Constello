// The constellation map's data layer. 1 collection = 1 star (every embedded
// reading). Layout via PCA for now (lib/pca; parametric UMAP later). Recognition
// — who's near whom — is computed in FULL 1024-d cosine (the truth layer), never
// from the lossy 2D positions, so the projection can never sever a real link.

import { supabase } from "./supabase";
import { parseEmbedding } from "./signature";
import { pca2 } from "./pca";

// Tunable. Cosine baseline is elevated by anisotropy, so these sit well above it;
// erring high keeps unrelated pairs from ever crossing. Calibrate (eventually a
// percentile) once there's a real distribution.
export const NEARLY_IDENTICAL = 0.92;
export const EXACT_MATCH = 0.99;

export interface Star {
  constellationId: string;
  x: number;
  y: number;
  mine: boolean;
  match: "exact" | "near" | null; // strongest tie to one of the viewer's collections
}

export interface SkyData {
  stars: Star[];
  links: { a: number; b: number; kind: "exact" | "near" }[]; // gold pulses, indices into stars
  matchCountByConstellation: Record<string, number>; // viewer collections near-identical to each constellation
  viewerSummary: { exact: number; near: number };
}

interface Item {
  cid: string;
  emb: number[]; // unit-normalized (compared as directions)
}

function unit(v: number[]): number[] {
  let s = 0;
  for (const x of v) s += x * x;
  const n = Math.sqrt(s) || 1;
  return v.map((x) => x / n);
}
function cos(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

// Every embedded reading + the constellation it belongs to.
async function fetchItems(): Promise<Item[]> {
  const db = supabase();
  if (!db) return [];
  const { data } = await db.from("readings").select("embedding, entries(constellation_id)");
  return (data ?? [])
    .map((r) => {
      const emb = parseEmbedding(r.embedding);
      const e = Array.isArray(r.entries) ? r.entries[0] : r.entries;
      const cid = (e as { constellation_id?: string } | null)?.constellation_id;
      return emb && cid ? { cid, emb: unit(emb) } : null;
    })
    .filter((x): x is Item => x !== null);
}

export async function buildSky(viewerConstellationId: string | null): Promise<SkyData | null> {
  if (!supabase()) return null;
  const items = await fetchItems();
  if (!items.length) {
    return { stars: [], links: [], matchCountByConstellation: {}, viewerSummary: { exact: 0, near: 0 } };
  }

  const coords = pca2(items.map((it) => it.emb)); // (already unit vectors)
  const stars: Star[] = items.map((it, i) => ({
    constellationId: it.cid,
    x: coords[i].x,
    y: coords[i].y,
    mine: it.cid === viewerConstellationId,
    match: null,
  }));

  const links: SkyData["links"] = [];
  const matchCountByConstellation: Record<string, number> = {};
  let exact = 0;
  let near = 0;

  const mineIdx = stars.map((s, i) => (s.mine ? i : -1)).filter((i) => i >= 0);
  for (const mi of mineIdx) {
    let best = 0;
    const seen = new Set<string>(); // count a viewer-collection once per other-constellation
    for (let j = 0; j < items.length; j++) {
      if (stars[j].mine) continue;
      const c = cos(items[mi].emb, items[j].emb);
      if (c > best) best = c;
      if (c >= NEARLY_IDENTICAL) {
        const kind = c >= EXACT_MATCH ? "exact" : "near";
        links.push({ a: mi, b: j, kind });
        if (kind === "exact" || stars[j].match !== "exact") stars[j].match = kind;
        const key = stars[j].constellationId;
        if (!seen.has(key)) {
          seen.add(key);
          matchCountByConstellation[key] = (matchCountByConstellation[key] ?? 0) + 1;
        }
      }
    }
    if (best >= EXACT_MATCH) exact++;
    else if (best >= NEARLY_IDENTICAL) near++;
  }

  return { stars, links, matchCountByConstellation, viewerSummary: { exact, near } };
}

// Lightweight summary for a constellation's own (private) page — how many of its
// collections are near-identical / exact matches with anyone else's. No PCA.
export async function matchSummary(
  constellationId: string,
): Promise<{ exact: number; near: number }> {
  const items = await fetchItems();
  const mine = items.filter((it) => it.cid === constellationId).map((it) => it.emb);
  const others = items.filter((it) => it.cid !== constellationId).map((it) => it.emb);
  let exact = 0;
  let near = 0;
  for (const m of mine) {
    let best = 0;
    for (const o of others) {
      const c = cos(m, o);
      if (c > best) best = c;
    }
    if (best >= EXACT_MATCH) exact++;
    else if (best >= NEARLY_IDENTICAL) near++;
  }
  return { exact, near };
}

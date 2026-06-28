// Dependency-free PCA → 2D, the placeholder map projection until there's a
// population to fit parametric UMAP on (see the map-architecture memory note).
//
// Power iteration, never forming the D×D covariance: the top component of XᵀX is
// found via v ← Xᵀ(X v), so each step is O(N·D) instead of O(D²). Init is seeded
// and signs are canonicalized, so the layout is deterministic and doesn't flip
// between refits. <3 points can't be fit — they get a trivial line.

export function pca2(vectors: number[][]): { x: number; y: number }[] {
  const n = vectors.length;
  if (n === 0) return [];
  const d = vectors[0].length;
  if (n < 3) return vectors.map((_, i) => ({ x: i - (n - 1) / 2, y: 0 }));

  const mean = new Array(d).fill(0);
  for (const v of vectors) for (let k = 0; k < d; k++) mean[k] += v[k] / n;
  const X = vectors.map((v) => v.map((x, k) => x - mean[k]));

  const v1 = topComponent(X, d, []);
  const v2 = topComponent(X, d, [v1]);

  return X.map((row) => ({ x: dot(row, v1), y: dot(row, v2) }));
}

// Top principal direction of X (orthogonal to any already found), by power
// iteration with re-orthogonalization.
function topComponent(X: number[][], d: number, orth: number[][]): number[] {
  let v = seededUnit(d);
  for (let iter = 0; iter < 100; iter++) {
    const Xv = X.map((row) => dot(row, v)); // N-vector
    const w = new Array(d).fill(0); // w = Xᵀ(Xv)
    for (let i = 0; i < X.length; i++) {
      const c = Xv[i];
      const row = X[i];
      for (let k = 0; k < d; k++) w[k] += c * row[k];
    }
    for (const u of orth) {
      const c = dot(w, u);
      for (let k = 0; k < d; k++) w[k] -= c * u[k];
    }
    const norm = Math.sqrt(dot(w, w)) || 1;
    for (let k = 0; k < d; k++) w[k] /= norm;
    const converged = Math.abs(dot(w, v)) > 1 - 1e-9;
    v = w;
    if (converged) break;
  }
  // Canonical sign: make the largest-magnitude loading positive (stable refits).
  let mi = 0;
  for (let k = 1; k < d; k++) if (Math.abs(v[k]) > Math.abs(v[mi])) mi = k;
  if (v[mi] < 0) for (let k = 0; k < d; k++) v[k] = -v[k];
  return v;
}

function seededUnit(d: number): number[] {
  let s = 0x9e3779b9;
  const v = new Array(d);
  for (let k = 0; k < d; k++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    v[k] = (s / 0x7fffffff) * 2 - 1;
  }
  const norm = Math.sqrt(dot(v, v)) || 1;
  return v.map((x) => x / norm);
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

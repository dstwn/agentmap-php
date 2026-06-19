import { DAMPING, TOL, MAX_ITER } from "./constants.mjs";

export function pagerank(nodes, edges, { personalization = null, damping = DAMPING, tol = TOL, maxIter = MAX_ITER } = {}) {
  const N = nodes.length;
  if (N === 0) return {};
  const idx = new Map(nodes.map((n, i) => [n, i]));
  const outW = new Float64Array(N);
  const adj = Array.from({ length: N }, () => []);
  for (const e of edges) {
    const a = idx.get(e.from), b = idx.get(e.to);
    if (a === undefined || b === undefined || a === b) continue;
    const w = e.weight > 0 ? e.weight : 1;
    adj[a].push([b, w]); outW[a] += w;
  }
  const p = new Float64Array(N);
  if (personalization) {
    let s = 0;
    for (const [k, v] of Object.entries(personalization)) {
      const i = idx.get(k);
      if (i !== undefined && v > 0) { p[i] = v; s += v; }
    }
    if (s === 0) p.fill(1 / N); else for (let i = 0; i < N; i++) p[i] /= s;
  } else p.fill(1 / N);
  let r = Float64Array.from(p);
  for (let iter = 0; iter < maxIter; iter++) {
    let dangling = 0;
    for (let i = 0; i < N; i++) if (outW[i] === 0) dangling += r[i];
    const next = new Float64Array(N);
    for (let i = 0; i < N; i++) next[i] = (1 - damping) * p[i] + damping * dangling * p[i];
    for (let i = 0; i < N; i++) {
      if (outW[i] === 0) continue;
      const ri = damping * r[i];
      for (const [j, w] of adj[i]) next[j] += ri * (w / outW[i]);
    }
    let diff = 0;
    for (let i = 0; i < N; i++) diff += Math.abs(next[i] - r[i]);
    r = next;
    if (diff < tol) break;
  }
  const out = {};
  for (let i = 0; i < N; i++) out[nodes[i]] = r[i];
  return out;
}

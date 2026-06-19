import { IDENT_BOOST, RARE_PENALTY, UNDERSCORE_PENALTY, MIN_IDENT_LEN, RARE_DEFINERS, FOCUS_BOOST, HUBS_LIMIT, RANKED_SYMBOLS_LIMIT } from "./constants.mjs";
import { getOrSet } from "./utils.mjs";
import { pagerank } from "./graph.mjs";

export function identMul(ident, defineCount, mentioned) {
  let mul = 1.0;
  const hasAlpha = /[a-zA-Z]/.test(ident);
  const isSnake = ident.includes("_") && hasAlpha;
  const isKebab = ident.includes("-") && hasAlpha;
  const isCamel = /[a-z]/.test(ident) && /[A-Z]/.test(ident);
  if (mentioned && mentioned.has(ident)) mul *= IDENT_BOOST;
  if ((isSnake || isKebab || isCamel) && ident.length >= MIN_IDENT_LEN) mul *= IDENT_BOOST;
  if (ident.startsWith("_")) mul *= UNDERSCORE_PENALTY;
  if (defineCount > RARE_DEFINERS) mul *= RARE_PENALTY;
  return mul;
}

export function rankSymbols(files, focus) {
  const defines = new Map();
  const references = new Map();
  const definition = new Map();
  for (const [p, f] of Object.entries(files)) {
    for (const e of f.exports) {
      getOrSet(defines, e.name, () => new Set()).add(p);
      definition.set(`${p}|${e.name}`, { file: p, name: e.name, kind: e.kind });
    }
  }
  for (const [p, f] of Object.entries(files)) {
    const reExp = new Set(f.reExports || []);
    for (const tp of f.imports)
      for (const name of f.importedSymbols[tp] || [])
        if (name !== "*" && name !== "default" && !reExp.has(name)) getOrSet(references, name, () => []).push(p);
  }

  let mentioned = null;
  if (focus && focus.size) {
    mentioned = new Set();
    for (const p of focus) {
      for (const e of (files[p]?.exports || [])) mentioned.add(e.name);
      const base = p.split("/").pop().replace(/\.[^.]+$/, "");
      mentioned.add(base);
    }
  }

  const nodes = Object.keys(files);
  const edges = [];
  for (const ident of defines.keys()) {
    if (!references.has(ident)) continue;
    const mul = identMul(ident, defines.get(ident).size, mentioned);
    const counts = new Map();
    for (const refFile of references.get(ident)) counts.set(refFile, (counts.get(refFile) || 0) + 1);
    for (const [refFile, n] of counts)
      for (const defFile of defines.get(ident)) {
        if (refFile === defFile) continue;
        let useMul = mul;
        if (focus && focus.has(refFile)) useMul *= FOCUS_BOOST;
        edges.push({ from: refFile, to: defFile, weight: useMul * Math.sqrt(n), ident });
      }
  }
  let pers = null;
  if (focus && focus.size) {
    pers = {};
    const unit = 100 / nodes.length;
    for (const p of nodes) {
      let v = 0;
      if (focus.has(p)) v += unit;
      const parts = new Set([...p.split("/"), p.split("/").pop(), p.split("/").pop().replace(/\.[^.]+$/, "")]);
      if (mentioned && [...parts].some((x) => mentioned.has(x))) v += unit;
      if (v > 0) pers[p] = v;
    }
    if (!Object.keys(pers).length) pers = null;
  }
  const rank = pagerank(nodes, edges, pers ? { personalization: pers } : {});

  const out = new Map();
  const totalW = new Map();
  for (const e of edges) totalW.set(e.from, (totalW.get(e.from) || 0) + e.weight);
  for (const e of edges) {
    const share = (rank[e.from] || 0) * e.weight / (totalW.get(e.from) || 1);
    const k = `${e.to}|${e.ident}`;
    out.set(k, (out.get(k) || 0) + share);
  }
  const ranked = [...out.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .map(([k, r]) => ({ ...(definition.get(k) || { file: k.slice(0, k.lastIndexOf("|")), name: k.slice(k.lastIndexOf("|") + 1), kind: "?" }), rank: +r.toFixed(6) }))
    .filter((d) => !(focus && focus.has(d.file)));

  const present = new Set(ranked.map((d) => `${d.file}|${d.name}`));
  const lowest = ranked.length ? ranked[ranked.length - 1].rank : 0;
  const baseline = +(lowest - 1e-6 > 0 ? lowest - 1e-6 : 1e-6).toFixed(6);
  const tail = [];
  for (const def of definition.values()) {
    const k = `${def.file}|${def.name}`;
    if (present.has(k)) continue;
    if (focus && focus.has(def.file)) continue;
    tail.push({ ...def, rank: baseline });
  }
  tail.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return [...ranked, ...tail];
}

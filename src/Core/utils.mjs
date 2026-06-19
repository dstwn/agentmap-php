import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { MAXBUF } from "./constants.mjs";

const _require = createRequire(join(dirname(fileURLToPath(import.meta.url)), "../../agentmap.mjs"));
let _tsm = null;
export const tsMorph = () => (_tsm ??= _require("ts-morph"));

export const sh = (c) => { try { return execSync(c, { stdio: ["ignore", "pipe", "ignore"], maxBuffer: MAXBUF }).toString().trim(); } catch { return ""; } };

export const currentSha = () => sh("git rev-parse --short HEAD");

export const dirtyCount = () =>
  sh("git status --porcelain --untracked-files=all").split("\n").filter(Boolean).filter((l) => {
    const xy = l.slice(0, 2);
    let p = l.slice(3);
    if (/[RC]/.test(xy) && p.includes(" -> ")) p = p.split(" -> ").pop();
    p = p.replace(/^"|"$/g, "");
    return /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs|vue)$/.test(p);
  }).length;

export const tokEst = (s) => Math.ceil((s || "").length / 4);

export const getOrSet = (m, k, make) => { let v = m.get(k); if (v === undefined) { v = make(); m.set(k, v); } return v; };

export function stripJsonComments(src) {
  let out = "";
  let inStr = false, esc = false, inLine = false, inBlock = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i], n = src[i + 1];
    if (inLine) { if (c === "\n") { inLine = false; out += c; } continue; }
    if (inBlock) { if (c === "*" && n === "/") { inBlock = false; i++; } continue; }
    if (inStr) {
      out += c;
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; out += c; continue; }
    if (c === "/" && n === "/") { inLine = true; i++; continue; }
    if (c === "/" && n === "*") { inBlock = true; i++; continue; }
    out += c;
  }
  return out;
}

export function parseSettings(text, settingsPath) {
  try { return JSON.parse(text) || {}; }
  catch {
    try { return JSON.parse(stripJsonComments(text)) || {}; }
    catch { throw new Error(`${settingsPath} is not valid JSON — fix or remove it, then re-run`); }
  }
}

#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// ============================================================================
//  bench.mjs — reproducible token-savings benchmark for agentmap.
//
//  Compares the BYTES an agent would have to read into context for three
//  common "understand the codebase" tasks, using a naive shell baseline vs
//  the equivalent agentmap query. Token estimate = chars / 4 (same rough
//  heuristic agentmap itself uses; see the caveat in RESULTS.md).
//
//  Zero deps (only node:child_process / node:path). Targets are auto-derived
//  from the repo (top hub file, top-ranked symbol, hub files for overview),
//  so it is reproducible on ANY ts-morph-mappable repo.
//
//  Usage:  node benchmark/bench.mjs [<target-repo-path>]
//          (defaults to cwd; agentmap itself is resolved next to this file)
// ============================================================================
import { execSync, execFileSync } from "node:child_process";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(process.argv[2] || process.cwd());
const REPOMAP = join(dirname(dirname(fileURLToPath(import.meta.url))), "repomap.mjs");

const tok = (s) => Math.ceil((s || "").length / 4); // chars/4 — see RESULTS.md caveat
const pct = (base, tool) => base === 0 ? 0 : Math.round(((base - tool) / base) * 1000) / 10;

// Source-file grep that mirrors a COMPETENT agent: prunes build/vendor dirs so
// the baseline isn't inflated by minified bundles in node_modules/.next. (A
// naive `grep -rn` without these would balloon the baseline ~1000x and make the
// savings dishonestly large.) --include filters filenames; --exclude-dir prunes.
const SRC_GREP = `grep -rn --include=*.ts --include=*.tsx --include=*.js --include=*.jsx --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git`;

// run a shell command in the target repo; return stdout (empty string on error)
function sh(cmd) {
  try { return execSync(cmd, { cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024 }); }
  catch (e) { return e.stdout ? e.stdout.toString() : ""; }
}
// run agentmap with given flags in the target repo
function repomap(flags) {
  try { return execFileSync("node", [REPOMAP, ...flags], { cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024 }); }
  catch (e) { return e.stdout ? e.stdout.toString() : ""; }
}

// ---- derive targets from the repo's own map (so the bench is repo-agnostic) ----
function jsonMap() {
  const raw = repomap(["--print"]);
  try { return JSON.parse(raw.trim().split("\n").pop()); } catch { return { hubs: [], files: {}, rankedSymbols: [] }; }
}
const map = jsonMap();
// top hub file: first hub line is "path (deg N, pr X)"
const hubFiles = (map.hubs || []).map((h) => h.split(" ")[0]).filter(Boolean);
const HUB_FILE = hubFiles[0];
// a top-ranked exported symbol that isn't a one-letter/too-generic name
const SYM = (map.rankedSymbols || []).map((s) => s.name).find((n) => n && n.length >= 5 && /^[A-Za-z][A-Za-z0-9_]*$/.test(n));
// top 3 hub files for the "overview" scenario
const OVERVIEW_FILES = hubFiles.slice(0, 3);

// =====================================================================
//  Scenario A — "understand a file's dependencies"
//    baseline: cat the file + grep the repo for who imports it
//    agentmap: --any <file>  (exports + imports + dependents, no source)
// =====================================================================
function scenarioA() {
  if (!HUB_FILE) return null;
  const base = sh(`cat ${JSON.stringify(HUB_FILE)}`)
    + sh(`${SRC_GREP} -l ${JSON.stringify(HUB_FILE.split("/").pop())} .`);
  const tool = repomap(["--any", HUB_FILE]);
  return { name: `A. Understand file deps (${HUB_FILE})`,
    baselineCmd: `cat ${HUB_FILE} + grep -rln <basename> .`,
    toolCmd: `repomap.mjs --any ${HUB_FILE}`,
    base: tok(base), tool: tok(tool), baseChars: base.length, toolChars: tool.length };
}

// =====================================================================
//  Scenario B — "find where a symbol is defined/used"
//    baseline: grep -rn <symbol> across the repo
//    agentmap: --find <symbol>  (definition site(s) only)
// =====================================================================
function scenarioB() {
  if (!SYM) return null;
  const base = sh(`${SRC_GREP} ${JSON.stringify(SYM)} .`);
  const tool = repomap(["--find", SYM]);
  return { name: `B. Find symbol (${SYM})`,
    baselineCmd: `grep -rn ${SYM} .`,
    toolCmd: `repomap.mjs --find ${SYM}`,
    base: tok(base), tool: tok(tool), baseChars: base.length, toolChars: tool.length };
}

// =====================================================================
//  Scenario C — "get a repo overview to start working"
//    baseline: file tree (ls -R, no node_modules/.next) + cat top hub files
//    agentmap: --map  (token-budgeted ranked symbol digest)
// =====================================================================
function scenarioC() {
  const tree = sh(`find . -type d \\( -name node_modules -o -name .next -o -name .git \\) -prune -o -type f \\( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' \\) -print`);
  let cats = "";
  for (const f of OVERVIEW_FILES) cats += sh(`cat ${JSON.stringify(f)}`);
  const base = tree + cats;
  const tool = repomap(["--map"]);
  return { name: `C. Repo overview (tree + cat ${OVERVIEW_FILES.length} hub files)`,
    baselineCmd: `find . -name '*.ts*' + cat ${OVERVIEW_FILES.length} hub files`,
    toolCmd: `repomap.mjs --map`,
    base: tok(base), tool: tok(tool), baseChars: base.length, toolChars: tool.length };
}

// ---------------------------------------------------------------------------
const rows = [scenarioA(), scenarioB(), scenarioC()].filter(Boolean);

// environment line
const nodeV = process.version;
const fileCount = map.fileCount ?? Object.keys(map.files || {}).length;
let sha = "";
try { sha = execSync("git rev-parse --short HEAD", { cwd: REPO, encoding: "utf8" }).trim(); } catch {}

const totBase = rows.reduce((a, r) => a + r.base, 0);
const totTool = rows.reduce((a, r) => a + r.tool, 0);

// ---- render ----
const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);
console.log(`agentmap token-savings benchmark`);
console.log(`repo: ${REPO}`);
console.log(`env:  node ${nodeV}, ${fileCount} mapped files, HEAD ${sha || "n/a"}`);
console.log(`est:  tokens = chars / 4\n`);

const W = { s: 42, b: 12, t: 12, sv: 9 };
console.log(`${pad("Scenario", W.s)}${lpad("Baseline tok", W.b)}${lpad("agentmap tok", W.t)}${lpad("Saved %", W.sv)}`);
console.log("-".repeat(W.s + W.b + W.t + W.sv));
for (const r of rows) {
  console.log(`${pad(r.name.slice(0, W.s - 1), W.s)}${lpad(r.base, W.b)}${lpad(r.tool, W.t)}${lpad(pct(r.base, r.tool) + "%", W.sv)}`);
}
console.log("-".repeat(W.s + W.b + W.t + W.sv));
console.log(`${pad("TOTAL", W.s)}${lpad(totBase, W.b)}${lpad(totTool, W.t)}${lpad(pct(totBase, totTool) + "%", W.sv)}`);

console.log(`\nper-scenario commands (run in ${REPO}):`);
for (const r of rows) {
  console.log(`  [${r.name.split(".")[0]}] baseline: ${r.baselineCmd}`);
  console.log(`       agentmap: ${r.toolCmd}`);
}
console.log(`\nHEADLINE: ${pct(totBase, totTool)}% fewer tokens (${totBase} -> ${totTool}) across ${rows.length} scenarios.`);

// machine-readable footer for the RESULTS.md generator / CI
console.log("\n@@JSON@@" + JSON.stringify({
  repo: REPO, node: nodeV, fileCount, sha, totalBaseTok: totBase, totalToolTok: totTool,
  savedPct: pct(totBase, totTool), rows,
}));

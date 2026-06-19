import { existsSync, readFileSync, readdirSync, lstatSync } from "node:fs";
import { join, dirname } from "node:path";
import { MAP, SCHEMA_VERSION, HUBS_LIMIT, RANKED_SYMBOLS_LIMIT, SRC_EXT } from "./constants.mjs";
import { writeFileSync, renameSync, mkdirSync } from "node:fs";
import { sh, currentSha, dirtyCount, tsMorph } from "./utils.mjs";
import { sourceFingerprint } from "./cache.mjs";
import { rankSymbols } from "./rank.mjs";
import { pagerank } from "./graph.mjs";
import { extractVueScripts, vueVirtualPath } from "./vue.mjs";

export function featureOf(path) {
  const m = path.match(/(?:^|.*\/)(?:src\/)?app\/(.+)/);
  if (!m) return null;
  for (const p of m[1].split("/").slice(0, -1)) {
    if (p.startsWith("(") || p.startsWith("[") || p.startsWith("@")) continue;
    return p;
  }
  return null;
}

export function readTsconfigAliasOpts(cfgPath, _depth = 0) {
  try {
    const raw = JSON.parse(readFileSync(cfgPath, "utf8")) || {};
    const co = raw.compilerOptions || {};
    let inherited = null;
    if (raw.extends && _depth < 10) {
      const exts = Array.isArray(raw.extends) ? raw.extends : [raw.extends];
      const here = dirname(cfgPath);
      for (const ext of exts) {
        if (typeof ext !== "string" || !ext) continue;
        if (!/^(\.\.?\/|\/)/.test(ext)) continue;
        let base = join(here, ext);
        if (!existsSync(base) && existsSync(base + ".json")) base += ".json";
        else if (!/\.json$/.test(base) && existsSync(join(base, "tsconfig.json"))) base = join(base, "tsconfig.json");
        if (!existsSync(base)) continue;
        const parent = readTsconfigAliasOpts(base, _depth + 1);
        if (parent) inherited = { ...(inherited || {}), ...parent };
      }
    }
    const self = {};
    if (co.baseUrl) self.baseUrl = co.baseUrl;
    if (co.paths) self.paths = co.paths;
    const out = { ...(inherited || {}), ...self };
    if (!Object.keys(out).length) return null;
    return out;
  } catch { return null; }
}

export function discoverPackageAliasConfigs(rootAbs, listed) {
  const root = rootAbs.replace(/\\/g, "/");
  const configs = [];
  const cfgRels = listed.length
    ? listed.filter((f) => /(^|\/)tsconfig\.json$/.test(f) || /(^|\/)jsconfig\.json$/.test(f))
    : [];
  for (const rel of cfgRels) {
    const full = join(root, rel);
    if (!existsSync(full)) continue;
    const opts = readTsconfigAliasOpts(full);
    if (!opts) continue;
    configs.push({
      dir: join(root, dirname(rel)).replace(/\\/g, "/"),
      baseUrl: opts.baseUrl || ".",
      paths: opts.paths || {},
    });
  }
  configs.sort((a, b) => b.dir.length - a.dir.length);
  return configs;
}

export function nearestAliasConfig(fromAbsDir, configs, rootAbs, rootOpts) {
  const norm = fromAbsDir.replace(/\\/g, "/");
  for (const c of configs) {
    const d = c.dir;
    if (norm === d || norm.startsWith(d + "/")) return c;
  }
  return { dir: rootAbs, baseUrl: rootOpts.baseUrl || ".", paths: rootOpts.paths || {} };
}

export function makeProject() {
  const { Project } = tsMorph();
  const FAST = { skipFileDependencyResolution: true };
  const aliasOpts = (() => {
    for (const cfg of ["tsconfig.json", "jsconfig.json"]) {
      try {
        if (!existsSync(cfg)) continue;
        const opts = readTsconfigAliasOpts(cfg);
        if (opts) return opts;
      } catch {  }
    }
    return {};
  })();

  let project;
  if (existsSync("tsconfig.json")) {
    try { project = new Project({ tsConfigFilePath: "tsconfig.json", ...FAST }); }
    catch {
      console.error("# warning: tsconfig.json unreadable, using source globs");
      project = new Project({ compilerOptions: { allowJs: true, ...aliasOpts }, ...FAST });
    }
  } else {
    project = new Project({ compilerOptions: { allowJs: true, ...aliasOpts }, ...FAST });
  }
  project.addSourceFilesAtPaths([
    "scripts/**/*.{mjs,cjs,js}", "*.mjs", "*.cjs",
  ]);
  const loaded = new Set(project.getSourceFiles().map((s) => s.getFilePath()));
  const cwdp = process.cwd().replace(/\\/g, "/");
  const listed = sh("git ls-files --cached --others --exclude-standard").split("\n").filter(Boolean);
  const packageAliasConfigs = discoverPackageAliasConfigs(cwdp, listed);
  const vueFiles = [];
  if (listed.length) {
    const missing = [];
    for (const f of listed) {
      if (/\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/.test(f)) {
        const segs = f.split("/");
        if (segs.includes("node_modules") || segs.includes(".next")) continue;
        if (!loaded.has(`${cwdp}/${f}`)) missing.push(f);
      } else if (f.endsWith(".vue")) {
        const segs = f.split("/");
        if (segs.includes("node_modules") || segs.includes(".next")) continue;
        vueFiles.push(f);
      }
    }
    if (missing.length) project.addSourceFilesAtPaths(missing);
  } else {
    project.addSourceFilesAtPaths([
      "src/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}", "app/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}",
      "components/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}", "lib/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}",
      "pages/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}", "*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}",
    ]);
    try {
      const walk = (dir, depth) => {
        if (depth > 40) return;
        let names; try { names = readdirSync(dir); } catch { return; }
        for (const name of names) {
          if (name === "node_modules" || name === ".git" || name === ".next") continue;
          const full = dir + "/" + name;
          let st; try { st = lstatSync(full); } catch { continue; }
          if (st.isSymbolicLink()) continue;
          if (st.isDirectory()) walk(full, depth + 1);
          else if (name.endsWith(".vue")) vueFiles.push(full.replace(/^\.\//, ""));
        }
      };
      walk(".", 0);
    } catch {  }
  }
  const vueMap = Object.create(null);
  const vueReal = Object.create(null);
  for (const f of vueFiles) {
    let text; try { text = readFileSync(f, "utf8"); } catch { continue; }
    const block = extractVueScripts(text);
    if (!block || !block.text.trim()) continue;
    const vpath = vueVirtualPath(f, block.lang);
    project.createSourceFile(`${cwdp}/${vpath}`, block.text, { overwrite: true });
    vueMap[`${cwdp}/${vpath}`] = `${cwdp}/${f}`;
    vueReal[`${cwdp}/${f}`] = true;
  }
  return { project, vueMap, vueReal, aliasOpts, packageAliasConfigs };
}

const RES_EXT_LIST = ["ts", "tsx", "mts", "cts", "js", "jsx", "mjs", "cjs"];

function joinPosix(a, b) {
  const parts = (a + "/" + b).split("/");
  const st = [];
  for (const seg of parts) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") st.pop();
    else st.push(seg);
  }
  return (a.startsWith("/") ? "/" : "") + st.join("/");
}

function tryResolveAt(abs, project, vueReal, rel) {
  if (vueReal[abs]) return rel(abs);
  let sf = project.getSourceFile(abs);
  if (!sf) for (const e of RES_EXT_LIST) { sf = project.getSourceFile(`${abs}.${e}`); if (sf) break; }
  if (!sf) for (const e of RES_EXT_LIST) { sf = project.getSourceFile(`${abs}/index.${e}`); if (sf) break; }
  if (sf) return rel(sf.getFilePath());
  if (vueReal[`${abs}.vue`]) return rel(`${abs}.vue`);
  return null;
}

function resolveAlias(spec, fromAbsDir, packageAliasConfigs, aliasOpts, project, vueReal, rel) {
  const ROOTABS = process.cwd().replace(/\\/g, "/");
  const cfg = nearestAliasConfig(fromAbsDir, packageAliasConfigs, ROOTABS, aliasOpts);
  const aliasBase = joinPosix(cfg.dir, cfg.baseUrl || ".");
  const aliasEntries = Object.entries(cfg.paths || {});
  for (const [pat, targets] of aliasEntries) {
    const star = pat.indexOf("*");
    let sub = null;
    if (star === -1) { if (spec === pat) sub = ""; else continue; }
    else {
      const pre = pat.slice(0, star), suf = pat.slice(star + 1);
      if (spec.length < pre.length + suf.length || !spec.startsWith(pre) || !spec.endsWith(suf)) continue;
      sub = spec.slice(pre.length, spec.length - suf.length);
    }
    for (const tRaw of (Array.isArray(targets) ? targets : [targets])) {
      const tStar = tRaw.indexOf("*");
      const candidate = tStar === -1 ? tRaw : tRaw.slice(0, tStar) + sub + tRaw.slice(tStar + 1);
      const hit = tryResolveAt(joinPosix(aliasBase, candidate), project, vueReal, rel);
      if (hit) return hit;
    }
  }
  return null;
}

function resolveRelativeSpec(fromAbsDir, spec, project, vueReal, rel) {
  const baseAbs = joinPosix(fromAbsDir, spec);
  if (vueReal[baseAbs]) return rel(baseAbs);
  let sf = project.getSourceFile(baseAbs);
  if (!sf) for (const e of RES_EXT_LIST) { sf = project.getSourceFile(`${baseAbs}.${e}`); if (sf) break; }
  if (!sf) for (const e of RES_EXT_LIST) { sf = project.getSourceFile(`${baseAbs}/index.${e}`); if (sf) break; }
  if (sf) return rel(sf.getFilePath());
  if (vueReal[`${baseAbs}.vue`]) return rel(`${baseAbs}.vue`);
  return null;
}

export function build() {
  const t0 = Date.now();
  const { project, vueMap, vueReal, aliasOpts, packageAliasConfigs } = makeProject();
  const { SyntaxKind } = tsMorph();
  const CallExpression = SyntaxKind.CallExpression;
  const cwd = process.cwd().replace(/\\/g, "/");
  const rel = (p) => {
    const abs = p.replace(/\\/g, "/");
    const real = vueMap[abs];
    return (real || abs).replace(cwd + "/", "");
  };
  const files = {}, dependents = {}, features = {};
  const excluded = (p) => { const segs = p.split("/"); return segs.includes("node_modules") || segs.includes(".next"); };

  const resolveSpec = (fromAbsDir, spec) => {
    if (!spec.startsWith(".")) return resolveAlias(spec, fromAbsDir, packageAliasConfigs, aliasOpts, project, vueReal, rel);
    return resolveRelativeSpec(fromAbsDir, spec, project, vueReal, rel);
  };

  const sourceFiles = project.getSourceFiles();
  process.stderr.write(`# agentmap: parsing ${sourceFiles.length} source files…\n`);
  for (const sf of sourceFiles) {
    const path = rel(sf.getFilePath());
    if (excluded(path)) continue;
    try {
    const fromDir = sf.getDirectoryPath().replace(/\\/g, "/");
    const reExports = new Set();
    let defaultExportName = null;
    const exports = [...sf.getExportedDeclarations()].map(([name, d]) => {
      const resolved = name === "default" ? (d[0]?.getName?.() ?? "default") : name;
      if (name === "default") defaultExportName = resolved;
      return { name: resolved, kind: d[0]?.getKindName?.() ?? "?" };
    });
    const importedSymbols = {};
    const addEdge = (tp, names) => {
      if (!tp || excluded(tp)) return;
      (importedSymbols[tp] ??= []).push(...names);
    };
    for (const imp of sf.getImportDeclarations()) {
      if (imp.isTypeOnly()) continue;
      const t = imp.getModuleSpecifierSourceFile();
      if (t) {
        const names = imp.getNamedImports().filter((n) => !n.isTypeOnly()).map((n) => n.getName());
        if (imp.getDefaultImport()) names.push("default");
        if (imp.getNamespaceImport()) names.push("*");
        addEdge(rel(t.getFilePath()), names.length ? names : ["*"]);
      } else {
        const spec = imp.getModuleSpecifierValue();
        const tp = resolveSpec(fromDir, spec);
        if (tp) {
          const names = imp.getNamedImports().filter((n) => !n.isTypeOnly()).map((n) => n.getName());
          if (imp.getDefaultImport()) names.push("default");
          if (imp.getNamespaceImport()) names.push("*");
          addEdge(tp, names.length ? names : ["*"]);
        }
      }
    }
    for (const exp of sf.getExportDeclarations()) {
      if (exp.isTypeOnly()) continue;
      const t = exp.getModuleSpecifierSourceFile();
      if (t) {
        const names = exp.getNamedExports().filter((n) => !n.isTypeOnly()).map((n) => n.getName());
        addEdge(rel(t.getFilePath()), names);
        for (const n of names) reExports.add(n);
      } else {
        const spec = exp.getModuleSpecifierValue();
        if (!spec) continue;
        const tp = resolveSpec(fromDir, spec);
        if (tp) {
          const names = exp.getNamedExports().filter((n) => !n.isTypeOnly()).map((n) => n.getName());
          addEdge(tp, names);
          for (const n of names) reExports.add(n);
        }
      }
    }
    const srcText = sf.getFullText();
    if (srcText.includes("import(") || srcText.includes("require(")) for (const call of sf.getDescendantsOfKind(CallExpression)) {
      const expr = call.getExpression();
      const kind = expr.getKind();
      const isImport = kind === SyntaxKind.ImportKeyword;
      const isRequire = expr.getText?.() === "require";
      if (!isImport && !isRequire) continue;
      const a0 = call.getArguments()[0];
      if (!a0 || a0.getKind() !== SyntaxKind.StringLiteral) continue;
      const tp = resolveSpec(fromDir, a0.getLiteralText());
      if (tp) addEdge(tp, ["*"]);
    }
    const imports = Object.keys(importedSymbols);
    for (const tp of imports) (dependents[tp] ??= []).push(path);
    files[path] = { exports, imports, importedSymbols, defaultExportName, reExports: [...reExports] };
    const feat = featureOf(path);
    if (feat) (features[feat] ??= []).push(path);
    } catch (e) {
      process.stderr.write(`# agentmap: skipped ${path} (parse error: ${e?.message ?? e})\n`);
    }
  }

  for (const f of Object.values(files)) {
    for (const tp of Object.keys(f.importedSymbols)) {
      const dn = files[tp]?.defaultExportName;
      if (!dn || dn === "default") continue;
      f.importedSymbols[tp] = f.importedSymbols[tp].map((n) => (n === "default" ? dn : n));
    }
  }
  for (const p in files) files[p].dependents = dependents[p] ?? [];

  const nodes = Object.keys(files);
  const fileEdges = [];
  for (const [p, f] of Object.entries(files))
    for (const tp of f.imports)
      if (files[tp]) fileEdges.push({ from: p, to: tp, weight: (f.importedSymbols[tp] || []).length || 1 });
  const fileRank = pagerank(nodes, fileEdges);
  for (const p of nodes) files[p].pagerank = +(fileRank[p] || 0).toFixed(6);

  const rankedSymbols = rankSymbols(files, null);

  const hubs = nodes
    .map((p) => [p, files[p].pagerank, files[p].dependents.length])
    .sort((a, b) => b[1] - a[1])
    .slice(0, HUBS_LIMIT)
    .map(([p, pr, deg]) => `${p} (deg ${deg}, pr ${pr})`);

  for (const p of nodes) delete files[p].defaultExportName;

  const sha = currentSha();
  const out = {
    schema: SCHEMA_VERSION, generatedSha: sha, dirty: dirtyCount(), fileCount: nodes.length,
    fingerprint: sha ? undefined : sourceFingerprint(),
    hubs, features, rankedSymbols: rankedSymbols.slice(0, RANKED_SYMBOLS_LIMIT), files,
  };
  mkdirSync(".claude/agentmap", { recursive: true });
  const tmp = MAP + ".tmp";
  writeFileSync(tmp, JSON.stringify(out));
  renameSync(tmp, MAP);
  process.stderr.write(`# agentmap: built ${nodes.length} files in ${Date.now() - t0}ms\n`);
  return out;
}

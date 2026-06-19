import { createHash } from "node:crypto";
import { readdirSync, lstatSync, existsSync, readFileSync } from "node:fs";
import { currentSha, dirtyCount } from "./utils.mjs";
import { MAP, MAP_LEGACY, SCHEMA_VERSION } from "./constants.mjs";
import { build } from "./map-builder.mjs";

export function sourceFingerprint() {
  try {
    const entries = [];
    const SRC_EXT = /\.(ts|tsx|mts|cts|jsx|js|mjs|cjs|vue)$/;
    const walk = (dir, depth) => {
      if (depth > 40) return;
      let names; try { names = readdirSync(dir); } catch { return; }
      for (const name of names) {
        if (name === "node_modules" || name === ".git" || name === ".next") continue;
        const full = dir + "/" + name;
        let st; try { st = lstatSync(full); } catch { continue; }
        if (st.isSymbolicLink()) continue;
        if (st.isDirectory()) walk(full, depth + 1);
        else if (SRC_EXT.test(name)) entries.push(`${full}:${st.mtimeMs}:${st.size}`);
      }
    };
    walk(".", 0);
    entries.sort();
    return createHash("sha1").update(entries.join("\n")).digest("hex");
  } catch { return ""; }
}

export function ensureFresh() {
  const sha = currentSha();
  const mapPath = existsSync(MAP) ? MAP : (existsSync(MAP_LEGACY) ? MAP_LEGACY : MAP);
  if (existsSync(mapPath)) {
    try {
      const cached = JSON.parse(readFileSync(mapPath, "utf8"));
      if (sha && cached.generatedSha === sha && cached.schema === SCHEMA_VERSION && cached.dirty === 0 && dirtyCount() === 0) return cached;
      if (!sha && cached.schema === SCHEMA_VERSION && cached.fingerprint) {
        const fp = sourceFingerprint();
        if (fp && cached.fingerprint === fp) return cached;
      }
    } catch {}
  }
  return build();
}

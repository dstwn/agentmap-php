import { existsSync } from "node:fs";
import { join } from "node:path";
import { LEGACY_DIRS } from "./constants.mjs";

export class LegacyDetector {
  /**
   * Detect non-PSR-4 / legacy code indicators from a project root.
   *
   * @param {string} projectRoot  Absolute path to the project root
   * @param {Object} psr4Map      PSR-4 map from composer.json (key: namespace prefix, value: dir or dir[])
   * @param {string[]} classmaps  classmap entries from autoload + autoload-dev
   * @param {string[]} autoFiles  files entries from autoload + autoload-dev
   * @returns {{ type: string, directory?: string, entry?: string, message: string }[]}
   */
  detect(projectRoot, psr4Map, classmaps, autoFiles) {
    // Build set of PSR-4-covered directories (both with and without trailing slash)
    const coveredDirs = new Set();
    for (const dirs of Object.values(psr4Map)) {
      const arr = Array.isArray(dirs) ? dirs : [dirs];
      for (const d of arr) {
        const normalized = d.replace(/\/+$/, "");
        coveredDirs.add(normalized);        // "src"
        coveredDirs.add(normalized + "/");  // "src/"
      }
    }

    const warnings = [];

    // LEG-02: Heuristic legacy-dir check
    for (const dir of LEGACY_DIRS) {
      const absDir = join(projectRoot, dir);
      const dirNoSlash = dir.replace(/\/+$/, "");
      if (existsSync(absDir) && !coveredDirs.has(dirNoSlash) && !coveredDirs.has(dir)) {
        warnings.push({
          type: "legacy-dir",
          directory: dir,
          message: `Directory '${dir}' exists but is not registered as a PSR-4 namespace prefix`,
        });
      }
    }

    // LEG-01: classmap entries (skip vendor/ paths — Pitfall 6)
    for (const entry of classmaps) {
      if (entry.startsWith("vendor/")) continue;
      warnings.push({ type: "classmap", entry, message: `classmap entry: ${entry}` });
    }

    // LEG-01: autoload.files entries (skip vendor/ paths — Pitfall 6)
    for (const file of autoFiles) {
      if (file.startsWith("vendor/")) continue;
      warnings.push({ type: "autoload-file", entry: file, message: `autoload.files entry: ${file}` });
    }

    return warnings;
  }
}

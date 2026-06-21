import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { COMPOSER_FILES } from "./constants.mjs";

function readJsonSafe(filePath, label) {
  if (!existsSync(filePath)) {
    process.stderr.write(`# agentmap: ${label} not found at ${filePath}\n`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch (e) {
    process.stderr.write(`# agentmap: ${label} is corrupt or invalid JSON: ${e.message}\n`);
    return null;
  }
}

export class ComposerParser {
  parse(projectRoot) {
    const jsonPath = join(projectRoot, COMPOSER_FILES[0]);
    const lockPath = join(projectRoot, COMPOSER_FILES[1]);
    const json = readJsonSafe(jsonPath, "composer.json");
    const lock = readJsonSafe(lockPath, "composer.lock");

    const packages = [];
    const LINK_TYPES = ["require", "require-dev", "conflict", "replace", "provide", "suggest"];

    if (json) {
      const name = json.name ?? "(root)";
      for (const linkType of LINK_TYPES) {
        for (const [pkg, constraint] of Object.entries(json[linkType] ?? {})) {
          packages.push({ from: name, to: pkg, type: linkType, constraint, resolvedVersion: null });
        }
      }
    }

    // Build resolved version map from lock file (both packages and packages-dev)
    const resolved = new Map();
    if (lock) {
      for (const pkg of [...(lock.packages ?? []), ...(lock["packages-dev"] ?? [])]) {
        resolved.set(pkg.name, pkg.version);
      }
    }

    // Merge resolved versions into edges
    for (const entry of packages) {
      entry.resolvedVersion = resolved.get(entry.to) ?? null;
    }

    // Extract autoload sections (merge autoload + autoload-dev)
    const psr4Map = {
      ...(json?.autoload?.["psr-4"] ?? {}),
      ...(json?.["autoload-dev"]?.["psr-4"] ?? {}),
    };
    const classmaps = [
      ...(json?.autoload?.classmap ?? []),
      ...(json?.["autoload-dev"]?.classmap ?? []),
    ];
    const autoFiles = [
      ...(json?.autoload?.files ?? []),
      ...(json?.["autoload-dev"]?.files ?? []),
    ];

    return { packages, psr4Map, classmaps, autoFiles };
  }
}

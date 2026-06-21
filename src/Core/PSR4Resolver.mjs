import { existsSync } from "node:fs";
import { join } from "node:path";

export class PSR4Resolver {
  resolve(fqcn, projectRoot, psr4Map) {
    const nsParts = fqcn.split("\\");
    for (const [prefix, dirs] of Object.entries(psr4Map)) {
      const prefixParts = prefix.replace(/\\+$/, "").split("\\");
      let match = true;
      for (let i = 0; i < prefixParts.length; i++) {
        if (nsParts[i] !== prefixParts[i]) { match = false; break; }
      }
      if (!match) continue;
      const dirsArr = Array.isArray(dirs) ? dirs : [dirs];
      for (const dir of dirsArr) {
        const remaining = nsParts.slice(prefixParts.length);
        const relPath = join(dir, ...remaining) + ".php";
        const absPath = join(projectRoot, relPath);
        if (existsSync(absPath)) return absPath;
      }
    }
    return null;
  }
}

export class LanguageParser {
  get language() { return null; }
  get fileExtensions() { return []; }
  async init() {}
  canParse(filePath) { return this.fileExtensions.some(ext => filePath.endsWith(ext)); }
  parse(filePath, text) { throw new Error("Not implemented"); }
  extractImports(ast) { return []; }
  extractExports(ast) { return []; }
  extractSymbols(ast) { return []; }
  resolveImport(importPath, fromFile, projectRoot) { return null; }
  dispose() {}
}

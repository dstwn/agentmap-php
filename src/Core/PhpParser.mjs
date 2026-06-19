import { readFileSync, existsSync, readdirSync, lstatSync } from "node:fs";
import { join, dirname } from "node:path";
import { createRequire } from "node:module";
import { LanguageParser } from "./language-parser.mjs";
import { sh } from "./utils.mjs";

const _require = createRequire(import.meta.url);

export class PhpParser extends LanguageParser {
  constructor() {
    super();
    this._parser = null;
    this._phpLang = null;
    this._ready = false;
  }

  get language() { return "php"; }
  get fileExtensions() { return [".php"]; }

  init() {
    if (this._ready) return;
    const Parser = _require("tree-sitter");
    this._phpLang = _require("tree-sitter-php")?.php;
    if (!this._phpLang) throw new Error("tree-sitter-php not available");
    this._parser = new Parser();
    this._parser.setLanguage(this._phpLang);
    this._ready = true;
  }

  canParse(filePath) {
    return filePath.endsWith(".php") || filePath.endsWith(".php5") || filePath.endsWith(".inc");
  }

  parse(filePath, text) {
    this.init();
    const tree = this._parser.parse(text);
    return { filePath, tree, root: tree.rootNode };
  }

  extractImports(ast) {
    const imports = [];
    const { root } = ast;
    this._walk(root, (node) => {
      if (node.type === "namespace_use_declaration") {
        const clause = this._findChild(node, ["namespace_use_clause"]);
        if (clause) {
          const qn = this._findChild(clause, ["qualified_name"]);
          const aliasNode = clause.childForFieldName("alias");
          imports.push({
            type: "use",
            name: qn ? qn.text : clause.text,
            alias: aliasNode ? aliasNode.text : null,
            startPosition: node.startPosition,
          });
        }
      }
      if (node.type === "include_expression" || node.type === "include_once_expression") {
        const uriNode = this._findChild(node, ["string_expression", "encapsed_string", "name"]);
        if (uriNode) {
          imports.push({
            type: node.type === "include_once_expression" ? "include_once" : "include",
            path: uriNode.text.replace(/['"]/g, ""),
            startPosition: node.startPosition,
          });
        }
      }
      if (node.type === "require_expression" || node.type === "require_once_expression") {
        const uriNode = this._findChild(node, ["string_expression", "encapsed_string", "name"]);
        if (uriNode) {
          imports.push({
            type: node.type === "require_once_expression" ? "require_once" : "require",
            path: uriNode.text.replace(/['"]/g, ""),
            startPosition: node.startPosition,
          });
        }
      }
      if (node.type === "function_call_expression") {
        const func = node.childForFieldName("function");
        if (func && func.type === "name" && func.text === "app") {
          const args = node.childForFieldName("arguments");
          if (args) {
            const cls = this._findChild(args, ["string_expression"]);
            if (cls) {
              imports.push({
                type: "laravel_helper",
                name: cls.text.replace(/['"]/g, ""),
                startPosition: node.startPosition,
              });
            }
          }
        }
      }
    });
    return imports;
  }

  extractExports(ast) {
    const exports = [];
    const { root, filePath } = ast;
    this._walk(root, (node) => {
      if (node.type === "class_declaration") {
        const nameNode = node.childForFieldName("name");
        if (nameNode) {
          const baseClause = this._findChild(node, ["base_clause"]);
          const base = baseClause ? this._findChild(baseClause, ["name"]) : null;
          exports.push({
            name: nameNode.text,
            kind: "class",
            extends: base ? base.text : null,
            startPosition: node.startPosition,
            filePath,
          });
        }
      }
      if (node.type === "interface_declaration") {
        const nameNode = node.childForFieldName("name");
        if (nameNode) exports.push({ name: nameNode.text, kind: "interface", startPosition: node.startPosition, filePath });
      }
      if (node.type === "trait_declaration") {
        const nameNode = node.childForFieldName("name");
        if (nameNode) exports.push({ name: nameNode.text, kind: "trait", startPosition: node.startPosition, filePath });
      }
      if (node.type === "enum_declaration") {
        const nameNode = node.childForFieldName("name");
        if (nameNode) exports.push({ name: nameNode.text, kind: "enum", startPosition: node.startPosition, filePath });
      }
      if (node.type === "function_definition") {
        const nameNode = node.childForFieldName("name");
        if (nameNode) exports.push({ name: nameNode.text, kind: "function", startPosition: node.startPosition, filePath });
      }
      if (node.type === "function_static_call" || node.type === "scoped_property_access") {
        const nameNode = node.childForFieldName("name");
        if (nameNode) exports.push({ name: nameNode.text, kind: "static_call", startPosition: node.startPosition, filePath });
      }
      if (node.type === "method_declaration") {
        const nameNode = node.childForFieldName("name");
        const visibility = this._findChild(node, ["public", "private", "protected"]);
        if (nameNode) {
          exports.push({
            name: nameNode.text,
            kind: "method",
            visibility: visibility ? visibility.type : "public",
            startPosition: node.startPosition,
            filePath,
          });
        }
      }
      if (node.type === "property_declaration") {
        const nameNode = this._findChild(node, ["property_element"]);
        if (nameNode) {
          const varNode = this._findChild(nameNode, ["variable_name", "name"]);
          if (varNode) {
            exports.push({
              name: varNode.text,
              kind: "property",
              startPosition: node.startPosition,
              filePath,
            });
          }
        }
      }
    });
    return exports;
  }

  extractSymbols(ast) {
    return [...this.extractImports(ast), ...this.extractExports(ast)];
  }

  resolveImport(importPath, fromFile, projectRoot) {
    if (importPath.startsWith("/")) return importPath;
    if (importPath.startsWith("./") || importPath.startsWith("../")) {
      const base = dirname(fromFile);
      const resolved = join(base, importPath);
      for (const ext of [".php", ".php5", ".inc"]) {
        const withExt = resolved + ext;
        if (existsSync(withExt)) return withExt;
      }
      const index = join(resolved, "index.php");
      if (existsSync(index)) return index;
      return null;
    }
    const psr4 = this._resolvePsr4(importPath, projectRoot);
    if (psr4) return psr4;
    return null;
  }

  _resolvePsr4(fqcn, projectRoot) {
    const composerPath = join(projectRoot, "composer.json");
    if (!existsSync(composerPath)) return null;
    try {
      const composer = JSON.parse(readFileSync(composerPath, "utf8"));
      const autoload = composer.autoload || {};
      const psr4 = { ...(autoload["psr-4"] || {}), ...(autoload["psr-0"] || {}) };
      const nsParts = fqcn.split("\\");
      for (const [prefix, dirs] of Object.entries(psr4)) {
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
    } catch {}
    return null;
  }

  _walk(node, fn) {
    fn(node);
    for (let i = 0; i < node.childCount; i++) this._walk(node.child(i), fn);
  }

  _findChild(node, types) {
    for (let i = 0; i < node.childCount; i++) {
      const c = node.child(i);
      if (types.includes(c.type)) return c;
    }
    return null;
  }

  _findDeep(node, types, depth = 0) {
    if (depth > 6) return null;
    for (let i = 0; i < node.childCount; i++) {
      const c = node.child(i);
      if (types.includes(c.type)) return c;
      const r = this._findDeep(c, types, depth + 1);
      if (r) return r;
    }
    return null;
  }
}

import { createRequire } from "node:module";
import { PSR4Resolver } from "./PSR4Resolver.mjs";

const _require = createRequire(import.meta.url);

export class TypeResolver {
  constructor() {
    this._parser = null;
    this._phpLang = null;
    this._ready = false;
  }

  init() {
    if (this._ready) return;
    const Parser = _require("tree-sitter");
    this._phpLang = _require("tree-sitter-php")?.php;
    if (!this._phpLang) throw new Error("tree-sitter-php not available");
    this._parser = new Parser();
    this._parser.setLanguage(this._phpLang);
    this._ready = true;
  }

  resolve(filePath, text, psr4Map, projectRoot) {
    try {
      this.init();
      const tree = this._parser.parse(text);
      const root = tree.rootNode;
      const useMap = this._collectUseImports(root);
      const assignedTypes = this._extractAssignments(root, useMap, psr4Map, projectRoot);
      const phpDocTypes = this._extractPhpDoc(root);
      return { assignedTypes, phpDocTypes };
    } catch (_) {
      return { assignedTypes: [], phpDocTypes: [] };
    }
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

  _collectUseImports(root) {
    const useMap = {};
    this._walk(root, (node) => {
      if (node.type !== "namespace_use_declaration") return;
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child.type !== "namespace_use_clause") continue;
        const qn = this._findChild(child, ["qualified_name"]);
        if (!qn) continue;
        const fqcn = qn.text.replace(/^\\/, "");
        const aliasNode = child.childForFieldName("alias");
        const key = aliasNode ? aliasNode.text : fqcn.split("\\").pop();
        useMap[key] = fqcn;
      }
    });
    return useMap;
  }

  _extractAssignments(root, useMap, psr4Map, projectRoot) {
    const results = [];
    this._walk(root, (node) => {
      if (node.type !== "assignment_expression") return;
      const lhs = node.child(0);
      const rhs = node.child(2);
      if (!lhs || !rhs) return;
      if (lhs.type !== "variable_name") return;

      if (rhs.type === "object_creation_expression") {
        const classNode = this._findChild(rhs, ["qualified_name", "name", "relative_scope"]);
        if (!classNode) return;
        // Skip relative_scope (self, static, parent)
        if (classNode.type === "relative_scope") return;
        const rawName = classNode.text.replace(/^\\/, "");
        const fqcn = useMap[rawName] || rawName;
        let resolvedPath = null;
        if (psr4Map && projectRoot && Object.keys(psr4Map).length > 0) {
          const abs = new PSR4Resolver().resolve(fqcn, projectRoot, psr4Map);
          if (abs) {
            resolvedPath = abs.startsWith(projectRoot)
              ? abs.slice(projectRoot.length).replace(/^[\\/]/, "")
              : abs;
          }
        }
        results.push({
          type: "assigned",
          variable: lhs.text,
          className: fqcn,
          resolvedPath,
          confidence: "MEDIUM",
          position: node.startPosition,
        });
        return;
      }

      if (rhs.type === "scoped_call_expression") {
        const clsNode = this._findChild(rhs, ["qualified_name", "name"]);
        if (!clsNode) return;
        const rawName = clsNode.text.replace(/^\\/, "");
        const fqcn = useMap[rawName] || rawName;
        // method name is the 3rd child (index 2): ClassName :: methodName
        const methodNode = rhs.child(2);
        results.push({
          type: "static_call",
          variable: lhs.text,
          class: fqcn,
          method: methodNode?.text || "?",
          confidence: "MEDIUM",
          position: node.startPosition,
        });
      }
    });
    return results;
  }

  _extractPhpDoc(root) {
    const results = [];
    this._walk(root, (node) => {
      if (node.type !== "comment") return;
      if (!node.text.startsWith("/**")) return;
      const row = node.endPosition.row;
      const tags = this._parseDocBlock(node.text);
      for (const tag of tags) {
        results.push({ ...tag, confidence: "MEDIUM", row });
      }
    });
    return results;
  }

  _parseDocBlock(text) {
    const tags = [];

    // @var Type [$name]
    const varRe = /@var\s+([\w\\|?[\]]+)(?:\s+(\$\w+))?/g;
    let m;
    while ((m = varRe.exec(text)) !== null) {
      tags.push({ tag: "@var", type: m[1], name: m[2] || null });
    }

    // @return Type
    const retRe = /@return\s+([\w\\|?[\]]+)/g;
    while ((m = retRe.exec(text)) !== null) {
      tags.push({ tag: "@return", type: m[1], name: null });
    }

    // @param Type $name
    const paramRe = /@param\s+([\w\\|?[\]]+)\s+(\$\w+)/g;
    while ((m = paramRe.exec(text)) !== null) {
      tags.push({ tag: "@param", type: m[1], name: m[2] });
    }

    // @property[-read|-write] Type $name
    const propRe = /@property(?:-read|-write)?\s+([\w\\|?[\]]+)\s+(\$\w+)/g;
    while ((m = propRe.exec(text)) !== null) {
      tags.push({ tag: "@property", type: m[1], name: m[2] });
    }

    return tags;
  }
}

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { PhpParser } from "./PhpParser.mjs";

const LARAVEL_FACADES = {
  "App": "Illuminate\\Support\\Facades\\App",
  "Artisan": "Illuminate\\Support\\Facades\\Artisan",
  "Auth": "Illuminate\\Support\\Facades\\Auth",
  "Blade": "Illuminate\\Support\\Facades\\Blade",
  "Broadcast": "Illuminate\\Support\\Facades\\Broadcast",
  "Bus": "Illuminate\\Support\\Facades\\Bus",
  "Cache": "Illuminate\\Support\\Facades\\Cache",
  "Config": "Illuminate\\Support\\Facades\\Config",
  "Cookie": "Illuminate\\Support\\Facades\\Cookie",
  "Crypt": "Illuminate\\Support\\Facades\\Crypt",
  "DB": "Illuminate\\Support\\Facades\\DB",
  "Event": "Illuminate\\Support\\Facades\\Event",
  "File": "Illuminate\\Support\\Facades\\File",
  "Gate": "Illuminate\\Support\\Facades\\Gate",
  "Hash": "Illuminate\\Support\\Facades\\Hash",
  "Http": "Illuminate\\Support\\Facades\\Http",
  "Lang": "Illuminate\\Support\\Facades\\Lang",
  "Log": "Illuminate\\Support\\Facades\\Log",
  "Mail": "Illuminate\\Support\\Facades\\Mail",
  "Notification": "Illuminate\\Support\\Facades\\Notification",
  "Password": "Illuminate\\Support\\Facades\\Password",
  "Queue": "Illuminate\\Support\\Facades\\Queue",
  "RateLimiter": "Illuminate\\Support\\Facades\\RateLimiter",
  "Redirect": "Illuminate\\Support\\Facades\\Redirect",
  "Redis": "Illuminate\\Support\\Facades\\Redis",
  "Request": "Illuminate\\Support\\Facades\\Request",
  "Response": "Illuminate\\Support\\Facades\\Response",
  "Route": "Illuminate\\Support\\Facades\\Route",
  "Schema": "Illuminate\\Support\\Facades\\Schema",
  "Session": "Illuminate\\Support\\Facades\\Session",
  "Storage": "Illuminate\\Support\\Facades\\Storage",
  "URL": "Illuminate\\Support\\Facades\\URL",
  "Validator": "Illuminate\\Support\\Facades\\Validator",
  "View": "Illuminate\\Support\\Facades\\View",
};

const LARAVEL_FACADE_CLASSES = Object.fromEntries(
  Object.entries(LARAVEL_FACADES).map(([short, fqcn]) => [fqcn, short])
);

const ELOQUENT_MODEL = "Illuminate\\Database\\Eloquent\\Model";
const ELOQUENT_RELATIONS = [
  "hasOne", "hasMany", "belongsTo", "belongsToMany", "hasManyThrough",
  "hasOneThrough", "morphOne", "morphMany", "morphToMany", "morphedByMany",
  "morphTo",
];

export class LaravelParser extends PhpParser {
  constructor() {
    super();
    this._appPath = null;
    this._routeFiles = [];
  }

  setProjectRoot(root) {
    this._appPath = root;
    if (existsSync(join(root, "routes"))) {
      for (const f of readdirSync(join(root, "routes"))) {
        if (f.endsWith(".php")) this._routeFiles.push(join("routes", f));
      }
    }
  }

  extractExports(ast) {
    const exports = super.extractExports(ast);
    const { root, filePath } = ast;
    this._walk(root, (node) => {
      if (node.type === "scoped_call_expression") {
        const classNode = node.child(0);
        const methodNode = node.child(2);
        if (classNode && methodNode && classNode.type === "name") {
          const name = classNode.text + "::" + methodNode.text;
          const facades = Object.keys(LARAVEL_FACADES);
          if (facades.includes(classNode.text)) {
            exports.push({
              name: classNode.text,
              kind: "facade_call",
              facade: LARAVEL_FACADES[classNode.text],
              method: methodNode.text,
              startPosition: node.startPosition,
              filePath,
            });
          }
          const isRoute = classNode.text === "Route";
          if (isRoute && (name === "Route::resource" || name === "Route::apiResource")) {
            const argsNode = this._findChild(node, ["arguments"]);
            if (!argsNode) return;
            const uriArg = this._findDeep(argsNode, ["string"]);
            exports.push({
              name: handlerArgName(argsNode),
              kind: "route_handler",
              route: uriArg ? uriArg.text.replace(/['"]/g, "") : "?",
              routeType: "resource",
              startPosition: node.startPosition,
              filePath,
            });
          } else if (isRoute && name.startsWith("Route::") && name !== "Route::" && !name.startsWith("Route::resource") && !name.startsWith("Route::apiResource")) {
            const method = name.replace("Route::", "");
            const argsNode = this._findChild(node, ["arguments"]);
            if (!argsNode) return;
            const uriArg = this._findDeep(argsNode, ["string"]);
            if (uriArg) {
              exports.push({
                name: handlerArgName(argsNode),
                kind: "route_handler",
                route: uriArg.text.replace(/['"]/g, ""),
                routeType: method,
                startPosition: node.startPosition,
                filePath,
              });
            }
          }
        }
      }
    });
    return exports;
  }

  extractImports(ast) {
    const imports = super.extractImports(ast);
    const { root } = ast;
    this._walk(root, (node) => {
      if (node.type === "method_declaration") {
        const nameNode = this._findChild(node, ["name"]);
        if (!nameNode) return;
        const body = this._findChild(node, ["compound_statement"]);
        if (!body) return;
        this._walk(body, (n) => {
          if (n.type === "member_call_expression") {
            const memberName = n.child(2);
            if (memberName && memberName.type === "name" && ELOQUENT_RELATIONS.includes(memberName.text)) {
              const argsNode = n.child(3);
              if (!argsNode || argsNode.type !== "arguments") return;
              const relatedArg = this._findDeep(argsNode, ["name", "string"]);
              if (relatedArg) {
                imports.push({
                  type: "eloquent_relation",
                  name: relatedArg.text.replace(/['"]/g, "").replace(/::class$/, ""),
                  relation: nameNode.text,
                  relationType: memberName.text,
                  startPosition: n.startPosition,
                });
              }
            }
          }
        });
      }
    });
    return imports;
  }

  _findChildAt(node, types, index) {
    let found = 0;
    for (let i = 0; i < node.childCount; i++) {
      const c = node.child(i);
      if (types.includes(c.type)) {
        if (found === index) return c;
        found++;
      }
    }
    return null;
  }

  _findDeep(node, types, depth = 0) {
    if (depth > 4) return null;
    for (let i = 0; i < node.childCount; i++) {
      const c = node.child(i);
      if (types.includes(c.type)) return c;
      const r = this._findDeep(c, types, depth + 1);
      if (r) return r;
    }
    return null;
  }
}

function handlerArgName(argsNode) {
  const strs = [];
  for (let i = 0; i < argsNode.childCount; i++) {
    const c = argsNode.child(i);
    if (c.type === "string" || c.type === "string_expression") {
      strs.push(c.text.replace(/['"]/g, ""));
    }
    if (c.type === "argument") {
      const child = c.child(0);
      if (child && (child.type === "string" || child.type === "string_expression")) {
        strs.push(child.text.replace(/['"]/g, ""));
      }
    }
  }
  return strs.length > 1 ? strs[1] : (strs[0] || "Closure");
}

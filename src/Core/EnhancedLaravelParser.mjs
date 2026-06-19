import { readFileSync, existsSync, readdirSync, lstatSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { PhpParser } from "./PhpParser.mjs";

const BLADE_DIRECTIVES = [
  "if", "elseif", "else", "endif", "unless", "endunless",
  "isset", "endisset", "empty", "endempty", "switch", "case", "default", "endswitch",
  "for", "endfor", "foreach", "endforeach", "while", "endwhile", "break", "continue",
  "php", "endphp",
  "extends", "section", "endsection", "yield", "show", "parent",
  "include", "includeIf", "includeWhen", "includeUnless", "includeFirst",
  "each", "component", "endcomponent", "slot", "endslot", "props",
  "push", "endpush", "prepend", "endprepend", "stack",
  "verbatim", "endverbatim",
  "csrf", "method",
  "auth", "endauth", "guest", "endguest",
  "production", "endproduction", "env", "endenv",
  "dump", "dd",
  "error", "enderror", "errors", "enderror",
  "can", "endcan", "cannot", "endcannot", "canany", "endcanany",
  "lang", "endlang", "choice",
  "once", "endonce",
  "teleport", "endteleport",
  "aware",
  "selected", "checked", "disabled", "required",
  "class", "style",
  "js", "endjs",
  "capture", "endcapture",
];

const LIVEWIRE_DIRECTIVES = [
  "wire:model", "wire:model.live", "wire:model.debounce", "wire:model.lazy",
  "wire:click", "wire:submit", "wire:change", "wire:input", "wire:keydown",
  "wire:keyup", "wire:focus", "wire:blur", "wire:mouseenter", "wire:mouseleave",
  "wire:poll", "wire:poll.visible", "wire:poll.keep-alive",
  "wire:loading", "wire:loading.remove", "wire:loading.delay",
  "wire:target", "wire:ignore", "wire:id", "wire:key",
  "wire:ref", "wire:offline", "wire:dirty",
  "wire:init", "wire:stream",
];

const ARTISAN_METHODS = ["signature", "description", "handle"];
const DDD_MARKERS = ["Action", "Domain", "Repository", "Service", "DTO", "DataTransferObject", "Query", "Command", "Policy", "Observer", "Job", "Event", "Listener", "Notification", "Resource", "Cast", "Rule"];

export class EnhancedLaravelParser extends PhpParser {
  constructor() {
    super();
    this._appPath = null;
    this._routeFiles = [];
    this._bladeFiles = [];
    this._migrationFiles = [];
  }

  get fileExtensions() { return [...super.fileExtensions, ".blade.php"]; }

  canParse(filePath) {
    return super.canParse(filePath) || filePath.endsWith(".blade.php");
  }

  setProjectRoot(root) {
    this._appPath = root;
    if (existsSync(join(root, "routes"))) {
      for (const f of readdirSync(join(root, "routes"))) {
        if (f.endsWith(".php")) this._routeFiles.push(join("routes", f));
      }
    }
    if (existsSync(join(root, "resources", "views"))) {
      this._discoverBladeFiles(join(root, "resources", "views"));
    }
    if (existsSync(join(root, "database", "migrations"))) {
      this._discoverMigrations(join(root, "database", "migrations"));
    }
  }

  _discoverBladeFiles(dir, depth = 0) {
    if (depth > 20) return;
    let names; try { names = readdirSync(dir); } catch { return; }
    for (const name of names) {
      if (name === "node_modules" || name === "vendor" || name.startsWith(".")) continue;
      const full = join(dir, name);
      let st; try { st = lstatSync(full); } catch { continue; }
      if (st.isDirectory()) { this._discoverBladeFiles(full, depth + 1); }
      else if (name.endsWith(".blade.php")) {
        this._bladeFiles.push(full.replace(this._appPath + "/", ""));
      }
    }
  }

  _discoverMigrations(dir) {
    let names; try { names = readdirSync(dir); } catch { return; }
    for (const name of names) {
      if (name.endsWith(".php")) {
        this._migrationFiles.push(join("database", "migrations", name));
      }
    }
  }

  parseBlade(filePath, text) {
    const directives = [];
    const includes = [];
    const livewireBindings = [];
    const phpBlocks = [];

    const directiveRegex = /@(\w+)(?:\(([^)]*)\))?/g;
    let match;
    while ((match = directiveRegex.exec(text)) !== null) {
      const directive = match[1];
      const args = match[2] ? match[2].trim() : null;

      if (BLADE_DIRECTIVES.includes(directive)) {
        directives.push({ type: directive, args, position: match.index });

        if (["extends", "include", "includeIf", "includeWhen", "includeUnless", "includeFirst", "component"].includes(directive) && args) {
          const viewName = args.replace(/^['"]|['"]$/g, "").replace(/\./g, "/");
          includes.push({
            type: directive,
            view: viewName,
            position: match.index,
          });
        }
      }

      if (directive === "livewire" && args) {
        const parts = args.split(",").map(s => s.trim());
        livewireBindings.push({
          component: parts[0].replace(/^['"]|['"]$/g, ""),
          position: match.index,
        });
      }

      if (directive === "php" || directive === "endphp") {
        phpBlocks.push({ type: directive, position: match.index });
      }
    }

    const wireRegex = /(wire:\w+)(?:\.([\w.-]+))?\s*=\s*["']([^"']*)["']/g;
    while ((match = wireRegex.exec(text)) !== null) {
      livewireBindings.push({
        type: match[1],
        modifier: match[2] || null,
        target: match[3],
        position: match.index,
      });
    }

    return { filePath, directives, includes, livewireBindings, phpBlocks };
  }

  parseMigration(filePath, text) {
    const ast = this.parse(filePath, text);
    const tables = [];
    const columns = [];
    const walk = (n) => {
      if (n.type === "scoped_call_expression") {
        const cls = n.child(0);
        const method = n.child(2);
        if (cls && method && cls.type === "name" && method.type === "name") {
          const fullName = cls.text + "::" + method.text;
          if (["Schema::create", "Schema::table", "Schema::dropIfExists"].includes(fullName)) {
            const args = this._findChild(n, ["arguments"]);
            if (args) {
              const tableName = this._findDeep(args, ["string", "encapsed_string", "string_content"]);
              if (tableName) {
                tables.push({
                  name: tableName.text.replace(/['"]/g, ""),
                  action: method.text,
                  position: n.startPosition,
                });
              }
            }
          }
        }
      }

      if (n.type === "member_call_expression") {
        const method = n.child(2);
        if (method && method.type === "name") {
          const name = method.text;
          const columnMethods = ["string", "text", "integer", "bigInteger", "smallInteger", "tinyInteger", "boolean", "decimal", "float", "double", "date", "dateTime", "timestamp", "time", "year", "char", "mediumText", "longText", "binary", "json", "jsonb", "uuid", "ipAddress", "macAddress", "enum", "set", "morphs", "nullableMorphs", "uuidMorphs", "foreignId", "foreign", "id", "increments", "bigIncrements", "rememberToken", "timestamps", "softDeletes", "softDeletesTz"];
          if (columnMethods.includes(name)) {
            const args = this._findChild(n, ["arguments"]);
            if (args) {
              const colName = this._findDeep(args, ["string", "encapsed_string", "string_content"]);
              if (colName) {
                columns.push({
                  name: colName.text.replace(/['"]/g, ""),
                  type: name,
                  position: n.startPosition,
                });
              }
            }
          }
        }
      }
      for (let i = 0; i < n.childCount; i++) walk(n.child(i));
    };
    walk(ast.root);
    return { filePath, tables, columns, ast };
  }

  parseArtisan(filePath, text) {
    const ast = this.parse(filePath, text);
    const commands = [];
    const { root } = ast;

    this._walk(root, (node) => {
      if (node.type === "class_declaration") {
        const nameNode = this._findChild(node, ["name"]);
        if (!nameNode) return;
        const className = nameNode.text;

        const body = this._findChild(node, ["declaration_list"]);
        if (!body) return;

        let signature = null;
        let description = null;

        this._walk(body, (n) => {
          if (n.type === "property_declaration") {
            const propElement = this._findChild(n, ["property_element"]);
            if (!propElement) return;
            const varNode = this._findChild(propElement, ["variable_name"]);
            if (!varNode) return;
            const propName = varNode.child(1) ? varNode.child(1).text : varNode.text.replace("$", "");

            if (propName === "signature") {
              const val = this._findDeep(propElement, ["string_content"]);
              if (val) signature = val.text;
            }
            if (propName === "description") {
              const val = this._findDeep(propElement, ["string_content"]);
              if (val) description = val.text;
            }
          }
        });

        if (signature) {
          const parsed = this._parseSignature(signature);
          commands.push({
            className,
            signature,
            description,
            name: parsed.name,
            arguments: parsed.arguments,
            options: parsed.options,
            position: node.startPosition,
          });
        }
      }
    });

    return { filePath, commands, ast };
  }

  _parseSignature(sig) {
    const parts = sig.split(/\s+/).filter(Boolean);
    const name = parts[0] || "";
    const args = [];
    const options = [];
    for (const part of parts.slice(1)) {
      if (part.startsWith("{") && part.endsWith("}")) {
        const inner = part.slice(1, -1);
        if (inner.startsWith("--")) {
          const opt = inner.replace(/^--/, "").replace(/=.*/, "");
          options.push({ name: opt, hasValue: inner.includes("=") });
        } else {
          args.push({ name: inner.replace("?", ""), optional: inner.includes("?") });
        }
      } else if (part.startsWith("--")) {
        const opt = part.replace(/^--/, "").replace(/=.*/, "");
        options.push({ name: opt, hasValue: part.includes("=") });
      }
    }
    return { name, arguments: args, options };
  }

  detectDDD(filePath, exports) {
    const patterns = [];
    const dir = dirname(filePath);
    const dirSegments = dir.split("/");

    for (const marker of DDD_MARKERS) {
      const segment = dirSegments.find(s => s.toLowerCase().startsWith(marker.toLowerCase()));
      if (segment) {
        patterns.push({ type: "ddd_directory", pattern: marker, directory: segment });
      }
    }

    for (const exp of exports) {
      for (const marker of DDD_MARKERS) {
        if (exp.name.endsWith(marker) && exp.kind === "class") {
          patterns.push({
            type: "ddd_class",
            pattern: marker,
            className: exp.name,
            filePath,
          });
        }
      }
    }

    const actionRegex = /(\w+Action)$/;
    const repoRegex = /(\w+Repository)$/;
    const serviceRegex = /(\w+Service)$/;
    const dtoRegex = /(\w+DTO)$|(\w+Data)$/;

    for (const exp of exports) {
      if (actionRegex.test(exp.name) && exp.kind === "class") patterns.push({ type: "action", className: exp.name });
      if (repoRegex.test(exp.name) && exp.kind === "class") patterns.push({ type: "repository", className: exp.name });
      if (serviceRegex.test(exp.name) && exp.kind === "class") patterns.push({ type: "service", className: exp.name });
      if (dtoRegex.test(exp.name) && exp.kind === "class") patterns.push({ type: "dto", className: exp.name });
    }

    return patterns;
  }

  detectMiddleware(filePath, ast) {
    const middlewares = [];
    const { root } = ast;

    this._walk(root, (node) => {
      if (node.type === "scoped_call_expression") {
        const cls = node.child(0);
        const method = node.child(2);
        if (cls && method && cls.type === "name" && method.type === "name" && cls.text === "Route" && method.text === "middleware") {
          const args = this._findChild(node, ["arguments"]);
          if (args) {
            const mwName = this._findDeep(args, ["string", "encapsed_string"]);
            if (mwName) {
              middlewares.push({
                name: mwName.text.replace(/['"]/g, ""),
                type: "group",
                position: node.startPosition,
              });
            }
          }
        }
      }

      if (node.type === "function_call_expression" || node.type === "member_call_expression") {
        const func = this._findChild(node, ["name", "member_name"]);
        if (!func) return;

        if (func.text === "middleware" || func.text === "withoutMiddleware" || func.text === "prependMiddleware") {
          const args = this._findChild(node, ["arguments"]);
          if (!args) return;
          const mwName = this._findDeep(args, ["string", "encapsed_string", "name"]);
          if (mwName) {
            middlewares.push({
              name: mwName.text.replace(/['"]/g, ""),
              type: func.text,
              position: node.startPosition,
            });
          }
        }

        if (func.text === "Route::middleware" || func.text === "Route::group") {
          const args = this._findChild(node, ["arguments"]);
          if (!args) return;
          const mwName = this._findDeep(args, ["string", "encapsed_string"]);
          if (mwName) {
            middlewares.push({
              name: mwName.text.replace(/['"]/g, ""),
              type: "group",
              position: node.startPosition,
            });
          }
        }
      }
    });

    return middlewares;
  }

  traceMethodCalls(filePath, ast) {
    const calls = [];
    const { root } = ast;

    this._walk(root, (node) => {
      if (node.type === "function_call_expression") {
        const func = this._findChild(node, ["name", "qualified_name"]);
        if (!func) return;
        calls.push({
          type: "function_call",
          name: func.text,
          position: node.startPosition,
        });
      }

      if (node.type === "member_call_expression") {
        const obj = this._findChild(node, ["variable_name", "name"]);
        const method = node.child(2);
        if (obj && method && method.type === "name") {
          calls.push({
            type: "method_call",
            object: obj.text,
            method: method.text,
            position: node.startPosition,
          });
        }
      }

      if (node.type === "scoped_call_expression") {
        const cls = node.child(0);
        const method = node.child(2);
        if (cls && method && cls.type === "name" && method.type === "name") {
          calls.push({
            type: "static_call",
            class: cls.text,
            method: method.text,
            position: node.startPosition,
          });
        }
      }
    });

    return calls;
  }

  inferTypes(filePath, ast) {
    const types = [];
    const { root } = ast;

    this._walk(root, (node) => {
      if (node.type === "property_declaration") {
        const prop = this._findChild(node, ["property_element"]);
        if (!prop) return;
        const varNode = this._findChild(prop, ["variable_name", "name"]);
        const typeNode = this._findChild(node, ["type_declaration", "primitive_type", "named_type"]);
        if (varNode && typeNode) {
          types.push({
            type: "property",
            name: varNode.text,
            declaredType: typeNode.text,
            position: node.startPosition,
          });
        }
      }

      if (node.type === "method_declaration") {
        const nameNode = this._findChild(node, ["name"]);
        if (!nameNode) return;
        let returnTypeNode = null;
        for (let i = 0; i < node.childCount; i++) {
          const c = node.child(i);
          if (c.type === "primitive_type" || c.type === "named_type") {
            returnTypeNode = c;
            break;
          }
        }
        if (returnTypeNode) {
          types.push({
            type: "method_return",
            name: nameNode.text,
            returnType: returnTypeNode.text,
            position: node.startPosition,
          });
        }
        const params = this._findChild(node, ["formal_parameters"]);
        if (params) {
          for (let i = 0; i < params.childCount; i++) {
            const p = params.child(i);
            if (p.type === "simple_parameter") {
              const pType = this._findChild(p, ["type_declaration", "primitive_type", "named_type"]);
              const pName = this._findChild(p, ["variable_name"]);
              if (pType && pName) {
                types.push({
                  type: "parameter",
                  method: nameNode.text,
                  name: pName.text,
                  declaredType: pType.text,
                  position: p.startPosition,
                });
              }
            }
          }
        }
      }
    });

    return types;
  }
}

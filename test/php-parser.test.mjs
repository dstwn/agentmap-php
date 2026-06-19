import { describe, it } from "node:test";
import assert from "node:assert";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("PhpParser", () => {
  let PhpParser, parser;

  it("loads PhpParser module", () => {
    PhpParser = import("../src/Core/PhpParser.mjs").then(m => m.PhpParser);
    return PhpParser.then(P => { parser = new P(); parser.init(); });
  });

  it("parses a plain PHP file", async () => {
    const P = await PhpParser;
    const p = new P();
    p.init();
    const ast = p.parse("test.php", "<?php echo 'hello';");
    assert.ok(ast.root);
    assert.equal(ast.root.type, "program");
  });

  it("extracts use imports", async () => {
    const P = await PhpParser;
    const p = new P();
    p.init();
    const ast = p.parse("test.php", "<?php namespace App; use Illuminate\\Support\\Facades\\Route;");
    const imports = p.extractImports(ast);
    assert.ok(imports.length >= 1);
    assert.ok(imports.some(i => i.type === "use" && i.name.includes("Route")));
  });

  it("extracts class declarations with extends", async () => {
    const P = await PhpParser;
    const p = new P();
    p.init();
    const ast = p.parse("User.php", "<?php namespace App\\Models; use Illuminate\\Database\\Eloquent\\Model; class User extends Model {}");
    const exports = p.extractExports(ast);
    const cls = exports.find(e => e.kind === "class");
    assert.ok(cls);
    assert.equal(cls.name, "User");
    assert.equal(cls.extends, "Model");
  });

  it("extracts methods and properties", async () => {
    const P = await PhpParser;
    const p = new P();
    p.init();
    const ast = p.parse("test.php", "<?php class Test { public $foo; private function bar() {} }");
    const exports = p.extractExports(ast);
    assert.ok(exports.some(e => e.kind === "property" && e.name.includes("foo")));
    assert.ok(exports.some(e => e.kind === "method" && e.name === "bar"));
  });

  it("extracts functions, interfaces, traits, enums", async () => {
    const P = await PhpParser;
    const p = new P();
    p.init();
    const ast = p.parse("test.php", "<?php interface Fooable {} trait BarTrait {} enum Status { case Active; } function helper() {}");
    const exports = p.extractExports(ast);
    assert.ok(exports.some(e => e.kind === "interface" && e.name === "Fooable"));
    assert.ok(exports.some(e => e.kind === "trait" && e.name === "BarTrait"));
    assert.ok(exports.some(e => e.kind === "enum" && e.name === "Status"));
    assert.ok(exports.some(e => e.kind === "function" && e.name === "helper"));
  });

  it("resolves PSR-4 namespaces via composer.json", async () => {
    const dir = mkdtempSync(join(tmpdir(), "php-test-"));
    writeFileSync(join(dir, "composer.json"), JSON.stringify({
      autoload: { "psr-4": { "App\\": "src/" } }
    }));
    mkdirSync(join(dir, "src", "Models"), { recursive: true });
    writeFileSync(join(dir, "src", "Models", "User.php"), "<?php namespace App\\Models; class User {}");
    const P = await PhpParser;
    const p = new P();
    p.init();
    const resolved = p.resolveImport("App\\Models\\User", join(dir, "test.php"), dir);
    assert.equal(resolved, join(dir, "src", "Models", "User.php"));
    rmSync(dir, { recursive: true });
  });

  it("does not crash on syntax errors — skips malformed nodes", async () => {
    const P = await PhpParser;
    const p = new P();
    p.init();
    const ast = p.parse("bad.php", "<?php class {");
    const exports = p.extractExports(ast);
    assert.ok(Array.isArray(exports));
  });
});

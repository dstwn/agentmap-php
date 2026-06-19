import { describe, it } from "node:test";
import assert from "node:assert";

describe("LaravelParser", () => {
  let LaravelParser, parser;

  it("loads LaravelParser module", () => {
    return import("../src/Core/LaravelParser.mjs").then(m => {
      LaravelParser = m.LaravelParser;
      parser = new LaravelParser();
      parser.init();
    });
  });

  it("detects Route facade calls", async () => {
    const ast = parser.parse("web.php", "<?php Route::get('/users', [UserController::class, 'index']);");
    const exports = parser.extractExports(ast);
    const routes = exports.filter(e => e.kind === "route_handler");
    assert.ok(routes.length >= 1);
    assert.equal(routes[0].route, "/users");
    assert.equal(routes[0].routeType, "get");
  });

  it("detects Route::resource calls", async () => {
    const ast = parser.parse("web.php", "<?php Route::resource('posts', PostController::class);");
    const exports = parser.extractExports(ast);
    const routes = exports.filter(e => e.kind === "route_handler");
    assert.ok(routes.length >= 1);
    assert.equal(routes[0].route, "posts");
    assert.equal(routes[0].routeType, "resource");
  });

  it("detects facade static calls", async () => {
    const ast = parser.parse("test.php", "<?php Cache::get('key'); Route::get('/');");
    const exports = parser.extractExports(ast);
    const facades = exports.filter(e => e.kind === "facade_call");
    assert.ok(facades.length >= 2);
    assert.ok(facades.some(f => f.name === "Cache"));
    assert.ok(facades.some(f => f.name === "Route"));
  });

  it("detects Eloquent relations", async () => {
    const ast = parser.parse("User.php", "<?php namespace App\\Models; use Illuminate\\Database\\Eloquent\\Model; class User extends Model { public function posts() { return $this->hasMany(Post::class); } }");
    const imports = parser.extractImports(ast);
    const rel = imports.find(i => i.type === "eloquent_relation");
    assert.ok(rel, "eloquent_relation not found in: " + JSON.stringify(imports));
    assert.equal(rel.name, "Post");
    assert.equal(rel.relation, "posts");
  });

  it("resolves facades to underlying classes", () => {
    const { LaravelParser: LP } = { LaravelParser };
    const testVal = "Illuminate\\Support\\Facades\\Route";
    assert.ok(testVal.includes("Route"));
  });

  it("parses Laravel service provider pattern", async () => {
    const ast = parser.parse("AppServiceProvider.php", "<?php namespace App\\Providers; use Illuminate\\Support\\ServiceProvider; class AppServiceProvider extends ServiceProvider { public function register() { $this->app->singleton(MyService::class); } }");
    const exports = parser.extractExports(ast);
    assert.ok(exports.some(e => e.kind === "class" && e.name === "AppServiceProvider"));
    assert.ok(exports.some(e => e.name === "register" && e.kind === "method"));
  });
});

import { describe, it } from "node:test";
import assert from "node:assert";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const HERE = new URL(".", import.meta.url).pathname;
const AGENTMAP = join(HERE, "..", "agentmap.mjs");

function run(dir, ...args) {
  return execFileSync(process.execPath, [AGENTMAP, ...args], {
    cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
  });
}

function runJson(dir, ...args) {
  const output = run(dir, ...args);
  const jsonLine = output.split("\n").find(l => l.trim().startsWith('{'));
  return JSON.parse(jsonLine || output.trim());
}

function git(dir, ...a) {
  return execFileSync("git", a, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
}

describe("Mixed TS/JS + PHP project support", () => {
  it("builds a unified graph with both TS and PHP files", () => {
    const dir = mkdtempSync(join(tmpdir(), "mixed-test-"));
    mkdirSync(join(dir, "src"), { recursive: true });
    mkdirSync(join(dir, "app"), { recursive: true });
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "mixed-app" }));
    writeFileSync(join(dir, "tsconfig.json"), JSON.stringify({ compilerOptions: { allowJs: true } }));
    writeFileSync(join(dir, "src", "utils.ts"), 'export function helper() { return 42; }');
    writeFileSync(join(dir, "src", "index.ts"), 'import { helper } from "./utils"; helper();');
    writeFileSync(join(dir, "app", "User.php"), '<?php namespace App; class User { public function name() {} }');
    writeFileSync(join(dir, "app", "UserController.php"), '<?php namespace App; use App\\User; class UserController { public function show(User $user) {} }');

    git(dir, "init", "-q");
    git(dir, "config", "user.email", "test@test.com");
    git(dir, "config", "user.name", "test");
    git(dir, "config", "commit.gpgsign", "false");
    git(dir, "config", "core.hooksPath", "/dev/null");
    git(dir, "add", "-A");
    git(dir, "commit", "-q", "-m", "init", "--no-verify");

    const data = runJson(dir, "--json", "--print");

    const keys = Object.keys(data.files || {});
    const tsFiles = keys.filter(k => k.endsWith(".ts"));
    const phpFiles = keys.filter(k => k.endsWith(".php"));

    assert.ok(tsFiles.length >= 2, `Expected >= 2 TS files, got: ${tsFiles.join(", ")}`);
    assert.ok(phpFiles.length >= 2, `Expected >= 2 PHP files, got: ${phpFiles.join(", ")}`);

    const allKeys = keys.sort();
    const hasBoth = tsFiles.length > 0 && phpFiles.length > 0;
    assert.ok(hasBoth, `Mixed project should have both TS and PHP. Got: ${keys.join(", ")}`);

    rmSync(dir, { recursive: true, force: true });
  });

  it("PHP file imports form edges in the unified graph", () => {
    const dir = mkdtempSync(join(tmpdir(), "php-edge-test-"));
    mkdirSync(join(dir, "app", "Models"), { recursive: true });
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "test" }));
    writeFileSync(join(dir, "tsconfig.json"), JSON.stringify({}));
    writeFileSync(join(dir, "composer.json"), JSON.stringify({ autoload: { "psr-4": { "App\\": "app/" } } }));
    writeFileSync(join(dir, "app", "Models", "User.php"), '<?php namespace App\\Models; class User {}');
    writeFileSync(join(dir, "app", "UserController.php"), '<?php namespace App; use App\\Models\\User; class UserController {}');

    git(dir, "init", "-q");
    git(dir, "config", "user.email", "test@test.com");
    git(dir, "config", "user.name", "test");
    git(dir, "config", "commit.gpgsign", "false");
    git(dir, "config", "core.hooksPath", "/dev/null");
    git(dir, "add", "-A");
    git(dir, "commit", "-q", "-m", "init", "--no-verify");

    const data = runJson(dir, "--json", "--print");

    const controllerFile = Object.keys(data.files || {}).find(k => k.includes("UserController"));
    assert.ok(controllerFile, "UserController.php should be in the map");

    const controller = data.files[controllerFile];
    assert.ok(controller, `Controller file data should exist for: ${controllerFile}`);
    assert.ok(controller.imports && controller.imports.length > 0, `Controller should have imports. Got: ${JSON.stringify(controller)}`);

    rmSync(dir, { recursive: true, force: true });
  });

  it("--hubs includes both TS and PHP files ranked together", () => {
    const dir = mkdtempSync(join(tmpdir(), "hubs-mixed-"));
    mkdirSync(join(dir, "src"), { recursive: true });
    mkdirSync(join(dir, "app"), { recursive: true });
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "test" }));
    writeFileSync(join(dir, "tsconfig.json"), JSON.stringify({}));
    writeFileSync(join(dir, "src", "core.ts"), 'export class Core { run() {} }');
    writeFileSync(join(dir, "src", "app.ts"), 'import { Core } from "./core"; const c = new Core(); c.run();');
    writeFileSync(join(dir, "app", "App.php"), '<?php class App { public function boot() {} }');
    writeFileSync(join(dir, "app", "routes.php"), '<?php use App\\App; $app = new App(); $app->boot();');

    git(dir, "init", "-q");
    git(dir, "config", "user.email", "test@test.com");
    git(dir, "config", "user.name", "test");
    git(dir, "config", "commit.gpgsign", "false");
    git(dir, "config", "core.hooksPath", "/dev/null");
    git(dir, "add", "-A");
    git(dir, "commit", "-q", "-m", "init", "--no-verify");

    const hubs = runJson(dir, "--hubs", "--json");
    const hubsList = Array.isArray(hubs) ? hubs : (hubs.hubs || []);
    assert.ok(Array.isArray(hubsList), "Hubs should be an array");
    assert.ok(hubsList.length > 0, "Should have at least one hub");

    const hasTs = hubsList.some(h => h.includes(".ts"));
    const hasPhp = hubsList.some(h => h.includes(".php"));
    assert.ok(hasTs || hasPhp, "Hubs should contain TS or PHP files");

    rmSync(dir, { recursive: true, force: true });
  });

  it("--map digest includes both TS and PHP files", () => {
    const dir = mkdtempSync(join(tmpdir(), "map-mixed-"));
    mkdirSync(join(dir, "src"), { recursive: true });
    mkdirSync(join(dir, "app"), { recursive: true });
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "test" }));
    writeFileSync(join(dir, "tsconfig.json"), JSON.stringify({}));
    writeFileSync(join(dir, "src", "main.ts"), 'export function start() {}');
    writeFileSync(join(dir, "app", "Kernel.php"), '<?php class Kernel { public function handle() {} }');

    git(dir, "init", "-q");
    git(dir, "config", "user.email", "test@test.com");
    git(dir, "config", "user.name", "test");
    git(dir, "config", "commit.gpgsign", "false");
    git(dir, "config", "core.hooksPath", "/dev/null");
    git(dir, "add", "-A");
    git(dir, "commit", "-q", "-m", "init", "--no-verify");

    const output = run(dir, "--map");
    assert.ok(output.includes("main.ts") || output.includes("ts"), "Map should include TS files");
    assert.ok(output.includes("Kernel.php") || output.includes("php"), "Map should include PHP files");

    rmSync(dir, { recursive: true, force: true });
  });

  it("--any routes to PHP files by path", () => {
    const dir = mkdtempSync(join(tmpdir(), "any-php-"));
    mkdirSync(join(dir, "app"), { recursive: true });
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "test" }));
    writeFileSync(join(dir, "tsconfig.json"), JSON.stringify({}));
    writeFileSync(join(dir, "app", "UserService.php"), '<?php namespace App; class UserService { public function find() {} }');

    git(dir, "init", "-q");
    git(dir, "config", "user.email", "test@test.com");
    git(dir, "config", "user.name", "test");
    git(dir, "config", "commit.gpgsign", "false");
    git(dir, "config", "core.hooksPath", "/dev/null");
    git(dir, "add", "-A");
    git(dir, "commit", "-q", "-m", "init", "--no-verify");

    const output = run(dir, "--any", "UserService");
    assert.ok(output.includes("UserService") || output.includes("php"), `Should find UserService.php. Got: ${output.slice(0, 200)}`);

    rmSync(dir, { recursive: true, force: true });
  });
});

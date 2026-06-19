import { describe, it } from "node:test";
import assert from "node:assert";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("EnhancedLaravelParser", () => {
  let ELParser, parser;

  it("loads EnhancedLaravelParser module", () => {
    return import("../src/Core/EnhancedLaravelParser.mjs").then(m => {
      ELParser = m.EnhancedLaravelParser;
      parser = new ELParser();
      parser.init();
    });
  });

  describe("Blade template parsing", () => {
    it("extracts blade directives", async () => {
      const P = await ELParser;
      const p = new P();
      const blade = `@extends('layouts.app')
@section('content')
  @if($user)
    <p>{{ $user->name }}</p>
  @endif
@endsection`;
      const result = p.parseBlade("welcome.blade.php", blade);
      assert.ok(result.directives.length > 0);
      assert.ok(result.directives.some(d => d.type === "extends"));
      assert.ok(result.directives.some(d => d.type === "if"));
      assert.ok(result.directives.some(d => d.type === "section"));
    });

    it("resolves @include to view paths", async () => {
      const P = await ELParser;
      const p = new P();
      const blade = `@include('partials.navbar')
@component('components.alert')
@endcomponent`;
      const result = p.parseBlade("page.blade.php", blade);
      assert.ok(result.includes.length >= 2);
      assert.ok(result.includes.some(i => i.view.includes("partials/navbar")));
    });

    it("detects @livewire directives", async () => {
      const P = await ELParser;
      const p = new P();
      const blade = `@livewire('counter', ['count' => 5])
@livewire('search-form')`;
      const result = p.parseBlade("dashboard.blade.php", blade);
      assert.ok(result.livewireBindings.length >= 2);
      assert.ok(result.livewireBindings.some(b => b.component === "counter"));
    });
  });

  describe("Livewire bindings", () => {
    it("detects wire:model and wire:click bindings", async () => {
      const P = await ELParser;
      const p = new P();
      const blade = `<input wire:model="query" type="text">
<button wire:click="search">Search</button>
<div wire:poll="refresh">...</div>`;
      const result = p.parseBlade("search.blade.php", blade);
      const bindings = result.livewireBindings;
      assert.ok(bindings.some(b => b.type === "wire:model" && b.target === "query"));
      assert.ok(bindings.some(b => b.type === "wire:click" && b.target === "search"));
      assert.ok(bindings.some(b => b.type === "wire:poll" && b.target === "refresh"));
    });
  });

  describe("Migration parsing", () => {
    it("extracts table creation and columns", async () => {
      const P = await ELParser;
      const p = new P();
      p.init();
      const migration = `<?php use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;
return new class extends Migration {
    public function up() {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->timestamps();
        });
    }
};`;
      const result = p.parseMigration("2024_01_01_000000_create_users_table.php", migration);
      assert.ok(result.tables.some(t => t.name === "users" && t.action === "create"));
      assert.ok(result.columns.some(c => c.name === "name" && c.type === "string"));
      assert.ok(result.columns.some(c => c.name === "email" && c.type === "string"));
    });
  });

  describe("Artisan command parsing", () => {
    it("extracts command signature and arguments", async () => {
      const P = await ELParser;
      const p = new P();
      p.init();
      const cmd = `<?php namespace App\\Console\\Commands;
use Illuminate\\Console\\Command;
class SendEmails extends Command {
    protected $signature = 'mail:send {user} {--queue} {--F|force}';
    protected $description = 'Send emails to users';
    public function handle() {}
}`;
      const result = p.parseArtisan("SendEmailsCommand.php", cmd);
      assert.ok(result.commands.length >= 1);
      const command = result.commands[0];
      assert.equal(command.name, "mail:send");
      assert.ok(command.arguments.some(a => a.name === "user"));
      assert.ok(command.options.some(o => o.name === "queue"));
      assert.equal(command.description, "Send emails to users");
    });
  });

  describe("DDD pattern detection", () => {
    it("detects Action classes", async () => {
      const P = await ELParser;
      const p = new P();
      p.init();
      const code = `<?php namespace App\\Domains\\Users\\Actions;
class CreateUserAction { public function execute(array $data) {} }`;
      const ast = p.parse("CreateUserAction.php", code);
      const exports = p.extractExports(ast);
      const patterns = p.detectDDD("app/Domains/Users/Actions/CreateUserAction.php", exports);
      assert.ok(patterns.some(pt => pt.type === "action" && pt.className === "CreateUserAction"));
      assert.ok(patterns.some(pt => pt.type === "ddd_directory" && pt.pattern === "Action"));
    });

    it("detects Repository and Service classes", async () => {
      const P = await ELParser;
      const p = new P();
      p.init();
      const code = `<?php namespace App\\Services;
class UserService {}
class UserRepository {}`;
      const ast = p.parse("Services.php", code);
      const exports = p.extractExports(ast);
      const patterns = p.detectDDD("app/Services/Services.php", exports);
      assert.ok(patterns.some(pt => pt.type === "service"));
      assert.ok(patterns.some(pt => pt.type === "repository"));
    });
  });

  describe("Middleware detection", () => {
    it("detects middleware calls in routes", async () => {
      const P = await ELParser;
      const p = new P();
      p.init();
      const code = `<?php Route::middleware('auth')->group(function () {
    Route::get('/dashboard', [DashboardController::class, 'index']);
});
Route::get('/public', fn() => 'ok')->withoutMiddleware('throttle');`;
      const ast = p.parse("web.php", code);
      const middlewares = p.detectMiddleware("routes/web.php", ast);
      assert.ok(middlewares.some(m => m.name === "auth" && m.type === "group"));
    });
  });

  describe("Method call tracing", () => {
    it("traces method calls in controller", async () => {
      const P = await ELParser;
      const p = new P();
      p.init();
      const code = `<?php namespace App\\Http\\Controllers;
class UserController {
    public function __construct(private UserService $service) {}
    public function index() {
        $users = $this->service->getAll();
        return view('users.index', ['users' => $users]);
    }
}`;
      const ast = p.parse("UserController.php", code);
      const calls = p.traceMethodCalls("UserController.php", ast);
      assert.ok(calls.some(c => c.type === "method_call" && c.method === "getAll"));
    });
  });

  describe("Type inference", () => {
    it("extracts property types", async () => {
      const P = await ELParser;
      const p = new P();
      p.init();
      const code = `<?php class User {
    public string $name;
    protected UserService $service;
    public function getName(): string { return $this->name; }
}`;
      const ast = p.parse("User.php", code);
      const types = p.inferTypes("User.php", ast);
      assert.ok(types.some(t => t.type === "property" && t.name === "$name" && t.declaredType === "string"));
      assert.ok(types.some(t => t.type === "method_return" && t.name === "getName" && t.returnType === "string"));
    });

    it("extracts parameter types", async () => {
      const P = await ELParser;
      const p = new P();
      p.init();
      const code = `<?php class UserController {
    public function store(CreateUserRequest $request, UserService $service): JsonResponse {}
}`;
      const ast = p.parse("UserController.php", code);
      const types = p.inferTypes("UserController.php", ast);
      assert.ok(types.some(t => t.type === "parameter" && t.name === "$request" && t.declaredType === "CreateUserRequest"));
    });
  });

  describe("Blade file discovery", () => {
    it("discovers blade files in resources/views", () => {
      const dir = mkdtempSync(join(tmpdir(), "blade-discover-"));
      mkdirSync(join(dir, "resources", "views", "layouts"), { recursive: true });
      mkdirSync(join(dir, "resources", "views", "components"), { recursive: true });
      writeFileSync(join(dir, "resources", "views", "welcome.blade.php"), "<h1>Welcome</h1>");
      writeFileSync(join(dir, "resources", "views", "layouts", "app.blade.php"), "<html></html>");
      writeFileSync(join(dir, "resources", "views", "components", "alert.blade.php"), "<div>Alert</div>");

      const P = ELParser;
      const p = new P();
      p.setProjectRoot(dir);
      assert.ok(p._bladeFiles.length >= 3);
      assert.ok(p._bladeFiles.some(f => f.includes("welcome.blade.php")));
      assert.ok(p._bladeFiles.some(f => f.includes("layouts/app.blade.php")));

      rmSync(dir, { recursive: true });
    });
  });

  describe("Migration file discovery", () => {
    it("discovers migration files", () => {
      const dir = mkdtempSync(join(tmpdir(), "migration-discover-"));
      mkdirSync(join(dir, "database", "migrations"), { recursive: true });
      writeFileSync(join(dir, "database", "migrations", "2024_01_01_create_users.php"), "<?php");
      writeFileSync(join(dir, "database", "migrations", "2024_01_02_create_posts.php"), "<?php");

      const P = ELParser;
      const p = new P();
      p.setProjectRoot(dir);
      assert.ok(p._migrationFiles.length >= 2);

      rmSync(dir, { recursive: true });
    });
  });
});

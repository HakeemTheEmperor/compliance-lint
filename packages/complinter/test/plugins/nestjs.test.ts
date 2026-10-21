import { test } from "node:test";
import * as assert from "node:assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { lintText } from "complinter/plugin-api";
import { allRules } from "@complinter/rules-gdpr";
import { nestjsPlugin } from "@complinter/plugin-nestjs";
import { runCli } from "../../src/run";

/**
 * Overlap check between the NestJS plugin and the built-in GDPR rules. The
 * plugin must add coverage, not repeat what the built-ins already say, so each
 * scenario states which rule is expected to fire.
 */

const everything = [...allRules, ...nestjsPlugin.rules];
const ids = (code: string) => lintText(everything, code).map((v) => v.ruleId);

void test("pii-in-url and the built-in rules cover different concerns", async (t) => {
  await t.test(
    "a guarded export route with PII in the URL only trips the plugin",
    () => {
      assert.deepStrictEqual(
        ids(`
        @Controller()
        class C {
          @UseGuards(AuthGuard)
          @Get("export/:email")
          exportFor() {}
        }
      `),
        ["nestjs/pii-in-url"],
      );
    },
  );

  await t.test(
    "an unguarded export route is reported once by each, for different reasons",
    () => {
      assert.deepStrictEqual(
        ids(`
        @Controller()
        class C { @Get("export/:email") exportFor() {} }
      `).sort(),
        ["gdpr/unprotected-export-route", "nestjs/pii-in-url"],
      );
    },
  );

  await t.test("untyped bodies stay with the built-in rule", () => {
    assert.deepStrictEqual(
      ids(`
        @Controller()
        class C { @Put("users") update(@Body() dto: any) {} }
      `),
      ["gdpr/minimal-data-collected"],
    );
  });
});

void test("unserialized-sensitive-response complements pii-unhashed-storage", async (t) => {
  const entity = (decorators: string) => `
    class User { ${decorators} password: string; }
    @Controller()
    class C { @Get() one(): User { return null as never; } }
  `;

  await t.test(
    "a bare password is reported at the field and at the handler",
    () => {
      assert.deepStrictEqual(ids(entity("")).sort(), [
        "gdpr/pii-unhashed-storage",
        "nestjs/unserialized-sensitive-response",
      ]);
    },
  );

  await t.test(
    "a hashed password is fine to store but still must not be returned",
    () => {
      assert.deepStrictEqual(ids(entity("@Hash()")), [
        "nestjs/unserialized-sensitive-response",
      ]);
    },
  );

  await t.test("@Exclude() satisfies both rules", () => {
    assert.deepStrictEqual(ids(entity("@Exclude()")), []);
  });
});

void test("the plugin loads through the CLI like any other plugin", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "complint-nestjs-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  // Resolve "@complinter/plugin-nestjs" from the project the way npm would,
  // pointing at the plugin's source (the tests run through tsx).
  const pluginEntry = path
    .resolve(__dirname, "..", "..", "..", "plugin-nestjs", "src", "index.ts")
    .replace(/\\/g, "/");
  const installed = path.join(
    dir,
    "node_modules",
    "@complinter",
    "plugin-nestjs",
  );
  fs.mkdirSync(installed, { recursive: true });
  fs.writeFileSync(
    path.join(installed, "package.json"),
    JSON.stringify({ name: "@complinter/plugin-nestjs", version: "0.1.0" }),
  );
  fs.writeFileSync(
    path.join(installed, "index.js"),
    `module.exports = require(${JSON.stringify(pluginEntry)});`,
  );

  fs.mkdirSync(path.join(dir, "src"));
  fs.writeFileSync(
    path.join(dir, "src", "users.controller.ts"),
    [
      "class User { password: string; }",
      '@Controller("users")',
      "export class UsersController {",
      '  @Get(":email")',
      "  find(): User { return null as never; }",
      "}",
      "",
    ].join("\n"),
  );
  fs.writeFileSync(
    path.join(dir, "compliance.json"),
    JSON.stringify({ plugins: ["@complinter/plugin-nestjs"] }),
  );

  const log = console.log;
  const error = console.error;
  let out = "";
  console.log = (...a: unknown[]) => void (out += a.join(" ") + "\n");
  console.error = () => undefined;
  let code: number;
  try {
    code = await runCli(
      [path.join(dir, "src"), "--no-cache", "--format", "json"],
      dir,
    );
  } finally {
    console.log = log;
    console.error = error;
  }

  assert.strictEqual(code, 1);
  const parsed = JSON.parse(out) as {
    results: { messages: { ruleId: string; severity: string }[] }[];
  };
  const found = parsed.results.flatMap((r) => r.messages);
  assert.deepStrictEqual(found.map((m) => m.ruleId).sort(), [
    "gdpr/pii-unhashed-storage",
    "nestjs/pii-in-url",
    "nestjs/unserialized-sensitive-response",
  ]);
  assert.ok(found.every((m) => m.severity === "error"));
});

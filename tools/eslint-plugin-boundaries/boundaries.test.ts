import { test } from "node:test";
import * as assert from "node:assert";
import * as path from "node:path";
import { Linter } from "eslint";
import boundaries from "./index.mjs";

const repoRoot = path.resolve(__dirname, "..", "..");
const inPackage = (rel: string) => path.join(repoRoot, "packages", rel);

function lint(code: string, filename: string): string[] {
  const linter = new Linter({ configType: "flat" });
  const messages = linter.verify(
    code,
    [
      {
        files: ["**/*.ts"],
        plugins: { boundaries },
        languageOptions: { sourceType: "module" },
        rules: { "boundaries/package-boundaries": "error" },
      },
    ],
    { filename },
  );
  return messages.map((m) => m.messageId ?? m.message);
}

const file = inPackage("rules-gdpr/src/gdpr/example.ts");

void test("allows imports through a package's public entry point", () => {
  assert.deepStrictEqual(
    lint('import { Rule } from "@complinter/core";', file),
    [],
  );
  assert.deepStrictEqual(
    lint('import { defineRule } from "@complinter/lang-typescript";', file),
    [],
  );
});

void test("allows relative imports inside the same package", () => {
  assert.deepStrictEqual(lint('import { x } from "../utils";', file), []);
  assert.deepStrictEqual(lint('import { y } from "./other-rule";', file), []);
  assert.deepStrictEqual(
    lint(
      'import { z } from "../../src/gdpr/example";',
      inPackage("rules-gdpr/test/gdpr/example.test.ts"),
    ),
    [],
  );
});

void test("allows ordinary third-party and node imports", () => {
  assert.deepStrictEqual(
    lint(
      'import * as path from "node:path";\nimport { parse } from "@typescript-eslint/typescript-estree";',
      file,
    ),
    [],
  );
});

void test("rejects deep imports into another package", () => {
  for (const specifier of [
    "@complinter/core/dist/engine/runner",
    "@complinter/core/src/index",
    "@complinter/lang-typescript/dist/parse-file",
  ]) {
    assert.deepStrictEqual(
      lint(`import x from "${specifier}";`, file),
      ["deepImport"],
      specifier,
    );
  }
});

void test("rejects relative imports that cross a package boundary", () => {
  for (const specifier of [
    "../../../core/src/index",
    "../../../core/src/engine/runner",
    "../../../../packages/core/src/index",
  ]) {
    assert.deepStrictEqual(
      lint(`import x from "${specifier}";`, file),
      ["crossPackage"],
      specifier,
    );
  }
});

void test("checks every way of importing", () => {
  const deep = "@complinter/core/dist/x";
  const cross = "../../../core/src/x";
  assert.deepStrictEqual(lint(`export * from "${deep}";`, file), [
    "deepImport",
  ]);
  assert.deepStrictEqual(lint(`export { a } from "${cross}";`, file), [
    "crossPackage",
  ]);
  assert.deepStrictEqual(lint(`const m = await import("${deep}");`, file), [
    "deepImport",
  ]);
  assert.deepStrictEqual(lint(`const m = require("${cross}");`, file), [
    "crossPackage",
  ]);
  // Non-literal specifiers cannot be checked and are ignored
  assert.deepStrictEqual(lint("const m = await import(name);", file), []);
});

void test("applies to tests as well as source", () => {
  assert.deepStrictEqual(
    lint(
      'import { run } from "../../../complinter/src/run";',
      inPackage("rules-gdpr/test/example.test.ts"),
    ),
    ["crossPackage"],
  );
});

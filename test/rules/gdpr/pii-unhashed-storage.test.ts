import { test } from "node:test";
import * as assert from "node:assert";
import { EngineRunner } from "@/src/engine/runner";
import { parse } from "@typescript-eslint/typescript-estree";
import { piiUnhashedStorageRule } from "@/src/rules/gdpr/pii-unhashed-storage";

void test("Rule: gdpr/pii-unhashed-storage", async (t) => {
  const runner = new EngineRunner([piiUnhashedStorageRule]);

  await t.test("flags unhashed password field", () => {
    const code = `
      export class User {
        email!: string;
        password!: string; // Missing security decorator
      }
    `;
    const ast = parse(code, { loc: true });
    const violations = runner.run(ast);

    assert.strictEqual(violations.length, 1);
    assert.strictEqual(violations[0].ruleId, "gdpr/pii-unhashed-storage");
    assert.strictEqual(
      violations[0].message,
      "Sensitive field 'password' lacks a hashing or exclusion decorator. Violates GDPR Article 32.",
    );
  });

  await t.test("passes when password has a security decorator", () => {
    const code = `
      export class User {
        email!: string;
        
        @Hash()
        password!: string;
      }
    `;
    const ast = parse(code, { loc: true });
    const violations = runner.run(ast);

    assert.strictEqual(
      violations.length,
      0,
      "Should not flag protected fields",
    );
  });
});

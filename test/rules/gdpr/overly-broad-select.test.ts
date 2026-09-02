import { test } from "node:test";
import * as assert from "node:assert";
import { EngineRunner } from "@/src/engine/runner";
import { parse } from "@typescript-eslint/typescript-estree";
import { overlyBroadSelectRule } from "@/src/rules/gdpr/overly-broad-select";

void test("Rule: gdpr/overly-broad-select", async (t) => {
  const runner = new EngineRunner([overlyBroadSelectRule]);

  await t.test("flags find() calls without select options", () => {
    const code = `
      async function getUsers() {
        return await userRepository.find({ where: { active: true } });
      }
    `;
    const ast = parse(code, { loc: true });
    const violations = runner.run(ast);

    assert.strictEqual(violations.length, 1);
    assert.strictEqual(violations[0].ruleId, "gdpr/overly-broad-select");
  });

  await t.test("passes when find() includes explicit select property", () => {
    const code = `
      async function getUsers() {
        return await userRepository.find({ 
          where: { active: true },
          select: ["id", "email"] 
        });
      }
    `;
    const ast = parse(code, { loc: true });
    const violations = runner.run(ast);

    assert.strictEqual(violations.length, 0);
  });
});

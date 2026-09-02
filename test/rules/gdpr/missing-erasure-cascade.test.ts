import { test } from "node:test";
import * as assert from "node:assert";
import { EngineRunner } from "@/src/engine/runner";
import { parse } from "@typescript-eslint/typescript-estree";
import { missingErasureCascadeRule } from "@/src/rules/gdpr/missing-erasure-cascade";

test("Rule: gdpr/missing-erasure-cascade", async (t) => {
  const runner = new EngineRunner([missingErasureCascadeRule]);

  await t.test("flags relation missing onDelete CASCADE", () => {
    const code = `
      @Entity()
      export class UserLog {
        @ManyToOne(() => User)
        user!: User;
      }
    `;
    const ast = parse(code, { loc: true });
    const violations = runner.run(ast);

    assert.strictEqual(violations.length, 1);
    assert.strictEqual(violations[0].ruleId, "gdpr/missing-erasure-cascade");
  });

  await t.test(
    "passes when relation explicitly includes onDelete CASCADE",
    () => {
      const code = `
      @Entity()
      export class UserLog {
        @ManyToOne(() => User, { onDelete: 'CASCADE' })
        user!: User;
      }
    `;
      const ast = parse(code, { loc: true });
      const violations = runner.run(ast);

      assert.strictEqual(
        violations.length,
        0,
        "Should pass when cascade deletion is configured",
      );
    },
  );
});

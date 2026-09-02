import { test } from "node:test";
import * as assert from "node:assert";
import { EngineRunner } from "@/src/engine/runner";
import { parse } from "@typescript-eslint/typescript-estree";
import { dataRetentionMissingRule } from "@/src/rules/gdpr/data-retention-missing";

void test("Rule: gdpr/data-retention-missing", async (t) => {
  const runner = new EngineRunner([dataRetentionMissingRule]);

  await t.test("flags entity missing retention fields or policies", () => {
    const code = `
      @Entity()
      export class UserProfile {
        @Column()
        email!: string;
      }
    `;
    const ast = parse(code, { loc: true });
    const violations = runner.run(ast);

    assert.strictEqual(violations.length, 1);
    assert.strictEqual(violations[0].ruleId, "gdpr/data-retention-missing");
  });

  await t.test(
    "passes when entity includes a retention timestamp field",
    () => {
      const code = `
      @Entity()
      export class SessionLog {
        @Column()
        expiresAt!: Date;
      }
    `;
      const ast = parse(code, { loc: true });
      const violations = runner.run(ast);

      assert.strictEqual(
        violations.length,
        0,
        "Should pass when retention field is present",
      );
    },
  );

  await t.test("passes when entity uses a retention decorator", () => {
    const code = `
      @Entity()
      @RetentionPolicy({ days: 30 })
      export class AuditLog {
        @Column()
        action!: string;
      }
    `;
    const ast = parse(code, { loc: true });
    const violations = runner.run(ast);

    assert.strictEqual(
      violations.length,
      0,
      "Should pass when retention decorator is present",
    );
  });
});

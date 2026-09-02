import { test } from "node:test";
import * as assert from "node:assert";
import { EngineRunner } from "../../../src/engine/runner";
import { parse } from "@typescript-eslint/typescript-estree";
import { unencryptedPiiColumnRule } from "../../../src/rules/gdpr/unencrypted-pii-column";

test("Rule: gdpr/unencrypted-pii-column", async (t) => {
  const runner = new EngineRunner([unencryptedPiiColumnRule]);

  await t.test(
    "flags plain-text bank account fields inside a TypeORM entity",
    () => {
      const code = `
      @Entity()
      export class User {
        @Column()
        bank_account!: string;
      }
    `;
      const ast = parse(code, { loc: true });
      const violations = runner.run(ast);

      assert.strictEqual(violations.length, 1);
      assert.strictEqual(violations[0].ruleId, "gdpr/unencrypted-pii-column");
    },
  );

  await t.test(
    "ignores high-risk fields if they are in a normal DTO (not an entity)",
    () => {
      const code = `
      export class UpdateProfileDto {
        bankAccount!: string; // Should not flag because class lacks @Entity()
      }
    `;
      const ast = parse(code, { loc: true });
      const violations = runner.run(ast);

      assert.strictEqual(
        violations.length,
        0,
        "Should not flag non-entity classes",
      );
    },
  );

  await t.test(
    "passes when using TypeORM transformers inside an entity",
    () => {
      const code = `
      @Entity()
      export class User {
        @Column({ transformer: new EncryptionTransformer() })
        bvn!: string;
      }
    `;
      const ast = parse(code, { loc: true });
      const violations = runner.run(ast);

      assert.strictEqual(violations.length, 0);
    },
  );
});

import { test } from "node:test";
import * as assert from "node:assert";
import { EngineRunner } from "@/src/engine/runner";
import { parse } from "@typescript-eslint/typescript-estree";
import { explicitPiiLoggingRule } from "@/src/rules/gdpr/explicit-pii-logging";

void test("Rule: gdpr/explicit-pii-logging", async (t) => {
  const runner = new EngineRunner([explicitPiiLoggingRule]);

  await t.test(
    "flags logging of raw request body or sensitive user objects",
    () => {
      const code = `
      function createUser(req, res) {
        console.log("Incoming request:", req.body);
        logger.info(user);
      }
    `;
      const ast = parse(code, { loc: true });
      const violations = runner.run(ast);

      assert.strictEqual(violations.length, 2);
      assert.strictEqual(violations[0].ruleId, "gdpr/explicit-pii-logging");
      assert.strictEqual(violations[1].ruleId, "gdpr/explicit-pii-logging");
    },
  );

  await t.test(
    "passes when logging safe strings or non-PII identifiers",
    () => {
      const code = `
      function createUser() {
        logger.info("User created successfully");
        console.log("Operation ID:", operationId);
      }
    `;
      const ast = parse(code, { loc: true });
      const violations = runner.run(ast);

      assert.strictEqual(violations.length, 0);
    },
  );
});

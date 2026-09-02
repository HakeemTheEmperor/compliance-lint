import { test } from "node:test";
import * as assert from "node:assert";
import { EngineRunner } from "@/src/engine/runner";
import { parse } from "@typescript-eslint/typescript-estree";
import { thirdPartyPiiLeakRule } from "@/src/rules/gdpr/third-party-pii-leak";

void test("Rule: gdpr/third-party-pii-leak", async (t) => {
  const runner = new EngineRunner([thirdPartyPiiLeakRule]);

  await t.test(
    "flags outbound http requests transmitting raw body or user payloads",
    () => {
      const code = `
      async function syncData(req) {
        await axios.post("https://api.external-vendor.com/v1", req.body);
        await fetch("https://webhook.site", payload);
      }
    `;
      const ast = parse(code, { loc: true });
      const violations = runner.run(ast);

      assert.strictEqual(violations.length, 2);
      assert.strictEqual(violations[0].ruleId, "gdpr/third-party-pii-leak");
      assert.strictEqual(violations[1].ruleId, "gdpr/third-party-pii-leak");
    },
  );

  await t.test("passes when transmitting sanitized or non-PII payloads", () => {
    const code = `
      async function syncData() {
        await axios.post("https://api.external-vendor.com/v1", { status: "active" });
        await fetch("https://metrics.io", sanitizedToken);
      }
    `;
    const ast = parse(code, { loc: true });
    const violations = runner.run(ast);

    assert.strictEqual(violations.length, 0);
  });
});

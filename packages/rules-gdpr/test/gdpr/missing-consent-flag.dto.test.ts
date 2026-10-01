import { test } from "node:test";
import * as assert from "node:assert";
import { parse } from "@typescript-eslint/typescript-estree";
import { EngineRunner } from "@complinter/core";
import { missingConsentFlagRule } from "../../src/gdpr/missing-consent-flag";

void test("gdpr/missing-consent-flag inspects local DTO properties", async (t) => {
  const runner = new EngineRunner([missingConsentFlagRule]);

  await t.test("passes when the DTO class declares a consent property", () => {
    const code = `
      class SignUpDto { email!: string; consent!: boolean; }
      class AuthController {
        @Post() register(@Body() dto: SignUpDto) {}
      }
    `;
    assert.strictEqual(runner.run(parse(code, { loc: true })).length, 0);
  });

  await t.test("flags when the DTO class has no consent property", () => {
    const code = `
      class SignUpDto { email!: string; }
      class AuthController {
        @Post() register(@Body() dto: SignUpDto) {}
      }
    `;
    assert.strictEqual(runner.run(parse(code, { loc: true })).length, 1);
  });
});

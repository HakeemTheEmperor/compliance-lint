import { test } from "node:test";
import * as assert from "node:assert";
import { EngineRunner } from "@/src/engine/runner";
import { parse } from "@typescript-eslint/typescript-estree";
import { minimalDataCollectedRule } from "@/src/rules/gdpr/minimal-data-collected";

void test("Rule: gdpr/minimal-data-collected", async (t) => {
  const runner = new EngineRunner([minimalDataCollectedRule]);

  await t.test("flags endpoints accepting @Body() with any type", () => {
    const code = `
      @Controller("users")
      export class UserController {
        @Post()
        createUser(@Body() payload: any) {
          return payload;
        }
      }
    `;
    const ast = parse(code, { loc: true });
    const violations = runner.run(ast);

    assert.strictEqual(violations.length, 1);
    assert.strictEqual(violations[0].ruleId, "gdpr/minimal-data-collected");
  });

  await t.test("passes when endpoint uses a structured DTO", () => {
    const code = `
      @Controller("users")
      export class UserController {
        @Post()
        createUser(@Body() dto: CreateUserDto) {
          return dto;
        }
      }
    `;
    const ast = parse(code, { loc: true });
    const violations = runner.run(ast);

    assert.strictEqual(violations.length, 0, "Should pass with explicit DTO");
  });
});

import { test } from "node:test";
import * as assert from "node:assert";
import { EngineRunner } from "@/src/engine/runner";
import { parse } from "@typescript-eslint/typescript-estree";
import { missingConsentFlagRule } from "@/src/rules/gdpr/missing-consent-flag";

void test("Rule: gdpr/missing-consent-flag", async (t) => {
  const runner = new EngineRunner([missingConsentFlagRule]);

  await t.test(
    "flags registration methods lacking consent DTO properties",
    () => {
      const code = `
      export class CreateUserDto {
        email: string;
        password: string;
      }

      @Controller("auth")
      export class AuthController {
        @Post("register")
        registerUser(@Body() dto: CreateUserDto) {
          return this.authService.register(dto);
        }
      }
    `;
      const ast = parse(code, { loc: true });
      const violations = runner.run(ast);

      assert.strictEqual(violations.length, 1);
      assert.strictEqual(violations[0].ruleId, "gdpr/missing-consent-flag");
    },
  );

  await t.test(
    "passes when registration method uses a DTO containing a consent property",
    () => {
      const code = `
      export class CreateUserWithConsentDto {
        email: string;
        password: string;
        isAgreed: boolean;
      }

      @Controller("auth")
      export class AuthController {
        @Post("register")
        registerUser(@Body() dto: CreateUserWithConsentDto) {
          return this.authService.register(dto);
        }
      }
    `;
      const ast = parse(code, { loc: true });
      const violations = runner.run(ast);

      assert.strictEqual(violations.length, 0);
    },
  );
});

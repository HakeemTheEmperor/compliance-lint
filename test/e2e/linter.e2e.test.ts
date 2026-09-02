import { test } from "node:test";
import * as assert from "node:assert";
import * as fs from "node:fs";
import { parse } from "@typescript-eslint/typescript-estree";
import { EngineRunner } from "@/src/engine/runner";
import { allRules } from "@/src/rules";
import { LinterCache } from "@/src/engine/cache";

void test("Phase 5 E2E: Compliance Fixtures Verification", async (t) => {
  const runner = new EngineRunner(allRules);
  const cache = new LinterCache(".test-e2e-cache.json");

  // Cleanup cache helper
  t.after(() => {
    if (fs.existsSync(".test-e2e-cache.json"))
      fs.unlinkSync(".test-e2e-cache.json");
  });

  await t.test("Compliant fixture passes with 0 violations", () => {
    const code = `
      @Controller("auth")
      export class CompliantController {
        @UseGuards(JwtAuthGuard)
        @Post("register")
        registerUser(@Body() dto: CreateUserWithConsentDto) {
          logger.info("Registration initiated securely");
          return this.authService.register(dto);
        }

        @UseGuards(JwtAuthGuard)
        @Get("export-data")
        exportData() {
          return this.userService.find({ select: ["id", "email"] });
        }
      }
    `;
    const ast = parse(code, { loc: true, jsx: true });
    const violations = runner.run(ast);

    assert.strictEqual(violations.length, 0);
  });

  await t.test(
    "Non-compliant fixture triggers multiple GDPR violations",
    () => {
      const code = `
      export class BadController {
        @Post("register")
        registerUser(@Body() reqBody: any) {
          console.log("Bad body log:", req.body);
          axios.post("https://external.com", req.body);
          return this.userRepo.find();
        }

        @Get("export-data")
        exportData() {
          return this.exportService.dump();
        }
      }
    `;
      const ast = parse(code, { loc: true, jsx: true });
      const violations = runner.run(ast);

      // Expect violations across minimal data, broad select, pii logging, consent, export auth, and third-party leaks
      assert.ok(violations.length >= 5);

      const ruleIds = violations.map((v) => v.ruleId);
      assert.ok(ruleIds.includes("gdpr/minimal-data-collected"));
      assert.ok(ruleIds.includes("gdpr/overly-broad-select"));
      assert.ok(ruleIds.includes("gdpr/explicit-pii-logging"));
      assert.ok(ruleIds.includes("gdpr/missing-consent-flag"));
      assert.ok(ruleIds.includes("gdpr/unprotected-export-route"));
      assert.ok(ruleIds.includes("gdpr/third-party-pii-leak"));
    },
  );
});

import { test } from "node:test";
import * as assert from "node:assert";
import { EngineRunner } from "@/src/engine/runner";
import { parse } from "@typescript-eslint/typescript-estree";
import { unprotectedExportRouteRule } from "@/src/rules/gdpr/unprotected-export-route";

void test("Rule: gdpr/unprotected-export-route", async (t) => {
  const runner = new EngineRunner([unprotectedExportRouteRule]);

  await t.test("flags export endpoints without security guards", () => {
    const code = `
      @Controller("users")
      export class UserController {
        @Get("export-data")
        exportData() {
          return this.userService.dumpAllData();
        }
      }
    `;
    const ast = parse(code, { loc: true });
    const violations = runner.run(ast);

    assert.strictEqual(violations.length, 1);
    assert.strictEqual(violations[0].ruleId, "gdpr/unprotected-export-route");
  });

  await t.test("passes when export endpoint has authentication guards", () => {
    const code = `
      @Controller("users")
      export class UserController {
        @UseGuards(JwtAuthGuard)
        @Get("download-backup")
        downloadBackup() {
          return this.userService.generateBackup();
        }
      }
    `;
    const ast = parse(code, { loc: true });
    const violations = runner.run(ast);

    assert.strictEqual(violations.length, 0);
  });
});

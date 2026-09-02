import { test } from "node:test";
import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import { LinterCache } from "@/src/engine/cache";
import { reportToConsole, FileReport } from "@/src/reporters/console";

void test("Phase 4 DX Components: Cache and Reporter", async (t) => {
  const tempCachePath = path.join(process.cwd(), ".test-gdpr-cache.json");

  // Cleanup helper
  const cleanup = () => {
    if (fs.existsSync(tempCachePath)) fs.unlinkSync(tempCachePath);
  };

  t.beforeEach(cleanup);
  t.after(cleanup);

  await t.test(
    "LinterCache stores, retrieves, and invalidates cache based on content",
    () => {
      const cache = new LinterCache(tempCachePath);
      const testFile = "src/controllers/user.controller.ts";
      const initialContent = "const x = 1;";
      const mockViolations = [
        {
          ruleId: "gdpr/minimal-data-collected",
          message: "Test violation",
          line: 1,
          column: 1,
        },
      ];

      // 1. Initially cache should miss
      assert.strictEqual(
        cache.getCachedViolations(testFile, initialContent),
        null,
      );

      // 2. Set cache and retrieve
      cache.setCachedViolations(testFile, initialContent, mockViolations);
      const cached = cache.getCachedViolations(testFile, initialContent);
      assert.deepStrictEqual(cached, mockViolations);

      // 3. Changing content should result in a cache miss (invalidation)
      const modifiedContent = "const x = 2;";
      assert.strictEqual(
        cache.getCachedViolations(testFile, modifiedContent),
        null,
      );
    },
  );

  await t.test(
    "reportToConsole calculates totals and respects severity rules",
    () => {
      const reports: FileReport[] = [
        {
          filePath: "src/services/auth.service.ts",
          violations: [
            {
              ruleId: "gdpr/explicit-pii-logging",
              message: "Log error",
              line: 10,
              column: 5,
            },
            {
              ruleId: "gdpr/missing-consent-flag",
              message: "Warning issue",
              line: 20,
              column: 2,
            },
          ],
        },
      ];

      // Mock console.log to suppress terminal spam during test
      const originalLog = console.log;
      let loggedOutput = "";
      console.log = (msg: string) => {
        loggedOutput += msg + "\n";
      };

      try {
        // Test with custom config turning missing-consent-flag to "warn" and explicit-pii-logging to "error"
        const hasErrors = reportToConsole(reports, {
          ignore: [],
          rules: {
            "gdpr/explicit-pii-logging": "error",
            "gdpr/missing-consent-flag": "warn",
          },
        });

        // Since there is 1 error, it should return true (hasErrors = true)
        assert.strictEqual(hasErrors, true);
        assert.ok(loggedOutput.includes("1 errors, 1 warnings"));
      } finally {
        console.log = originalLog;
      }
    },
  );
});

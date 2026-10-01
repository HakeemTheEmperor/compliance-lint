import { test } from "node:test";
import * as assert from "node:assert";
import { validatePlugin } from "@complinter/core";
import { allRules, defaultSeverities, gdprPlugin } from "../src";

void test("the GDPR rules are packaged as a valid plugin", () => {
  assert.doesNotThrow(() => validatePlugin(gdprPlugin, gdprPlugin.name));
  assert.strictEqual(gdprPlugin.namespace, "gdpr");
  assert.strictEqual(gdprPlugin.rules, allRules);
});

void test("every rule has a default severity, and nothing else does", () => {
  assert.deepStrictEqual(
    Object.keys(defaultSeverities).sort(),
    allRules.map((r) => r.id).sort(),
  );
});

void test("default severities are unchanged from before the plugin refactor", () => {
  const warnings = Object.entries(defaultSeverities)
    .filter(([, severity]) => severity === "warn")
    .map(([id]) => id)
    .sort();
  assert.deepStrictEqual(warnings, [
    "gdpr/data-retention-missing",
    "gdpr/overly-broad-select",
  ]);
  assert.ok(
    Object.values(defaultSeverities).every(
      (severity) => severity === "error" || severity === "warn",
    ),
  );
});

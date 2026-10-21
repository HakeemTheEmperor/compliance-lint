import { test } from "node:test";
import * as assert from "node:assert";
import { lintText } from "complinter/plugin-api";
import nestjsPlugin, {
  nestjsPlugin as namedExport,
  piiInUrlRule,
  unserializedSensitiveResponseRule,
} from "../src";

void test("the plugin describes itself correctly", () => {
  assert.strictEqual(nestjsPlugin, namedExport);
  assert.strictEqual(nestjsPlugin.name, "@complinter/plugin-nestjs");
  assert.strictEqual(nestjsPlugin.namespace, "nestjs");
  assert.strictEqual(nestjsPlugin.apiVersion, 1);
  assert.deepStrictEqual(nestjsPlugin.rules, [
    piiInUrlRule,
    unserializedSensitiveResponseRule,
  ]);
});

void test("every rule is namespaced, documented and has a default severity", () => {
  for (const rule of nestjsPlugin.rules) {
    assert.match(rule.id, /^nestjs\/[a-z-]+$/);
    assert.ok(rule.description.length > 20, rule.id);
    assert.strictEqual(rule.language, "typescript", rule.id);
    assert.ok(nestjsPlugin.defaultSeverities?.[rule.id], `${rule.id} severity`);
  }
  assert.deepStrictEqual(
    Object.keys(nestjsPlugin.defaultSeverities ?? {}).sort(),
    nestjsPlugin.rules.map((r) => r.id).sort(),
  );
});

void test("both rules run together through the engine", () => {
  const found = lintText(
    nestjsPlugin,
    `
      class User { password: string; }
      @Controller("users")
      class UsersController {
        @Get(":email")
        find(): User { return null as never; }
      }
    `,
  );
  assert.deepStrictEqual(found.map((v) => v.ruleId).sort(), [
    "nestjs/pii-in-url",
    "nestjs/unserialized-sensitive-response",
  ]);
});

void test("severities can be overridden per rule", () => {
  const found = lintText(
    nestjsPlugin,
    '@Controller() class C { @Get(":email") run() {} }',
    { severities: { "nestjs/pii-in-url": "warn" } },
  );
  assert.strictEqual(found[0].severity, "warn");

  const off = lintText(
    nestjsPlugin,
    '@Controller() class C { @Get(":email") run() {} }',
    { severities: { "nestjs/pii-in-url": "off" } },
  );
  assert.deepStrictEqual(off, []);
});

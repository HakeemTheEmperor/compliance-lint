import { test } from "node:test";
import * as assert from "node:assert";
import { validatePlugin } from "../../src/plugin/validate";
import { PLUGIN_API_VERSION, PluginError } from "../../src/plugin/types";

function valid(overrides: Record<string, unknown> = {}) {
  return {
    name: "acme-plugin",
    apiVersion: PLUGIN_API_VERSION,
    namespace: "acme",
    rules: [
      {
        id: "acme/no-eval",
        description: "flags eval",
        create: () => ({}),
      },
    ],
    ...overrides,
  };
}

function rejects(candidate: unknown, pattern: RegExp) {
  assert.throws(
    () => validatePlugin(candidate, "acme-plugin"),
    (err: unknown) => err instanceof PluginError && pattern.test(err.message),
  );
}

void test("validatePlugin accepts a well-formed plugin", () => {
  const plugin = validatePlugin(valid(), "acme-plugin");
  assert.strictEqual(plugin.name, "acme-plugin");
  assert.strictEqual(plugin.rules.length, 1);
});

void test("validatePlugin accepts optional adapters and default severities", () => {
  const plugin = validatePlugin(
    valid({
      adapters: [
        {
          id: "toy",
          extensions: [".toy"],
          parse: () => ({ tree: [], comments: [] }),
          walk: () => undefined,
        },
      ],
      defaultSeverities: { "acme/no-eval": "warn" },
    }),
    "acme-plugin",
  );
  assert.strictEqual(plugin.adapters?.length, 1);
});

void test("validatePlugin rejects non-objects", () => {
  rejects(null, /must export a plugin object/);
  rejects("plugin", /must export a plugin object/);
  rejects([], /must export a plugin object/);
});

void test("validatePlugin checks name, api version and namespace", () => {
  rejects(valid({ name: "" }), /"name"/);
  rejects(valid({ apiVersion: 999 }), /plugin API version 999/);
  rejects(valid({ apiVersion: undefined }), /plugin API version undefined/);
  rejects(valid({ namespace: "Acme" }), /"namespace"/);
  rejects(valid({ namespace: "1acme" }), /"namespace"/);
});

void test("validatePlugin checks every rule", () => {
  rejects(valid({ rules: "nope" }), /"rules" must be an array/);
  rejects(valid({ rules: [null] }), /rules\[0\] must be an object/);
  rejects(valid({ rules: [{}] }), /needs a string "id"/);
  rejects(
    valid({
      rules: [{ id: "other/no-eval", description: "d", create: () => ({}) }],
    }),
    /only define rules in its own namespace/,
  );
  rejects(
    valid({
      rules: [{ id: "acme/a/b", description: "d", create: () => ({}) }],
    }),
    /"acme\/rule-name"/,
  );
  rejects(
    valid({ rules: [{ id: "acme/ok", create: () => ({}) }] }),
    /"description"/,
  );
  rejects(
    valid({ rules: [{ id: "acme/ok", description: "d" }] }),
    /"create" function/,
  );
  rejects(
    valid({
      rules: [
        { id: "acme/dup", description: "d", create: () => ({}) },
        { id: "acme/dup", description: "d", create: () => ({}) },
      ],
    }),
    /defined twice/,
  );
});

void test("validatePlugin checks adapters and default severities", () => {
  rejects(valid({ adapters: [{ id: "x" }] }), /adapters\[0\]/);
  rejects(valid({ adapters: "x" }), /"adapters" must be an array/);
  rejects(
    valid({ defaultSeverities: { "acme/missing": "warn" } }),
    /not one of its rules/,
  );
  rejects(
    valid({ defaultSeverities: { "acme/no-eval": "loud" } }),
    /must be "error", "warn" or "off"/,
  );
});

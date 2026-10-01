import { test } from "node:test";
import * as assert from "node:assert";
import {
  FingerprintInput,
  createCacheFingerprint,
} from "../../src/plugin/fingerprint";
import { LoadedPlugin, PLUGIN_API_VERSION } from "../../src/plugin/types";

function plugin(
  spec: string,
  version = "1.0.0",
  contentHash?: string,
): LoadedPlugin {
  return {
    spec,
    version,
    contentHash,
    plugin: {
      name: spec,
      apiVersion: PLUGIN_API_VERSION,
      namespace: "x",
      rules: [],
    },
  };
}

const base: FingerprintInput = {
  version: "1.0.0",
  adapters: ["typescript"],
  plugins: [plugin("builtin")],
  ruleIds: ["gdpr/a", "gdpr/b"],
  severities: { "gdpr/a": "error", "gdpr/b": "warn" },
};

void test("fingerprint is stable and order-independent", () => {
  const same = createCacheFingerprint({
    ...base,
    ruleIds: ["gdpr/b", "gdpr/a"],
    severities: { "gdpr/b": "warn", "gdpr/a": "error" },
  });
  assert.strictEqual(same, createCacheFingerprint(base));
  assert.match(same, /^[0-9a-f]{64}$/);
});

void test("fingerprint changes when anything that affects results changes", () => {
  const original = createCacheFingerprint(base);
  const changed: Partial<FingerprintInput>[] = [
    { version: "1.0.1" },
    { adapters: ["typescript", "python"] },
    { ruleIds: [...base.ruleIds, "acme/c"] },
    { severities: { ...base.severities, "gdpr/a": "off" } },
    { plugins: [...base.plugins, plugin("./local.js", "unknown", "aaa")] },
  ];
  for (const change of changed) {
    assert.notStrictEqual(
      createCacheFingerprint({ ...base, ...change }),
      original,
      JSON.stringify(change),
    );
  }
});

void test("fingerprint tracks plugin version and local plugin content", () => {
  const withPlugin = (p: LoadedPlugin) =>
    createCacheFingerprint({ ...base, plugins: [...base.plugins, p] });

  assert.notStrictEqual(
    withPlugin(plugin("acme", "1.0.0")),
    withPlugin(plugin("acme", "1.1.0")),
  );
  assert.notStrictEqual(
    withPlugin(plugin("./p.js", "unknown", "hash-1")),
    withPlugin(plugin("./p.js", "unknown", "hash-2")),
  );
});

import { test } from "node:test";
import * as assert from "node:assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  assemblePlugins,
  classifyPluginSpec,
  loadPlugins,
} from "../../src/plugin/loader";
import {
  LoadedPlugin,
  PLUGIN_API_VERSION,
  Plugin,
  PluginError,
} from "../../src/plugin/types";

const rule = (id: string) => ({
  id,
  description: id,
  create: () => ({}),
});

const pluginSource = (namespace: string, extra = "") => `{
  name: "${namespace}-plugin",
  apiVersion: ${PLUGIN_API_VERSION},
  namespace: "${namespace}",
  rules: [{ id: "${namespace}/rule", description: "d", create() { return {}; } }],
  ${extra}
}`;

function project(): { dir: string; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "complint-plugins-"));
  return {
    dir,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

void test("classifyPluginSpec accepts package names and ./ paths only", () => {
  assert.deepStrictEqual(classifyPluginSpec("complinter-plugin-x"), {
    kind: "package",
    name: "complinter-plugin-x",
  });
  assert.deepStrictEqual(classifyPluginSpec("@scope/plugin"), {
    kind: "package",
    name: "@scope/plugin",
  });
  assert.deepStrictEqual(classifyPluginSpec("./tools/rules.js"), {
    kind: "local",
    relativePath: "./tools/rules.js",
  });
  // Windows-style separators are normalised
  assert.deepStrictEqual(classifyPluginSpec(".\\tools\\rules.js"), {
    kind: "local",
    relativePath: "./tools/rules.js",
  });

  for (const bad of [
    "",
    "  ",
    "../outside.js",
    "./a/../../outside.js",
    "/abs/path.js",
    "C:\\abs\\path.js",
    "file:///etc/x.js",
    "https://example.com/p.js",
    "pkg/subpath",
    "UpperCase",
    "has space",
  ]) {
    assert.throws(
      () => classifyPluginSpec(bad),
      PluginError,
      `should reject ${JSON.stringify(bad)}`,
    );
  }
});

void test("loadPlugins loads CJS, ESM and package plugins", async () => {
  const { dir, cleanup } = project();
  try {
    fs.mkdirSync(path.join(dir, "tools"));
    fs.writeFileSync(
      path.join(dir, "tools", "cjs.js"),
      `module.exports = ${pluginSource("cjs")};`,
    );
    fs.writeFileSync(
      path.join(dir, "tools", "esm.mjs"),
      `export default ${pluginSource("esm")};`,
    );
    // Transpiled-ESM shape: exports.default on a CJS module
    fs.writeFileSync(
      path.join(dir, "tools", "interop.js"),
      `Object.defineProperty(exports, "__esModule", { value: true });\nexports.default = ${pluginSource("interop")};`,
    );
    const pkgDir = path.join(dir, "node_modules", "complinter-plugin-demo");
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(
      path.join(pkgDir, "package.json"),
      JSON.stringify({
        name: "complinter-plugin-demo",
        version: "2.3.4",
        main: "index.js",
      }),
    );
    fs.writeFileSync(
      path.join(pkgDir, "index.js"),
      `module.exports = ${pluginSource("demo")};`,
    );

    const loaded = await loadPlugins(
      [
        "./tools/cjs.js",
        "./tools/esm.mjs",
        "./tools/interop.js",
        "complinter-plugin-demo",
      ],
      dir,
    );

    assert.deepStrictEqual(
      loaded.map((l) => l.plugin.namespace),
      ["cjs", "esm", "interop", "demo"],
    );
    // npm plugins report their package version; local ones a content hash
    assert.strictEqual(loaded[3].version, "2.3.4");
    assert.strictEqual(loaded[3].contentHash, undefined);
    assert.strictEqual(loaded[0].version, "unknown");
    assert.match(loaded[0].contentHash ?? "", /^[0-9a-f]{64}$/);
  } finally {
    cleanup();
  }
});

void test("loadPlugins reports every kind of failure as a PluginError", async () => {
  const { dir, cleanup } = project();
  try {
    fs.writeFileSync(
      path.join(dir, "bad-shape.js"),
      "module.exports = { name: 1 };",
    );
    fs.writeFileSync(path.join(dir, "throws.js"), 'throw new Error("boom");');
    fs.writeFileSync(
      path.join(dir, "old-api.js"),
      `module.exports = ${pluginSource("old").replace(
        `apiVersion: ${PLUGIN_API_VERSION}`,
        "apiVersion: 0",
      )};`,
    );

    const failing: [string, RegExp][] = [
      ["./missing.js", /Cannot find local plugin/],
      ["not-installed-plugin", /Cannot find plugin "not-installed-plugin"/],
      ["./bad-shape.js", /Invalid plugin/],
      ["./throws.js", /Failed to load plugin "\.\/throws\.js": boom/],
      ["./old-api.js", /plugin API version 0/],
      ["../escape.js", /Invalid plugin specifier/],
    ];
    for (const [spec, pattern] of failing) {
      await assert.rejects(
        () => loadPlugins([spec], dir),
        (err: unknown) =>
          err instanceof PluginError && pattern.test(err.message),
        spec,
      );
    }
  } finally {
    cleanup();
  }
});

void test("loadPlugins with no specifiers loads nothing", async () => {
  assert.deepStrictEqual(await loadPlugins([], process.cwd()), []);
});

function loaded(plugin: Plugin, spec = "builtin"): LoadedPlugin {
  return { plugin, spec, version: "1.0.0" };
}

function make(
  namespace: string,
  ruleNames: string[],
  extra: Partial<Plugin> = {},
): Plugin {
  return {
    name: `${namespace}-plugin`,
    apiVersion: PLUGIN_API_VERSION,
    namespace,
    rules: ruleNames.map((n) => rule(`${namespace}/${n}`)),
    ...extra,
  };
}

const adapter = (id: string) => ({
  id,
  extensions: [`.${id}`],
  parse: () => ({ tree: [], comments: [] }),
  walk: () => undefined,
});

void test("assemblePlugins merges rules, adapters and default severities", () => {
  const result = assemblePlugins(
    [loaded(make("gdpr", ["a"], { defaultSeverities: { "gdpr/a": "warn" } }))],
    [
      loaded(
        make("acme", ["b", "c"], { adapters: [adapter("toy")] }),
        "./acme.js",
      ),
    ],
    [adapter("typescript")],
  );
  assert.deepStrictEqual(
    result.rules.map((r) => r.id),
    ["gdpr/a", "acme/b", "acme/c"],
  );
  assert.deepStrictEqual(
    result.adapters.map((a) => a.id),
    ["typescript", "toy"],
  );
  assert.deepStrictEqual(result.defaultSeverities, { "gdpr/a": "warn" });
});

void test("assemblePlugins rejects namespace, rule and adapter collisions", () => {
  const builtin = loaded(make("gdpr", ["a"]));

  assert.throws(
    () => assemblePlugins([builtin], [loaded(make("gdpr", ["z"]), "./x.js")]),
    /both use the namespace "gdpr"/,
  );
  assert.throws(
    () =>
      assemblePlugins(
        [],
        [
          loaded(make("one", ["a"]), "./1.js"),
          loaded(make("two", ["a"], { rules: [rule("one/a")] }), "./2.js"),
        ],
      ),
    /Rule id "one\/a" is defined by both/,
  );
  assert.throws(
    () =>
      assemblePlugins(
        [],
        [
          loaded(
            make("acme", ["a"], { adapters: [adapter("typescript")] }),
            "./a.js",
          ),
        ],
        [adapter("typescript")],
      ),
    /Language adapter "typescript" is provided by both/,
  );
});

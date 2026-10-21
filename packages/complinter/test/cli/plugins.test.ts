import { test } from "node:test";
import * as assert from "node:assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { PLUGIN_API_VERSION } from "@complinter/core";
import { runCli } from "../../src/run";

interface Finding {
  ruleId: string;
  severity: string;
  line: number;
}

async function run(
  dir: string,
  args: string[],
): Promise<{ code: number; findings: Finding[]; err: string }> {
  const log = console.log;
  const error = console.error;
  const warn = console.warn;
  let out = "";
  let err = "";
  console.log = (...a: unknown[]) => void (out += a.join(" ") + "\n");
  console.error = (...a: unknown[]) => void (err += a.join(" ") + "\n");
  console.warn = console.error;
  try {
    const code = await runCli(
      [path.join(dir, "src"), "--format", "json", ...args],
      dir,
    );
    let findings: Finding[] = [];
    if (out.trim().startsWith("{")) {
      const parsed = JSON.parse(out) as {
        results: { messages: Finding[] }[];
      };
      findings = parsed.results.flatMap((r) => r.messages);
    }
    return { code, findings, err };
  } finally {
    console.log = log;
    console.error = error;
    console.warn = warn;
  }
}

const noEvalRule = (extra = "") => `{
    id: "acme/no-eval",
    description: "flags eval()",
    create(ctx) {
      return {
        CallExpression(node) {
          if (node.callee.type === "Identifier" && node.callee.name === "eval") {
            ctx.report({ message: "no eval", line: node.loc.start.line, column: node.loc.start.column });
          }
        },
      };
    },
    ${extra}
  }`;

const plugin = (rules: string, extra = "") => `{
  name: "acme-plugin",
  apiVersion: ${PLUGIN_API_VERSION},
  namespace: "acme",
  rules: [${rules}],
  ${extra}
}`;

function setup(): { dir: string; write: (file: string, text: string) => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "complint-plugin-cli-"));
  fs.mkdirSync(path.join(dir, "src"));
  const write = (file: string, text: string) => {
    const full = path.join(dir, file);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, text);
  };
  return { dir, write };
}

void test("CLI loads plugins named in compliance.json", async (t) => {
  const { dir, write } = setup();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  write("src/app.ts", 'eval("x");\nconsole.log(user);\n');
  write("plugins/acme.js", `module.exports = ${plugin(noEvalRule())};`);
  write("compliance.json", JSON.stringify({ plugins: ["./plugins/acme.js"] }));

  await t.test("plugin rules run next to the built-in rules", async () => {
    const r = await run(dir, ["--no-cache"]);
    assert.strictEqual(r.code, 1);
    assert.deepStrictEqual(r.findings.map((f) => f.ruleId).sort(), [
      "acme/no-eval",
      "gdpr/explicit-pii-logging",
    ]);
    // Rules without a declared default are errors, like built-ins
    assert.strictEqual(
      r.findings.find((f) => f.ruleId === "acme/no-eval")?.severity,
      "error",
    );
  });

  await t.test("user config overrides a plugin rule's severity", async () => {
    write(
      "compliance.json",
      JSON.stringify({
        plugins: ["./plugins/acme.js"],
        rules: { "acme/no-eval": "warn" },
      }),
    );
    const warned = await run(dir, ["--no-cache"]);
    assert.strictEqual(
      warned.findings.find((f) => f.ruleId === "acme/no-eval")?.severity,
      "warn",
    );

    write(
      "compliance.json",
      JSON.stringify({
        plugins: ["./plugins/acme.js"],
        rules: { "acme/no-eval": "off" },
      }),
    );
    const off = await run(dir, ["--no-cache"]);
    assert.ok(!off.findings.some((f) => f.ruleId === "acme/no-eval"));
    // Known plugin rule ids never trigger the unknown-rule warning
    assert.ok(!/Unknown rule/.test(off.err));
  });

  await t.test("a plugin can declare default severities", async () => {
    // Node caches modules by path within a process, so each scenario gets its own file.
    write(
      "plugins/acme-defaults.js",
      `module.exports = ${plugin(noEvalRule(), 'defaultSeverities: { "acme/no-eval": "warn" }')};`,
    );
    write(
      "compliance.json",
      JSON.stringify({ plugins: ["./plugins/acme-defaults.js"] }),
    );
    const r = await run(dir, ["--no-cache"]);
    assert.strictEqual(
      r.findings.find((f) => f.ruleId === "acme/no-eval")?.severity,
      "warn",
    );
  });

  await t.test("inline suppression works for plugin rules", async () => {
    write(
      "src/app.ts",
      "// compliance-ignore-next-line acme/no-eval\neval('x');\n",
    );
    const r = await run(dir, ["--no-cache"]);
    assert.strictEqual(r.code, 0);
    assert.deepStrictEqual(r.findings, []);
  });
});

void test("CLI loads ESM and npm-package plugins", async (t) => {
  const { dir, write } = setup();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  write("src/app.ts", 'eval("x");\n');

  await t.test("ESM plugin", async () => {
    write("plugins/acme.mjs", `export default ${plugin(noEvalRule())};`);
    write(
      "compliance.json",
      JSON.stringify({ plugins: ["./plugins/acme.mjs"] }),
    );
    const r = await run(dir, ["--no-cache"]);
    assert.deepStrictEqual(
      r.findings.map((f) => f.ruleId),
      ["acme/no-eval"],
    );
  });

  await t.test("package installed in node_modules", async () => {
    write(
      "node_modules/complinter-plugin-acme/package.json",
      JSON.stringify({ name: "complinter-plugin-acme", version: "1.2.3" }),
    );
    write(
      "node_modules/complinter-plugin-acme/index.js",
      `module.exports = ${plugin(noEvalRule())};`,
    );
    write(
      "compliance.json",
      JSON.stringify({ plugins: ["complinter-plugin-acme"] }),
    );
    const r = await run(dir, ["--no-cache"]);
    assert.deepStrictEqual(
      r.findings.map((f) => f.ruleId),
      ["acme/no-eval"],
    );
  });
});

void test("a plugin can bring its own language adapter", async (t) => {
  const { dir, write } = setup();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  write(
    "plugins/toy.js",
    `module.exports = {
  name: "toy-plugin",
  apiVersion: ${PLUGIN_API_VERSION},
  namespace: "toy",
  adapters: [{
    id: "toy",
    extensions: [".toy"],
    parse(source) {
      const tree = [];
      source.split("\\n").forEach((text, i) => {
        const m = /^call (\\w+)\\((.*)\\)$/.exec(text.trim());
        if (m) tree.push({ type: "Call", callee: m[1], args: m[2], line: i + 1 });
      });
      return { tree, comments: [] };
    },
    walk(root, visit) { for (const node of root) visit(node.type, node); },
  }],
  rules: [{
    id: "toy/no-secret",
    description: "flags call secret(...)",
    language: "toy",
    create(ctx) {
      return {
        Call(node) {
          if (node.callee === "secret") ctx.report({ message: "secret", line: node.line, column: 0 });
        },
      };
    },
  }],
};`,
  );
  write("compliance.json", JSON.stringify({ plugins: ["./plugins/toy.js"] }));
  write("src/ok.toy", "call fine(1)\n");
  write("src/bad.toy", "call fine(1)\ncall secret(2)\n");
  write("src/app.ts", "const x = 1;\n");

  const r = await run(dir, ["--no-cache"]);
  assert.strictEqual(r.code, 1);
  assert.deepStrictEqual(
    r.findings.map((f) => `${f.ruleId}@${f.line}`),
    ["toy/no-secret@2"],
  );
});

void test("plugin problems exit 2 with a clear message", async (t) => {
  const { dir, write } = setup();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  write("src/app.ts", "const x = 1;\n");

  const cases: [string, string, RegExp][] = [
    ["missing local file", "./plugins/missing.js", /Cannot find local plugin/],
    [
      "missing package",
      "not-installed-xyz",
      /Cannot find plugin "not-installed-xyz"/,
    ],
    ["path outside the project", "../outside.js", /Invalid plugin specifier/],
    ["absolute path", "/etc/plugin.js", /Invalid plugin specifier/],
  ];
  for (const [label, spec, pattern] of cases) {
    write("compliance.json", JSON.stringify({ plugins: [spec] }));
    const r = await run(dir, ["--no-cache"]);
    assert.strictEqual(r.code, 2, label);
    assert.match(r.err, pattern, label);
  }

  const bad: [string, string, RegExp][] = [
    ["invalid shape", "module.exports = { name: 1 };", /Invalid plugin/],
    [
      "wrong API version",
      `module.exports = ${plugin(noEvalRule()).replace(`apiVersion: ${PLUGIN_API_VERSION}`, "apiVersion: 99")};`,
      /plugin API version 99/,
    ],
    [
      "claims the built-in namespace",
      `module.exports = ${plugin(noEvalRule()).replace('namespace: "acme"', 'namespace: "gdpr"').replace("acme/no-eval", "gdpr/no-eval")};`,
      /both use the namespace "gdpr"/,
    ],
    [
      "rule for a language nobody provides",
      `module.exports = ${plugin(noEvalRule('language: "cobol",'))};`,
      /targets language "cobol"/,
    ],
    [
      "throws while loading",
      'throw new Error("kaboom");',
      /Failed to load plugin .*kaboom/,
    ],
  ];
  for (const [index, [label, source, pattern]] of bad.entries()) {
    write(`plugins/bad-${index}.js`, source);
    write(
      "compliance.json",
      JSON.stringify({ plugins: [`./plugins/bad-${index}.js`] }),
    );
    const r = await run(dir, ["--no-cache"]);
    assert.strictEqual(r.code, 2, label);
    assert.match(r.err, pattern, label);
  }

  write("compliance.json", JSON.stringify({ plugins: "nope" }));
  assert.strictEqual((await run(dir, ["--no-cache"])).code, 2);
});

void test("the result cache is invalidated when plugins or severities change", async (t) => {
  const { dir, write } = setup();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  write("src/app.ts", "eval('x');\nfoo();\n");

  const flagsFoo = noEvalRule().replace(
    'node.callee.name === "eval"',
    'node.callee.name === "foo"',
  );
  write("plugins/evals.js", `module.exports = ${plugin(noEvalRule())};`);
  write("plugins/foos.js", `module.exports = ${plugin(flagsFoo)};`);
  const use = (plugins: string[], rules: Record<string, string> = {}) =>
    write("compliance.json", JSON.stringify({ plugins, rules }));
  const lines = (r: { findings: Finding[] }) =>
    r.findings.map((f) => `${f.ruleId}@${f.line}:${f.severity}`);

  use(["./plugins/evals.js"]);
  const first = await run(dir, []);
  assert.deepStrictEqual(lines(first), ["acme/no-eval@1:error"]);

  // Same inputs again: served from the cache, same answer
  assert.deepStrictEqual(lines(await run(dir, [])), lines(first));

  // A different plugin with identical source files must not reuse the cache
  use(["./plugins/foos.js"]);
  assert.deepStrictEqual(lines(await run(dir, [])), ["acme/no-eval@2:error"]);

  // Neither may a changed severity
  use(["./plugins/foos.js"], { "acme/no-eval": "warn" });
  assert.deepStrictEqual(lines(await run(dir, [])), ["acme/no-eval@2:warn"]);

  // Or removing the plugin altogether
  use([]);
  assert.deepStrictEqual(lines(await run(dir, [])), []);
});

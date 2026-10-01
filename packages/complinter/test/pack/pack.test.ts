import { test } from "node:test";
import * as assert from "node:assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execSync, spawnSync } from "node:child_process";

/**
 * Packs the CLI exactly as it would be published, installs the tarball into a
 * clean project (with real dependency resolution) and runs it. This proves the
 * internal @complinter/* packages are really bundled, that nothing the CLI
 * needs is missing from package.json, that the `exports` map exposes only the
 * public entry points, and that CJS, ESM and package plugins all load.
 *
 * Needs the npm registry (or a warm npm cache) to install typescript-estree.
 */

const repoRoot = path.resolve(__dirname, "..", "..", "..", "..");
const pkgDir = path.join(repoRoot, "packages", "complinter");

function npm(args: string[], cwd: string): string {
  // One quoted command string works the same under cmd.exe and POSIX shells.
  const command = ["npm", ...args.map((a) => `"${a}"`)].join(" ");
  return execSync(command, {
    cwd,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function runNode(args: string[], cwd: string) {
  const result = spawnSync(process.execPath, args, {
    cwd,
    encoding: "utf-8",
  });
  return {
    code: result.status,
    out: result.stdout,
    err: result.stderr,
  };
}

const PLUGIN_API_VERSION = 1;

void test(
  "the packed tarball installs cleanly and runs with plugins",
  { timeout: 300_000 },
  async (t) => {
    // The test packs what the build produced; build first when it is missing.
    if (!fs.existsSync(path.join(pkgDir, "dist", "cli.js"))) {
      npm(["run", "build"], repoRoot);
    }

    const work = fs.mkdtempSync(path.join(os.tmpdir(), "complint-pack-"));
    t.after(() => fs.rmSync(work, { recursive: true, force: true }));

    // --- pack
    const packDir = path.join(work, "pack");
    fs.mkdirSync(packDir);
    const packed = JSON.parse(
      npm(
        [
          "pack",
          "--workspace",
          "complinter",
          "--pack-destination",
          packDir,
          "--json",
        ],
        repoRoot,
      ),
    ) as { filename: string }[];
    const tarball = path.join(packDir, packed[0].filename);
    assert.ok(fs.existsSync(tarball), "npm pack produced a tarball");

    // --- install into a clean consumer project
    const project = path.join(work, "consumer");
    fs.mkdirSync(path.join(project, "src"), { recursive: true });
    fs.writeFileSync(
      path.join(project, "package.json"),
      JSON.stringify({ name: "consumer", private: true, version: "0.0.0" }),
    );
    npm(
      [
        "install",
        tarball,
        "--no-audit",
        "--no-fund",
        "--ignore-scripts",
        "--prefer-offline",
        "--loglevel=error",
      ],
      project,
    );

    const installed = path.join(project, "node_modules", "complinter");

    await t.test("the package contains only the built bundles", () => {
      for (const file of ["cli.js", "plugin-api.js", "plugin-api.d.ts"]) {
        assert.ok(
          fs.existsSync(path.join(installed, "dist", file)),
          `dist/${file} is packed`,
        );
      }
      assert.ok(!fs.existsSync(path.join(installed, "src")), "no src");
      assert.ok(!fs.existsSync(path.join(installed, "test")), "no tests");
    });

    await t.test("internal packages are bundled, not depended upon", () => {
      const manifest = JSON.parse(
        fs.readFileSync(path.join(installed, "package.json"), "utf-8"),
      ) as { dependencies?: Record<string, string> };
      assert.deepStrictEqual(Object.keys(manifest.dependencies ?? {}), [
        "@typescript-eslint/typescript-estree",
      ]);
      assert.ok(
        !fs.existsSync(path.join(project, "node_modules", "@complinter")),
        "no @complinter/* package was installed",
      );
      const types = fs.readFileSync(
        path.join(installed, "dist", "plugin-api.d.ts"),
        "utf-8",
      );
      assert.ok(!types.includes("@complinter/"), "types are self-contained");
    });

    const cli = path.join(installed, "dist", "cli.js");

    await t.test("the CLI runs and reports its version", () => {
      const repoVersion = (
        JSON.parse(
          fs.readFileSync(path.join(pkgDir, "package.json"), "utf-8"),
        ) as { version: string }
      ).version;
      const r = runNode([cli, "--version"], project);
      assert.strictEqual(r.code, 0, r.err);
      assert.strictEqual(r.out.trim(), repoVersion);
    });

    await t.test("only the public entry points are exported", () => {
      const probe = (code: string) =>
        runNode(
          [
            "-e",
            `try { ${code}; console.log("ok"); } catch (e) { console.log(e.code); }`,
          ],
          project,
        ).out.trim();

      assert.strictEqual(probe('require("complinter/plugin-api")'), "ok");
      assert.strictEqual(probe('require("complinter/package.json")'), "ok");
      assert.strictEqual(
        probe('require("complinter/dist/cli.js")'),
        "ERR_PACKAGE_PATH_NOT_EXPORTED",
      );
      assert.strictEqual(
        probe('require("complinter")'),
        "ERR_PACKAGE_PATH_NOT_EXPORTED",
      );
    });

    await t.test(
      "CJS, ESM, package and built-in rules all run together",
      () => {
        fs.writeFileSync(
          path.join(project, "src", "app.ts"),
          'eval("x");\nconsole.log(user);\nforbidden();\n',
        );

        const rule = (
          id: string,
          test: string,
        ) => `{ id: "${id}", description: "d", create(ctx) {
          return { CallExpression(node) { if (${test}) ctx.report({ message: "found", line: node.loc.start.line, column: 0 }); } };
        } }`;

        // Local CommonJS plugin
        fs.mkdirSync(path.join(project, "plugins"));
        fs.writeFileSync(
          path.join(project, "plugins", "cjs.js"),
          `module.exports = { name: "cjs", apiVersion: ${PLUGIN_API_VERSION}, namespace: "cjs",
            rules: [${rule("cjs/no-eval", 'node.callee.type === "Identifier" && node.callee.name === "eval"')}] };`,
        );

        // Local ESM plugin that imports the published plugin API
        fs.writeFileSync(
          path.join(project, "plugins", "esm.mjs"),
          `import { definePlugin, PLUGIN_API_VERSION } from "complinter/plugin-api";
           export default definePlugin({ name: "esm", apiVersion: PLUGIN_API_VERSION, namespace: "esm",
            rules: [${rule("esm/no-console-log", 'node.callee.type === "MemberExpression" && node.callee.object.name === "console"')}] });`,
        );

        // npm package plugin written with the typed rule helper
        const pluginPkg = path.join(
          project,
          "node_modules",
          "complinter-plugin-demo",
        );
        fs.mkdirSync(pluginPkg, { recursive: true });
        fs.writeFileSync(
          path.join(pluginPkg, "package.json"),
          JSON.stringify({
            name: "complinter-plugin-demo",
            version: "3.1.4",
            main: "index.js",
            peerDependencies: { complinter: "*" },
          }),
        );
        fs.writeFileSync(
          path.join(pluginPkg, "index.js"),
          `const { definePlugin, defineRule, PLUGIN_API_VERSION } = require("complinter/plugin-api");
           module.exports = definePlugin({ name: "demo", apiVersion: PLUGIN_API_VERSION, namespace: "demo",
             rules: [defineRule({ id: "demo/no-forbidden", description: "d",
               create(ctx) { return { CallExpression(node) {
                 if (node.callee.type === "Identifier" && node.callee.name === "forbidden")
                   ctx.report({ message: "forbidden", line: node.loc.start.line, column: 0 });
               } }; } })] });`,
        );

        fs.writeFileSync(
          path.join(project, "compliance.json"),
          JSON.stringify({
            plugins: [
              "./plugins/cjs.js",
              "./plugins/esm.mjs",
              "complinter-plugin-demo",
            ],
          }),
        );

        const r = runNode(
          [cli, "src", "--no-cache", "--format", "json"],
          project,
        );
        assert.strictEqual(r.code, 1, r.err);
        const parsed = JSON.parse(r.out) as {
          results: { messages: { ruleId: string; line: number }[] }[];
        };
        const found = parsed.results
          .flatMap((res) => res.messages)
          .map((m) => `${m.ruleId}@${m.line}`)
          .sort();
        assert.deepStrictEqual(found, [
          "cjs/no-eval@1",
          "demo/no-forbidden@3",
          "esm/no-console-log@2",
          "gdpr/explicit-pii-logging@2",
        ]);
      },
    );

    await t.test("a broken plugin stops the installed CLI with exit 2", () => {
      fs.writeFileSync(
        path.join(project, "compliance.json"),
        JSON.stringify({ plugins: ["./plugins/missing.js"] }),
      );
      const r = runNode([cli, "src", "--no-cache"], project);
      assert.strictEqual(r.code, 2);
      assert.match(r.err, /Cannot find local plugin/);
    });
  },
);

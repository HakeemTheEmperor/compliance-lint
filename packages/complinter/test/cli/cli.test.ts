import { test } from "node:test";
import * as assert from "node:assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { runCli } from "../../src/run";

async function capture<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; out: string; err: string }> {
  const log = console.log;
  const error = console.error;
  const warn = console.warn;
  let out = "";
  let err = "";
  console.log = (...a: unknown[]) => void (out += a.join(" ") + "\n");
  console.error = (...a: unknown[]) => void (err += a.join(" ") + "\n");
  console.warn = console.error;
  try {
    return { result: await fn(), out, err };
  } finally {
    console.log = log;
    console.error = error;
    console.warn = warn;
  }
}

void test("CLI exit codes and options", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "complint-cli-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const src = path.join(dir, "src");
  fs.mkdirSync(src);
  fs.writeFileSync(path.join(src, "good.ts"), "export const a = 1;\n");

  const run = (...args: string[]) =>
    capture(() => runCli([...args, "--no-cache"], dir));

  await t.test("clean project exits 0", async () => {
    assert.strictEqual((await run(src)).result, 0);
  });

  await t.test("--help and --version exit 0", async () => {
    assert.strictEqual(
      (await capture(() => runCli(["--help"], dir))).result,
      0,
    );
    const v = await capture(() => runCli(["--version"], dir));
    assert.strictEqual(v.result, 0);
    assert.match(v.out, /^\d+\.\d+\.\d+/);
  });

  await t.test("violations exit 1 and render as JSON and SARIF", async () => {
    fs.writeFileSync(path.join(src, "bad.ts"), "console.log(user);\n");
    const r = await run(src, "--format", "json");
    assert.strictEqual(r.result, 1);
    assert.strictEqual(
      (JSON.parse(r.out) as { errorCount: number }).errorCount,
      1,
    );
    const sarif = await run(src, "-f", "sarif");
    assert.strictEqual(
      (JSON.parse(sarif.out) as { version: string }).version,
      "2.1.0",
    );
    fs.rmSync(path.join(src, "bad.ts"));
  });

  await t.test("a file that cannot be parsed exits 2", async () => {
    fs.writeFileSync(path.join(src, "broken.ts"), "class {{{");
    assert.strictEqual((await run(src)).result, 2);
    fs.rmSync(path.join(src, "broken.ts"));
  });

  await t.test("missing directory, bad flag, bad format exit 2", async () => {
    assert.strictEqual((await run(path.join(dir, "nope"))).result, 2);
    assert.strictEqual((await run("--bogus")).result, 2);
    assert.strictEqual((await run(src, "--format", "xml")).result, 2);
  });

  await t.test("malformed config exits 2", async () => {
    fs.writeFileSync(path.join(dir, "compliance.json"), "{ not json");
    assert.strictEqual((await run(src)).result, 2);
    fs.writeFileSync(
      path.join(dir, "compliance.json"),
      JSON.stringify({ rules: { "gdpr/missing-consent-flag": "fatal" } }),
    );
    assert.strictEqual((await run(src)).result, 2);
    fs.rmSync(path.join(dir, "compliance.json"));
  });

  await t.test("an unknown rule id in the config only warns", async () => {
    fs.writeFileSync(
      path.join(dir, "compliance.json"),
      JSON.stringify({ rules: { "nope/not-a-rule": "warn" } }),
    );
    const r = await run(src);
    assert.strictEqual(r.result, 0);
    assert.match(r.err, /Unknown rule "nope\/not-a-rule"/);
    fs.rmSync(path.join(dir, "compliance.json"));
  });
});

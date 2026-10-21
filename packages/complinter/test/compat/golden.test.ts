import { test } from "node:test";
import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { runCli } from "../../src/run";
import { allRules } from "@complinter/rules-gdpr";

/**
 * Compatibility safety net for the plugin-architecture refactor.
 *
 * Runs the CLI over a fixed fixture corpus and compares exit codes plus JSON
 * and SARIF output with files checked in under test/fixtures/compat/golden.
 * During the refactor these must stay byte-identical. Regenerate on purpose
 * with: UPDATE_GOLDEN=1 npm test
 */

const FIXTURES = path.join(__dirname, "..", "fixtures", "compat");
const PROJECT = path.join(FIXTURES, "project");
const GOLDEN = path.join(FIXTURES, "golden");

interface Snapshot {
  exitCode: number;
  output: unknown;
}

function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}

function stripRoot(text: string, root: string): string {
  const rootPosix = toPosix(root);
  const rootUri = pathToFileURL(root).href;
  return toPosix(text)
    .split(rootUri)
    .join("<root>")
    .split(rootPosix)
    .join("<root>");
}

function mapStrings(value: unknown, fn: (s: string) => string): unknown {
  if (typeof value === "string") return fn(value);
  if (Array.isArray(value)) return value.map((v) => mapStrings(v, fn));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, mapStrings(v, fn)]),
    );
  }
  return value;
}

/** Make output independent of machine paths, file system order and version. */
function normalise(raw: string, root: string): unknown {
  const parsed = mapStrings(JSON.parse(raw), (s) =>
    stripRoot(s, root),
  ) as Record<string, unknown>;

  if (Array.isArray(parsed.results)) {
    // JSON reporter: results keyed by file path
    (parsed.results as { filePath: string }[]).sort((a, b) =>
      a.filePath.localeCompare(b.filePath),
    );
  }

  const runs = parsed.runs as
    | {
        tool: { driver: { version: string } };
        results: {
          ruleId: string;
          locations: {
            physicalLocation: {
              artifactLocation: { uri: string };
              region: { startLine: number; startColumn: number };
            };
          }[];
        }[];
      }[]
    | undefined;
  if (runs) {
    for (const run of runs) {
      run.tool.driver.version = "<version>";
      const key = (r: (typeof run.results)[number]) => {
        const loc = r.locations[0].physicalLocation;
        return `${loc.artifactLocation.uri}:${String(loc.region.startLine).padStart(6, "0")}:${String(loc.region.startColumn).padStart(6, "0")}:${r.ruleId}`;
      };
      run.results.sort((a, b) => key(a).localeCompare(key(b)));
    }
  }
  return parsed;
}

async function capture(argv: string[], cwd: string): Promise<Snapshot> {
  const log = console.log;
  const error = console.error;
  let out = "";
  console.log = (...a: unknown[]) => void (out += a.join(" ") + "\n");
  console.error = () => undefined;
  try {
    const exitCode = await runCli(argv, cwd);
    return { exitCode, output: normalise(out, cwd) };
  } finally {
    console.log = log;
    console.error = error;
  }
}

function check(name: string, actual: Snapshot): void {
  const file = path.join(GOLDEN, `${name}.json`);
  const serialised = JSON.stringify(actual, null, 2) + "\n";

  if (process.env.UPDATE_GOLDEN === "1") {
    fs.mkdirSync(GOLDEN, { recursive: true });
    fs.writeFileSync(file, serialised);
    return;
  }

  assert.ok(
    fs.existsSync(file),
    `Missing golden file ${file}. Run UPDATE_GOLDEN=1 npm test to create it.`,
  );
  const expected = fs.readFileSync(file, "utf-8").replace(/\r\n/g, "\n");
  assert.strictEqual(serialised, expected, `${name} output changed`);
}

const base = (...extra: string[]) => [PROJECT, "--no-cache", ...extra];

void test("Compatibility golden outputs", async (t) => {
  await t.test("default config, JSON format", async () => {
    const snap = await capture(base("--format", "json"), PROJECT);
    assert.strictEqual(snap.exitCode, 1);

    // Guard: the corpus must exercise every built-in rule.
    const seen = new Set(
      (
        snap.output as { results: { messages: { ruleId: string }[] }[] }
      ).results.flatMap((r) => r.messages.map((m) => m.ruleId)),
    );
    for (const rule of allRules) {
      assert.ok(seen.has(rule.id), `fixtures never trigger ${rule.id}`);
    }
    check("default-json", snap);
  });

  await t.test("default config, SARIF format", async () => {
    const snap = await capture(base("--format", "sarif"), PROJECT);
    assert.strictEqual(snap.exitCode, 1);
    check("default-sarif", snap);
  });

  await t.test("custom config: overrides, off, custom ignore", async () => {
    const config = path.join(FIXTURES, "configs", "custom.json");
    const snap = await capture(
      base("--format", "json", "--config", config),
      PROJECT,
    );
    assert.strictEqual(snap.exitCode, 1);
    check("custom-json", snap);
  });

  await t.test("warnings only do not fail the run", async () => {
    const config = path.join(FIXTURES, "configs", "warn-only.json");
    const snap = await capture(
      base("--format", "json", "--config", config),
      PROJECT,
    );
    assert.strictEqual(snap.exitCode, 0);
    check("warn-only-json", snap);
  });

  await t.test("compliant files exit 0 with no findings", async () => {
    const good = path.join(PROJECT, "good");
    const snap = await capture(
      [good, "--no-cache", "--format", "json"],
      PROJECT,
    );
    assert.strictEqual(snap.exitCode, 0);
    check("good-json", snap);
  });
});

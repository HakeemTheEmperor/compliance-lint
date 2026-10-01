import { test } from "node:test";
import * as assert from "node:assert";
import { parseSource } from "@/src/engine/parse-file";
import { applySuppressions } from "@/src/engine/suppress";
import { EngineRunner } from "@/src/engine/runner";
import { allRules } from "@/src/rules";

function lint(code: string, file = "a.ts") {
  const { ast, comments } = parseSource(code, file);
  return applySuppressions(new EngineRunner(allRules).run(ast), comments);
}

void test("inline suppression comments", async (t) => {
  const bad = "console.log(user);";

  await t.test("baseline reports", () => {
    assert.strictEqual(lint(bad).length, 1);
  });

  await t.test("ignore-next-line without ids suppresses everything", () => {
    assert.strictEqual(
      lint(`// compliance-ignore-next-line\n${bad}`).length,
      0,
    );
  });

  await t.test("ignore-next-line with the rule id suppresses it", () => {
    const code = `// compliance-ignore-next-line gdpr/explicit-pii-logging\n${bad}`;
    assert.strictEqual(lint(code).length, 0);
  });

  await t.test("a different rule id does not suppress", () => {
    const code = `// compliance-ignore-next-line gdpr/missing-consent-flag\n${bad}`;
    assert.strictEqual(lint(code).length, 1);
  });

  await t.test("trailing same-line comment suppresses", () => {
    assert.strictEqual(lint(`${bad} // compliance-ignore`).length, 0);
  });
});

void test("parseSource enables JSX only for JSX-capable extensions", () => {
  assert.doesNotThrow(() => parseSource("const a = <div/>;", "a.tsx"));
  assert.doesNotThrow(() => parseSource("const a = <string>b;", "a.ts"));
});

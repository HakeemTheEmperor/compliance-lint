import { test } from "node:test";
import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  AST_NODE_TYPES,
  defineRule,
  definePlugin,
  lintText,
} from "complinter/plugin-api";

/**
 * The example in docs/plugins.md is real code. This runs the same plugin and
 * checks that the guide still contains it, so the guide cannot drift from the API.
 */

const noDebugEndpoints = defineRule({
  id: "acme/no-debug-endpoints",
  description: "Flags routes that dump the request, which can contain personal data.",
  create(context) {
    return {
      CallExpression(node) {
        if (
          node.callee.type === AST_NODE_TYPES.MemberExpression &&
          node.callee.property.type === AST_NODE_TYPES.Identifier &&
          node.callee.property.name === "dumpRequest"
        ) {
          context.report({
            message:
              "dumpRequest() writes the whole request, including personal data, to the response.",
            line: node.loc.start.line,
            column: node.loc.start.column,
          });
        }
      },
    };
  },
});

const plugin = definePlugin({
  name: "complinter-plugin-acme",
  apiVersion: 1,
  namespace: "acme",
  rules: [noDebugEndpoints],
  defaultSeverities: { "acme/no-debug-endpoints": "warn" },
});

void test("the authoring guide example works as documented", async (t) => {
  await t.test("flags dumpRequest", () => {
    const violations = lintText(plugin, "app.dumpRequest(req);");
    assert.deepStrictEqual(
      violations.map((v) => v.ruleId),
      ["acme/no-debug-endpoints"],
    );
  });

  await t.test("severities come from the config", () => {
    const [violation] = lintText(plugin, "app.dumpRequest(req);", {
      severities: { "acme/no-debug-endpoints": "error" },
    });
    assert.strictEqual(violation.severity, "error");
  });

  await t.test("the guide still contains the example", () => {
    const guide = fs.readFileSync(
      path.join(__dirname, "..", "..", "..", "..", "docs", "plugins.md"),
      "utf-8",
    );
    for (const fragment of [
      'id: "acme/no-debug-endpoints"',
      'node.callee.property.name === "dumpRequest"',
      'apiVersion: 1,',
      'lintText(plugin, "app.dumpRequest(req);")',
    ]) {
      assert.ok(guide.includes(fragment), `docs/plugins.md lost: ${fragment}`);
    }
  });
});

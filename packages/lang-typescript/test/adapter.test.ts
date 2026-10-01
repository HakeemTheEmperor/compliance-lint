import { test } from "node:test";
import * as assert from "node:assert";
import {
  SOURCE_EXTENSIONS,
  EngineRunner,
  eraseAdapter,
} from "@complinter/core";
import { AST_NODE_TYPES } from "@typescript-eslint/typescript-estree";
import { typescriptAdapter, defineRule } from "../src";

void test("typescriptAdapter parses, walks with parent pointers, and reports comments", () => {
  const parsed = typescriptAdapter.parse("// note\nconst a = foo(1);", "a.ts");
  assert.strictEqual(parsed.tree.type, "Program");
  assert.strictEqual(parsed.comments.length, 1);
  assert.strictEqual(parsed.comments[0].value, " note");

  const parents: string[] = [];
  typescriptAdapter.walk(parsed.tree, (type, node) => {
    if (type === AST_NODE_TYPES.CallExpression) {
      const parent = (node as { parent?: { type: string } }).parent;
      parents.push(parent?.type ?? "none");
    }
  });
  assert.deepStrictEqual(parents, ["VariableDeclarator"]);
});

void test("typescriptAdapter handles the same files discovery has always handled", () => {
  assert.deepStrictEqual(
    [...typescriptAdapter.extensions].sort(),
    [...SOURCE_EXTENSIONS].sort(),
  );

  const runner = new EngineRunner([], {}, [eraseAdapter(typescriptAdapter)]);
  for (const name of ["a.ts", "a.tsx", "a.js", "a.jsx", "a.mts", "a.cts"]) {
    assert.strictEqual(runner.supportsFile(name), true, name);
  }
  assert.strictEqual(runner.supportsFile("types.d.ts"), false);
  assert.strictEqual(runner.supportsFile("notes.md"), false);
});

void test("defineRule builds a typescript-language rule with typed visitors", () => {
  const rule = defineRule({
    id: "test/no-eval",
    description: "flags eval",
    create(ctx) {
      return {
        CallExpression(node) {
          if (
            node.callee.type === AST_NODE_TYPES.Identifier &&
            node.callee.name === "eval"
          ) {
            ctx.report({
              message: "eval",
              line: node.loc.start.line,
              column: 0,
            });
          }
        },
      };
    },
  });
  assert.strictEqual(rule.language, "typescript");

  const runner = new EngineRunner([rule], {}, [
    eraseAdapter(typescriptAdapter),
  ]);
  assert.strictEqual(runner.lintSource("eval('x');", "a.ts").length, 1);
  assert.strictEqual(runner.lintSource("safe('x');", "a.ts").length, 0);
});

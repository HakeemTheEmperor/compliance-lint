import { test } from "node:test";
import * as assert from "node:assert";
import { parse } from "@typescript-eslint/typescript-estree";
import { EngineRunner } from "@/src/engine/runner";
import { Rule } from "@/src/engine/types";

void test("EngineRunner instantiates each rule once per run", () => {
  let createCalls = 0;
  const rule: Rule = {
    id: "mock/stateful",
    description: "Counts create() calls and keeps state across visitors",
    create(context) {
      createCalls++;
      const seenClasses: string[] = [];
      return {
        ClassDeclaration(node) {
          if (node.id) seenClasses.push(node.id.name);
        },
        MethodDefinition(node) {
          context.report({
            message: `classes seen so far: ${seenClasses.join(",")}`,
            line: node.loc.start.line,
            column: node.loc.start.column,
          });
        },
      };
    },
  };

  const ast = parse("class A { m() {} }", { loc: true });
  const violations = new EngineRunner([rule]).run(ast);

  assert.strictEqual(createCalls, 1);
  assert.strictEqual(violations.length, 1);
  assert.strictEqual(violations[0].message, "classes seen so far: A");
});

void test("EngineRunner assigns severity from config", () => {
  const rule: Rule = {
    id: "mock/warns",
    description: "Always reports on Program",
    create(context) {
      return {
        Program: () => context.report({ message: "x", line: 1, column: 0 }),
      };
    },
  };
  const ast = parse("const a = 1;", { loc: true });

  const warn = new EngineRunner([rule], { "mock/warns": "warn" }).run(ast);
  assert.strictEqual(warn[0].severity, "warn");

  const off = new EngineRunner([rule], { "mock/warns": "off" }).run(ast);
  assert.strictEqual(off.length, 0);
});

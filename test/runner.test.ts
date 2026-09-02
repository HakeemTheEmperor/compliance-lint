import { test } from "node:test";
import * as assert from "node:assert";
import { EngineRunner } from "../src/engine/runner";
import { Rule } from "../src/engine/types";
import { parse } from "@typescript-eslint/typescript-estree";

test("EngineRunner should traverse AST and report rule violations", () => {
  // 1. Setup a dummy AST in memory (no file reading needed for this test)
  const code = `
    export class CreateUserDto {
      email!: string;
    }
  `;
  const ast = parse(code, { loc: true });

  // 2. Create a mock rule
  const mockRule: Rule = {
    id: "mock/find-dto",
    description: "Finds CreateUserDto classes",
    create(context) {
      return {
        ClassDeclaration(node) {
          if (node.id?.name === "CreateUserDto") {
            context.report({
              message: "Found the DTO class!",
              line: node.loc.start.line,
              column: node.loc.start.column,
            });
          }
        },
      };
    },
  };

  // 3. Execute the runner
  const runner = new EngineRunner([mockRule]);
  const violations = runner.run(ast);

  // 4. Assert the results
  assert.strictEqual(violations.length, 1, "Should find exactly one violation");
  assert.strictEqual(violations[0].ruleId, "mock/find-dto");
  assert.strictEqual(violations[0].message, "Found the DTO class!");
  assert.strictEqual(violations[0].line, 2, "Class starts on line 2");
});

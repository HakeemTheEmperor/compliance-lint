import { test } from "node:test";
import * as assert from "node:assert";
import {
  AST_NODE_TYPES,
  TSESTree,
  parse,
} from "@typescript-eslint/typescript-estree";
import { EngineRunner } from "../../src/engine/runner";
import {
  AnyRule,
  LanguageAdapter,
  assertLanguagesRegistered,
  createRuleFactory,
  eraseAdapter,
} from "../../src/engine/language";
import { Rule, TsNodes, Visitors } from "../../src/engine/types";
import { walkTypedTree } from "../../src/engine/walk";

// ---- A stub second language: lines like `call logger(user)` / `set x = 1`.
// Comments start with `#`.

interface ToyCall {
  type: "Call";
  callee: string;
  args: string[];
  line: number;
}
interface ToySet {
  type: "Set";
  name: string;
  line: number;
}
type ToyNodes = { Call: ToyCall; Set: ToySet };

const toyAdapter: LanguageAdapter<ToyNodes, (ToyCall | ToySet)[]> = {
  id: "toy",
  extensions: [".toy"],
  excludeSuffixes: [".gen.toy"],
  parse(source) {
    const tree: (ToyCall | ToySet)[] = [];
    const comments: {
      value: string;
      loc: { start: { line: number }; end: { line: number } };
    }[] = [];
    source.split("\n").forEach((text, i) => {
      const line = i + 1;
      const trimmed = text.trim();
      if (trimmed.includes("#")) {
        const at = trimmed.indexOf("#");
        comments.push({
          value: trimmed.slice(at + 1),
          loc: { start: { line }, end: { line } },
        });
      }
      const code = trimmed.split("#")[0].trim();
      const call = /^call (\w+)\((.*)\)$/.exec(code);
      const set = /^set (\w+) =/.exec(code);
      if (call) {
        tree.push({
          type: "Call",
          callee: call[1],
          args: call[2] ? call[2].split(",").map((s) => s.trim()) : [],
          line,
        });
      } else if (set) {
        tree.push({ type: "Set", name: set[1], line });
      }
    });
    return { tree, comments };
  },
  walk(root, visit) {
    for (const node of root) visit(node.type, node);
  },
};

const defineToyRule = createRuleFactory<ToyNodes>("toy");
const defineTsRule = createRuleFactory<TsNodes>("typescript");

const toyNoUserLogging = defineToyRule({
  id: "toy/no-user-logging",
  description: "flags call logger(user)",
  create(ctx) {
    return {
      Call(node) {
        if (node.callee === "logger" && node.args.includes("user")) {
          ctx.report({ message: ctx.filename, line: node.line, column: 0 });
        }
      },
    };
  },
});

const tsNoEval = defineTsRule({
  id: "ts/no-eval",
  description: "flags eval()",
  create(ctx) {
    return {
      CallExpression(node) {
        if (
          node.callee.type === AST_NODE_TYPES.Identifier &&
          node.callee.name === "eval"
        ) {
          ctx.report({
            message: ctx.sourceText,
            line: node.loc.start.line,
            column: node.loc.start.column,
          });
        }
      },
    };
  },
});

// A plain rule object with no `language`, exactly like the built-in rules.
const plainRule: Rule = {
  id: "plain/any-call",
  description: "flags every call expression",
  create(ctx) {
    return {
      CallExpression(node) {
        ctx.report({ message: "call", line: node.loc.start.line, column: 0 });
      },
    };
  },
};

// Minimal TypeScript adapter, so mixed-language runs have a real second language.
const tsAdapter: LanguageAdapter<TsNodes, TSESTree.Program> = {
  id: "typescript",
  extensions: [".ts"],
  excludeSuffixes: [".d.ts"],
  parse(source) {
    const ast = parse(source, { loc: true, comment: true });
    return { tree: ast, comments: ast.comments ?? [] };
  },
  walk(root, visit) {
    walkTypedTree(root, (type, node) =>
      visit(type as keyof TsNodes & string, node as TsNodes[keyof TsNodes]),
    );
  },
};

const toyOnly = [eraseAdapter(toyAdapter)];
const adapters = [eraseAdapter(toyAdapter), eraseAdapter(tsAdapter)];

void test("EngineRunner chooses the adapter by extension and rules by language", async (t) => {
  const rules: AnyRule[] = [plainRule, tsNoEval, toyNoUserLogging];

  await t.test("toy rules run on .toy files only", () => {
    const runner = new EngineRunner(rules, {}, adapters);
    const found = runner.lintSource(
      "set x = 1\ncall logger(user)\ncall logger(id)\n",
      "a.toy",
    );
    assert.deepStrictEqual(
      found.map((v) => `${v.ruleId}@${v.line}`),
      ["toy/no-user-logging@2"],
    );
  });

  await t.test(
    "TypeScript files run TypeScript rules and never toy rules",
    () => {
      const runner = new EngineRunner(rules, {}, adapters);
      const found = runner.lintSource("eval('x'); foo();", "m.ts");
      assert.deepStrictEqual(found.map((v) => v.ruleId).sort(), [
        "plain/any-call",
        "plain/any-call",
        "ts/no-eval",
      ]);
    },
  );

  await t.test("rules receive filename and source text", () => {
    const runner = new EngineRunner(rules, {}, adapters);
    const found = runner.lintSource("call logger(user)", "dir/b.toy");
    assert.strictEqual(found[0].message, "dir/b.toy");
  });

  await t.test(
    "files no adapter handles yield nothing; excluded suffixes too",
    () => {
      const runner = new EngineRunner(rules, {}, adapters);
      assert.strictEqual(runner.supportsFile("a.toy"), true);
      assert.strictEqual(runner.supportsFile("a.gen.toy"), false);
      assert.strictEqual(runner.supportsFile("a.py"), false);
      assert.strictEqual(runner.supportsFile("types.d.ts"), false);
      assert.deepStrictEqual(
        runner.lintSource("call logger(user)", "a.py"),
        [],
      );
    },
  );

  await t.test("adapter comments drive inline suppression", () => {
    const runner = new EngineRunner(rules, {}, adapters);
    const src =
      "# compliance-ignore-next-line toy/no-user-logging\ncall logger(user)\ncall logger(user)\n";
    const found = runner.lintSource(src, "c.toy");
    assert.deepStrictEqual(
      found.map((v) => v.line),
      [3],
    );
  });

  await t.test("run(ast) still runs only TypeScript-language rules", () => {
    const runner = new EngineRunner(rules);
    const found = runner.run(parse("eval('x'); foo();", { loc: true }));
    assert.deepStrictEqual(found.map((v) => v.ruleId).sort(), [
      "plain/any-call",
      "plain/any-call",
      "ts/no-eval",
    ]);
  });

  await t.test("severity config applies across languages", () => {
    const runner = new EngineRunner(
      rules,
      { "toy/no-user-logging": "warn" },
      adapters,
    );
    const found = runner.lintSource("call logger(user)", "d.toy");
    assert.strictEqual(found[0].severity, "warn");
  });
});

void test("create() runs once per file for adapter-based runs", () => {
  let created = 0;
  const counting = defineToyRule({
    id: "toy/counting",
    description: "counts create calls",
    create() {
      created++;
      return {};
    },
  });
  const runner = new EngineRunner([counting], {}, toyOnly);
  runner.lintSource("set a = 1\nset b = 2\nset c = 3", "e.toy");
  assert.strictEqual(created, 1);
});

void test("assertLanguagesRegistered rejects rules for unknown languages", () => {
  const cobolRule = defineToyRule({
    id: "x/y",
    description: "wrong language",
    create: () => ({}),
  });
  const orphan: AnyRule = { ...cobolRule, language: "cobol" };

  assert.throws(
    () => assertLanguagesRegistered(toyOnly, [orphan]),
    /targets language "cobol"/,
  );
  assert.throws(
    () => new EngineRunner([orphan], {}, toyOnly),
    /targets language "cobol"/,
  );
  // The default language needs an adapter too once adapters are registered.
  assert.throws(
    () => new EngineRunner([plainRule], {}, toyOnly),
    /targets language "typescript"/,
  );
  // No adapters registered: legacy mode, nothing to validate.
  assert.doesNotThrow(() => new EngineRunner([orphan]));
});

// ---- Compile-time checks (enforced by `npm run typecheck`).

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

// Today's Rule visitor type is exactly the TypeScript vocabulary.
export const visitorsAreIdentical: Equal<
  ReturnType<Rule["create"]>,
  Visitors<TsNodes>
> = true;

// Any Rule<N> can sit in a mixed list without casts.
export const anyRules: AnyRule[] = [plainRule, tsNoEval, toyNoUserLogging];

void test("rule helpers reject unknown visitor names (see typecheck)", () => {
  defineToyRule({
    id: "toy/typo",
    description: "typo only",
    // @ts-expect-error not a toy node type (reported on create)
    create() {
      return { Cal() {} };
    },
  });
  // @ts-expect-error a typo next to a valid visitor is rejected too
  defineToyRule({
    id: "toy/mixed-typo",
    description: "typo next to a valid visitor",
    create() {
      return { Call() {}, Cal() {} };
    },
  });
  defineTsRule({
    id: "ts/typo",
    description: "ESTree typo",
    // @ts-expect-error not an ESTree node type (reported on create)
    create() {
      return { CallExpresion() {} };
    },
  });
  defineToyRule({
    id: "toy/wrong-field",
    description: "toy nodes have no callee.name",
    create() {
      return {
        Call(node) {
          // @ts-expect-error toy nodes have no `callee.name`
          void node.callee.name;
        },
      };
    },
  });
});

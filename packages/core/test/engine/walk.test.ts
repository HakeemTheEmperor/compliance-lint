import { test } from "node:test";
import * as assert from "node:assert";
import { walkTypedTree } from "../../src/engine/walk";

interface Node {
  type: string;
  parent?: Node;
  [key: string]: unknown;
}

void test("walkTypedTree visits parents first and assigns parent pointers", () => {
  const leaf = { type: "Leaf" };
  const child = { type: "Child", items: [leaf] };
  const root = { type: "Root", body: [child] };

  const order: string[] = [];
  walkTypedTree(root, (type) => order.push(type));

  assert.deepStrictEqual(order, ["Root", "Child", "Leaf"]);
  assert.strictEqual((root as Node).parent, undefined);
  assert.strictEqual((child as Node).parent, root);
  assert.strictEqual((leaf as Node).parent, child);
});

void test("walkTypedTree passes the parent through plain wrapper objects", () => {
  const inner = { type: "Inner" };
  const root = { type: "Root", wrapper: { notANode: [{ nested: inner }] } };

  walkTypedTree(root, () => undefined);
  assert.strictEqual((inner as Node).parent, root);
});

void test("walkTypedTree does not descend into loc, range, tokens, comments or parent", () => {
  const hidden = { type: "Hidden" };
  const root = {
    type: "Root",
    loc: { type: "Loc", hidden },
    range: [0, 1],
    tokens: [{ type: "Token" }],
    comments: [{ type: "Line" }],
  };

  const seen: string[] = [];
  walkTypedTree(root, (type) => seen.push(type));
  assert.deepStrictEqual(seen, ["Root"]);
});

void test("walkTypedTree ignores non-object input", () => {
  assert.doesNotThrow(() => walkTypedTree(null, () => undefined));
  assert.doesNotThrow(() => walkTypedTree("text", () => undefined));
});

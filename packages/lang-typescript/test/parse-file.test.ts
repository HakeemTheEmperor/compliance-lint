import { test } from "node:test";
import * as assert from "node:assert";
import { parseSource } from "../src/parse-file";

void test("parseSource enables JSX only for JSX-capable extensions", () => {
  assert.doesNotThrow(() => parseSource("const a = <div/>;", "a.tsx"));
  assert.doesNotThrow(() => parseSource("const a = <string>b;", "a.ts"));
});

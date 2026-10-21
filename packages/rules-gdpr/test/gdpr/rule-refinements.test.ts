import { test } from "node:test";
import * as assert from "node:assert";
import { parse } from "@typescript-eslint/typescript-estree";
import { EngineRunner } from "@complinter/core";
import { Rule } from "@complinter/core";
import { overlyBroadSelectRule } from "../../src/gdpr/overly-broad-select";
import { unprotectedExportRouteRule } from "../../src/gdpr/unprotected-export-route";
import { missingErasureCascadeRule } from "../../src/gdpr/missing-erasure-cascade";
import { explicitPiiLoggingRule } from "../../src/gdpr/explicit-pii-logging";
import { thirdPartyPiiLeakRule } from "../../src/gdpr/third-party-pii-leak";
import { minimalDataCollectedRule } from "../../src/gdpr/minimal-data-collected";

function count(rule: Rule, code: string): number {
  return new EngineRunner([rule]).run(parse(code, { loc: true })).length;
}

void test("overly-broad-select ignores non data-access receivers", () => {
  assert.strictEqual(
    count(overlyBroadSelectRule, "items.find(x => x.id === 1);"),
    0,
  );
  assert.strictEqual(count(overlyBroadSelectRule, "userRepo.find();"), 1);
});

void test("unprotected-export-route honours class-level guards and whole words", () => {
  const guarded = `
    @UseGuards(AuthGuard)
    class C { @Get('export') exportAll() {} }
  `;
  assert.strictEqual(count(unprotectedExportRouteRule, guarded), 0);
  assert.strictEqual(
    count(unprotectedExportRouteRule, "class C { extractToken() {} }"),
    0,
  );
  assert.strictEqual(
    count(unprotectedExportRouteRule, "class C { exportUserData() {} }"),
    1,
  );
});

void test("missing-erasure-cascade accepts enum members and SET NULL", () => {
  const rel = (value: string) =>
    `class A { @ManyToOne(() => U, { onDelete: ${value} }) user!: U; }`;
  assert.strictEqual(
    count(missingErasureCascadeRule, rel("OnDeleteType.CASCADE")),
    0,
  );
  assert.strictEqual(count(missingErasureCascadeRule, rel("'SET NULL'")), 0);
  assert.strictEqual(count(missingErasureCascadeRule, rel("'RESTRICT'")), 1);
});

void test("logging and outbound rules see template literals, objects and chains", () => {
  assert.strictEqual(
    count(explicitPiiLoggingRule, "console.log(`user: ${user}`);"),
    1,
  );
  assert.strictEqual(
    count(explicitPiiLoggingRule, "logger.info({ user });"),
    1,
  );
  assert.strictEqual(
    count(explicitPiiLoggingRule, "logger.info(req?.body);"),
    1,
  );
  assert.strictEqual(
    count(thirdPartyPiiLeakRule, "axios.post(url, { data: body });"),
    1,
  );
  assert.strictEqual(
    count(thirdPartyPiiLeakRule, "axios.post(url, { id: 1 });"),
    0,
  );
});

void test("minimal-data-collected covers @Delete routes", () => {
  const code = "class C { @Delete() remove(@Body() b: any) {} }";
  assert.strictEqual(count(minimalDataCollectedRule, code), 1);
});

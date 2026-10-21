import { test } from "node:test";
import * as assert from "node:assert";
import { lintText } from "complinter/plugin-api";
import { piiInUrlRule } from "../src";

const lint = (code: string) => lintText([piiInUrlRule], code);
const messages = (code: string) => lint(code).map((v) => v.message);

void test("nestjs/pii-in-url flags personal data in route paths", async (t) => {
  await t.test("path parameter on a method route", () => {
    const found = lint(`
      @Controller("users")
      export class UsersController {
        @Get(":email")
        findByEmail(@Param("email") email: string) {}
      }
    `);
    // The route path and the @Param both leak the email
    assert.strictEqual(found.length, 2);
    assert.ok(found.every((v) => v.ruleId === "nestjs/pii-in-url"));
    assert.match(found[0].message, /':email'/);
  });

  await t.test("nested path segments and every HTTP method", () => {
    for (const method of ["Get", "Post", "Put", "Patch", "Delete", "All"]) {
      const found = lint(`
        @Controller()
        class C { @${method}("accounts/:ssn/history") run() {} }
      `);
      assert.strictEqual(found.length, 1, method);
      assert.match(found[0].message, /':ssn'/);
    }
  });

  await t.test("path parameter on the controller prefix", () => {
    const found = lint('@Controller("customers/:phoneNumber") class C {}');
    assert.strictEqual(found.length, 1);
    assert.match(found[0].message, /':phoneNumber'/);
  });

  await t.test("array paths, template literals and modifiers", () => {
    assert.strictEqual(
      lint('class C { @Get(["a/:email", "b/:id"]) run() {} }').length,
      1,
    );
    assert.strictEqual(lint("class C { @Get(`x/:email`) run() {} }").length, 1);
    assert.strictEqual(
      lint('class C { @Get("x/:email?") run() {} }').length,
      1,
    );
    assert.strictEqual(
      lint('class C { @Get("x/:dateOfBirth(\\\\d+)") run() {} }').length,
      1,
    );
  });

  await t.test("naming variants are matched", () => {
    for (const name of [
      "email",
      "emailAddress",
      "email_address",
      "phone",
      "nin",
      "bvn",
      "passportNumber",
      "dob",
      "creditCardNumber",
      "iban",
      "password",
    ]) {
      assert.strictEqual(
        lint(`class C { @Get("x/:${name}") run() {} }`).length,
        1,
        name,
      );
    }
  });
});

void test("nestjs/pii-in-url flags personal data in @Param and @Query", async (t) => {
  await t.test("@Query with a PII name", () => {
    const found = lint(`
      class C {
        @Get()
        search(@Query("email") email: string, @Query("page") page: number) {}
      }
    `);
    assert.strictEqual(found.length, 1);
    assert.match(found[0].message, /Query parameter 'email'/);
  });

  await t.test("@Param with a PII name and a pipe argument", () => {
    const found = lint(`
      class C {
        @Delete(":id")
        remove(@Param("ssn", ParseSsnPipe) ssn: string) {}
      }
    `);
    assert.strictEqual(found.length, 1);
    assert.match(found[0].message, /Path parameter 'ssn'/);
  });

  await t.test("reports on the offending argument", () => {
    const [violation] = lint(
      ["class C {", "  @Get()", '  q(@Query("email") e: string) {}', "}"].join(
        "\n",
      ),
    );
    assert.strictEqual(violation.line, 3);
  });
});

void test("nestjs/pii-in-url accepts safe routes", async (t) => {
  await t.test("opaque identifiers and non-PII parameters", () => {
    assert.deepStrictEqual(
      messages(`
        @Controller("users")
        class C {
          @Get(":id")
          one(@Param("id") id: string, @Query("page") page: number) {}
          @Get("by-email-lookup")
          static() {}
        }
      `),
      [],
    );
  });

  await t.test("PII sent in the body is not a URL concern", () => {
    assert.deepStrictEqual(
      messages(`
        class C {
          @Post("lookup")
          find(@Body("email") email: string, @Body() dto: LookupDto) {}
        }
      `),
      [],
    );
  });

  await t.test("longer names that merely contain a PII word", () => {
    assert.deepStrictEqual(
      messages(
        'class C { @Get("x/:emailVerified/:phoneCountryCode") run() {} }',
      ),
      [],
    );
  });

  await t.test("decorators it does not understand are ignored", () => {
    assert.deepStrictEqual(
      messages(`
        class C {
          @Get(somePathConstant) a() {}
          @Get(...paths) b() {}
          @Custom("x/:email") c() {}
          d(@Query() all: Dto, @Query(name) one: string) {}
        }
      `),
      [],
    );
  });

  await t.test("inline suppression works", () => {
    assert.deepStrictEqual(
      messages(`
        class C {
          // compliance-ignore-next-line nestjs/pii-in-url
          @Get("x/:email") run() {}
        }
      `),
      [],
    );
  });
});

import { test } from "node:test";
import * as assert from "node:assert";
import { lintText } from "complinter/plugin-api";
import { unserializedSensitiveResponseRule } from "../src";

const lint = (code: string) =>
  lintText([unserializedSensitiveResponseRule], code);

void test("nestjs/unserialized-sensitive-response flags exposed fields", async (t) => {
  await t.test("handler return type is a class with a bare password", () => {
    const found = lint(`
      export class User {
        id: number;
        email: string;
        password: string;
      }

      @Controller("users")
      export class UsersController {
        @Get(":id")
        findOne(): Promise<User> { return this.users.find(); }
      }
    `);
    assert.strictEqual(found.length, 1);
    assert.strictEqual(
      found[0].ruleId,
      "nestjs/unserialized-sensitive-response",
    );
    assert.match(found[0].message, /'findOne\(\)' returns 'User'/);
    assert.match(found[0].message, /'password'/);
    // reported on the method name
    assert.strictEqual(found[0].line, 11);
  });

  await t.test("arrays, observables and unions are looked through", () => {
    const base = (returnType: string) => `
      class User { passwordHash: string; }
      @Controller()
      class C { @Get() list(): ${returnType} { return null as never; } }
    `;
    for (const type of [
      "User[]",
      "Promise<User[]>",
      "Promise<Array<User>>",
      "Observable<User>",
      "Promise<User | null>",
      "ReadonlyArray<User>",
    ]) {
      assert.strictEqual(lint(base(type)).length, 1, type);
    }
  });

  await t.test("returning a freshly constructed instance", () => {
    const found = lint(`
      class Account { apiKey: string; secret: string; }
      @Controller()
      class C {
        @Post()
        create() {
          const id = 1;
          return new Account();
        }
      }
    `);
    assert.strictEqual(found.length, 1);
    assert.match(found[0].message, /'apiKey', 'secret'/);
  });

  await t.test("every route decorator counts", () => {
    for (const method of ["Get", "Post", "Put", "Patch", "Delete", "All"]) {
      const found = lint(`
        class User { ssn: string; }
        @Controller()
        class C { @${method}() run(): User { return null as never; } }
      `);
      assert.strictEqual(found.length, 1, method);
    }
  });

  await t.test(
    "a field excluded for some fields only still flags the rest",
    () => {
      const found = lint(`
      class User {
        @Exclude() password: string;
        pin: string;
      }
      @Controller()
      class C { @Get() one(): User { return null as never; } }
    `);
      assert.strictEqual(found.length, 1);
      assert.match(found[0].message, /'pin'/);
      assert.doesNotMatch(found[0].message, /'password'/);
    },
  );

  await t.test("works with classes declared as default exports", () => {
    const found = lint(`
      export default class User { password: string; }
      @Controller()
      class C { @Get() one(): User { return null as never; } }
    `);
    assert.strictEqual(found.length, 1);
  });
});

void test("nestjs/unserialized-sensitive-response accepts protected responses", async (t) => {
  await t.test("sensitive fields carry @Exclude()", () => {
    assert.deepStrictEqual(
      lint(`
        class User {
          id: number;
          @Exclude() password: string;
          @Exclude({ toPlainOnly: true }) salt: string;
        }
        @UseInterceptors(ClassSerializerInterceptor)
        @Controller()
        class C { @Get() one(): Promise<User> { return null as never; } }
      `),
      [],
    );
  });

  await t.test("class-level @Exclude() hides everything not @Expose()d", () => {
    assert.deepStrictEqual(
      lint(`
        @Exclude()
        class User {
          @Expose() email: string;
          password: string;
        }
        @Controller()
        class C { @Get() one(): User { return null as never; } }
      `),
      [],
    );
    // ...but an @Expose()d sensitive field is exposed on purpose and flagged
    assert.strictEqual(
      lint(`
        @Exclude()
        class User { @Expose() password: string; }
        @Controller()
        class C { @Get() one(): User { return null as never; } }
      `).length,
      1,
    );
  });

  await t.test(
    "@SerializeOptions excludeAll strategy on the handler or controller",
    () => {
      for (const placement of ["method", "controller"]) {
        const options = `@SerializeOptions({ strategy: "excludeAll" })`;
        assert.deepStrictEqual(
          lint(`
          class User { @Expose() email: string; password: string; }
          ${placement === "controller" ? options : ""}
          @Controller()
          class C {
            ${placement === "method" ? options : ""}
            @Get() one(): User { return null as never; }
          }
        `),
          [],
          placement,
        );
      }
    },
  );

  await t.test("returning a DTO without sensitive fields", () => {
    assert.deepStrictEqual(
      lint(`
        class User { id: number; email: string; password: string; }
        class UserDto { id: number; email: string; }
        @Controller()
        class C { @Get() one(): Promise<UserDto> { return null as never; } }
      `),
      [],
    );
  });
});

void test("nestjs/unserialized-sensitive-response only reports what it can see", async (t) => {
  await t.test("classes declared in other files are not inspected", () => {
    assert.deepStrictEqual(
      lint(`
        import { User } from "./user.entity";
        @Controller()
        class C { @Get() one(): Promise<User> { return null as never; } }
      `),
      [],
    );
  });

  await t.test("only controller route handlers are checked", () => {
    assert.deepStrictEqual(
      lint(`
        class User { password: string; }
        @Controller()
        class C { helper(): User { return null as never; } }
        class NotAController { @Get() one(): User { return null as never; } }
        @Injectable()
        class Service { find(): User { return null as never; } }
      `),
      [],
    );
  });

  await t.test("untyped handlers and non-class returns are ignored", () => {
    assert.deepStrictEqual(
      lint(`
        class User { password: string; }
        @Controller()
        class C {
          @Get() a() { return this.users.find(); }
          @Get() b(): string { return "x"; }
          @Get() c(): void {}
          @Get() d() { const make = () => { return new User(); }; return make; }
        }
      `),
      [],
    );
  });

  await t.test("inline suppression works", () => {
    assert.deepStrictEqual(
      lint(`
        class User { password: string; }
        @Controller()
        class C {
          // compliance-ignore-next-line nestjs/unserialized-sensitive-response
          @Get() one(): User { return null as never; }
        }
      `),
      [],
    );
  });
});

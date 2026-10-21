# `nestjs/unserialized-sensitive-response`

Flags NestJS route handlers that return a class declaring sensitive fields (such as `password`) that are not hidden with `@Exclude()`. Without it the field is serialized into the JSON response, exposing credentials and other secrets to the client (GDPR Articles 5(1)(c) and 32).

Default severity: `error`.

## Bad example

```ts
export class User {
  id: number;
  email: string;
  password: string; // returned to the client
}

@Controller("users")
export class UsersController {
  @Get(":id")
  findOne(): Promise<User> {
    return this.users.find();
  }
}
```

## Good example

```ts
export class User {
  id: number;
  email: string;

  @Exclude()
  password: string;
}

@UseInterceptors(ClassSerializerInterceptor)
@Controller("users")
export class UsersController {
  @Get(":id")
  findOne(): Promise<User> {
    return this.users.find();
  }
}
```

Returning a separate DTO without the sensitive field, or using `@Exclude()` on the class with `@Expose()` on the fields to send, is also accepted. `@Exclude()` only takes effect when responses go through `ClassSerializerInterceptor` (on the controller or registered globally); remember to enable it.

## What it checks

- A handler is a method with `@Get`, `@Post`, `@Put`, `@Patch`, `@Delete` or `@All` inside a class decorated with `@Controller`.
- It finds the classes the handler returns from the return type annotation (looking through `Promise<>`, `Observable<>`, `Array<>`, `ReadonlyArray<>`, `T[]` and unions) and from `return new ClassName(...)` statements.
- Only classes **declared in the same file** are inspected. A field is sensitive when, ignoring case and non-alphanumeric characters, it is one of: `password`, `passwordHash`, `hashedPassword`, `passwd`, `salt`, `secret`, `apiKey`, `refreshToken`, `twoFactorSecret`, `ssn`, `socialSecurityNumber`, `pin`, `bvn`, `nin`, `cardNumber`, `creditCard`, `cvv`.
- A sensitive field is hidden when it has `@Exclude()`, or when the class has `@Exclude()` (or the handler or controller uses `@SerializeOptions({ strategy: "excludeAll" })`) and the field has no `@Expose()`.
- One report is made per handler and returned class, on the method name, listing every exposed field.

## Relationship to the built-in rules

Checked against the built-in GDPR rules:

- `gdpr/pii-unhashed-storage` flags a sensitive field in an entity that has none of `@Hash`, `@Exclude`, `@Encrypt` or `@Transform`. When such an entity is declared in the same file as the controller returning it, both rules report: that rule at the field (storage), this rule at the handler (response). They describe different risks and either can be configured separately.
- A hashed field (`@Hash()`) satisfies the storage rule but is still reported here, because a password hash must not be sent to clients either.
- `@Exclude()` satisfies both rules.
- `gdpr/unencrypted-pii-column` covers a different field list (bank and identity numbers in stored columns).

## Known limitations

- It only sees classes declared in the same file as the controller. The common NestJS layout keeps entities in their own files, and those are not inspected, so this rule reports nothing for them. Returning an imported entity is invisible to it.
- It does not check that `ClassSerializerInterceptor` is actually registered, so `@Exclude()` without the interceptor (which leaves the field exposed) is not reported. A global interceptor set up in `main.ts` cannot be seen from the controller file.
- Return types are read from annotations and `return new X()` only. Untyped handlers, values returned through variables or service calls, and `@Res()` responses are not followed.
- Interfaces and type aliases are not inspected, since they cannot carry `@Exclude()`.
- Field names must match the list; other sensitive data is not detected.

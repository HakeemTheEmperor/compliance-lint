# `nestjs/pii-in-url`

Flags NestJS routes that carry personal data in the URL: path parameters in `@Get(":email")`-style routes and controller prefixes, and `@Param("email")` / `@Query("email")` parameters. URLs are written to access logs, proxies, browser history and analytics, so personal data placed in them is retained far beyond what the request needs (GDPR Articles 5(1)(c) and 32).

Default severity: `error`.

## Bad example

```ts
@Controller("users")
export class UsersController {
  @Get(":email")
  findByEmail(@Param("email") email: string) {}

  @Get()
  search(@Query("phoneNumber") phone: string) {}
}
```

## Good example

```ts
@Controller("users")
export class UsersController {
  @Get(":id")
  findOne(@Param("id") id: string) {}

  @Post("lookup")
  findByEmail(@Body() dto: LookupByEmailDto) {}
}
```

Use an opaque identifier in the URL, or send the personal data in the request body.

## What it checks

- String paths in `@Get`, `@Post`, `@Put`, `@Patch`, `@Delete`, `@All`, `@Head`, `@Options` and `@Controller`. Plain strings, template literals without expressions and arrays of those are read. Each `:segment` is a path parameter; modifiers such as `:id?` and `:id(\d+)` are stripped.
- The first argument of `@Param(...)` and `@Query(...)` when it is a string.
- A name matches when, ignoring case and any non-alphanumeric characters, it is one of: `email`, `emailAddress`, `phone`, `phoneNumber`, `mobile`, `mobileNumber`, `ssn`, `socialSecurityNumber`, `nin`, `bvn`, `passport`, `passportNumber`, `dob`, `dateOfBirth`, `birthDate`, `creditCard`, `creditCardNumber`, `cardNumber`, `iban`, `bankAccount`, `password`, `passwd`. So `email_address` matches but `emailVerified` does not.

## Relationship to the built-in rules

Checked against the built-in GDPR rules so the two do not repeat each other:

- `gdpr/unprotected-export-route` also reads route strings, but only for export-like words and a missing guard. A guarded `@Get("export/:email")` is reported only by this rule; an unguarded one is reported by both, for different reasons.
- `gdpr/minimal-data-collected` is about untyped `@Body()` parameters; this rule never looks at bodies.
- `gdpr/explicit-pii-logging` and `gdpr/third-party-pii-leak` look at values passed to loggers and HTTP clients, not at route definitions.

## Known limitations

- Names must match the list exactly after normalisation. Other personal data (`username`, `address`, custom names) is not detected, and a risky value hidden behind an opaque name is invisible.
- Only string-literal decorator arguments are read. Paths held in constants or spread from variables are ignored.
- `@Query()` and `@Param()` without a name (whole-object DTOs) are not inspected, so a `FindUserQueryDto` with an `email` field is not flagged.
- It recognises the decorators by name, so aliased imports of `Get`, `Param` and friends are not seen.
- It cannot tell that an `email` path parameter is intentionally public data.

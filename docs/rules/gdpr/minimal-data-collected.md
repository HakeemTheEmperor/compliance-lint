# `gdpr/minimal-data-collected`

Requires route handlers that accept `@Body()` to use a structured type instead of an unconstrained request body. This supports GDPR Article 5(1)(c), but does not determine whether the DTO contains only necessary fields.

## Bad example

```ts
@Post("users")
createUser(@Body() payload: any) {
  return this.users.create(payload);
}
```

## Good example

```ts
@Post("users")
createUser(@Body() payload: CreateUserDto) {
  return this.users.create(payload);
}
```

## Known limitations

- Only method decorators named `Post`, `Put`, `Patch`, `Get`, or `Route` are considered routes.
- Only direct identifier parameters with a `Body` decorator are inspected.
- It flags a missing type and `any`, but does not inspect DTO fields or validate runtime input.

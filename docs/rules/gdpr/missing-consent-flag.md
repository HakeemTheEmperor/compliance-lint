# `gdpr/missing-consent-flag`

Checks registration-like methods for a parameter whose type name indicates consent or terms acceptance, supporting GDPR Articles 6 and 7.

## Bad example

```ts
registerUser(@Body() dto: CreateUserDto) {
  return this.authService.register(dto);
}
```

## Good example

```ts
registerUser(@Body() dto: CreateUserWithConsentDto) {
  return this.authService.register(dto);
}
```

## Known limitations

- Method names are matched by substrings such as `register`, `signup`, `create`, `onboard`, and `subscribe`.
- It accepts a parameter type whose name contains a consent keyword, or a class declared **in the same file** with a property containing one. DTOs imported from other files are only matched by name.
- It does not check decorators, validation logic, or the runtime value of a consent flag.
- A type name containing a keyword can satisfy the rule even when the type has no consent field.

# `gdpr/unprotected-export-route`

Flags methods or route paths that look like exports, downloads, backups, or data extraction unless a recognized authentication or authorization decorator is present.

## Bad example

```ts
@Get("export-data")
exportData() {
  return this.userService.dumpAllData();
}
```

## Good example

```ts
@UseGuards(JwtAuthGuard)
@Get("download-backup")
downloadBackup() {
  return this.userService.generateBackup();
}
```

## Known limitations

- Export-like words (`export`, `exports`, `download`, `dump`, `backup`) are matched as whole words in method names (split on camelCase, `_` and `-`) and in string arguments of decorators, so `exportUserData` and `/export-data` match but `extractToken` does not.
- A guard on the enclosing controller class (for example `@UseGuards(...)` on the class) protects all of its methods.
- Accepted security decorators include `UseGuards`, `Auth`, `JwtAuthGuard`, `Roles`, `ApiKeyGuard`, and `Authenticated`.
- It does not evaluate guard configuration, route-level middleware, policy checks, or whether an endpoint actually returns personal data.

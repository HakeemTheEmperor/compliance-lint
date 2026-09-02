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

- Export-like keywords are matched in method names and string arguments of decorators.
- Accepted security decorators include `UseGuards`, `Auth`, `JwtAuthGuard`, `Roles`, `ApiKeyGuard`, and `Authenticated`.
- It does not evaluate guard configuration, route-level middleware, policy checks, or whether an endpoint actually returns personal data.

# complinter

## 1.1.0

### Minor Changes

- 4c517b7: Add an experimental plugin system. List plugins under `plugins` in `compliance.json` (installed packages, or `./` files inside the project) to add rules in their own namespace; plugin problems stop the run with exit code 2. Plugin authors import `complinter/plugin-api` and list `complinter` as a peer dependency (see docs/plugins.md). Existing rule ids, default severities, CLI flags, output and exit codes are unchanged.
  
  The built-in GDPR rules and the TypeScript parser are now bundled packages inside `complinter`; `@typescript-eslint/typescript-estree` remains the only runtime dependency. The first official plugin, `@complinter/plugin-nestjs`, lives in this repository and is not yet published.

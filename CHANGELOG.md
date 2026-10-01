# Changelog

## Unreleased

### Fixed

- Rules are now instantiated once per file instead of once per AST node, so rule state survives the walk. `gdpr/missing-consent-flag` can finally see `consent` properties on local DTO classes.
- The result cache is invalidated when the tool version, rule set, or rule severities change.
- Severity is decided once (by the runner); the console reporter uses the violation's severity.
- Files that cannot be read or parsed now fail the run (exit code 2) instead of being silently skipped.
- A missing target directory produces a clear error instead of a stack trace.
- A malformed `compliance.json` (bad JSON, invalid severity, wrong types) is now an error instead of silently falling back to the defaults.
- `.tsx`, `.js`, `.jsx`, `.mts` and `.cts` files are scanned; `.d.ts` files are skipped. JSX parsing is only enabled for extensions that can contain it.

### Changed

- `gdpr/overly-broad-select` only flags data-access receivers (repositories, models, services, ...), not `Array.find()`.
- `gdpr/unprotected-export-route` matches whole words (no longer flags `extractToken`) and honours class-level `@UseGuards`.
- `gdpr/missing-erasure-cascade` accepts `OnDeleteType.CASCADE`-style members and `SET NULL`.
- `gdpr/explicit-pii-logging` and `gdpr/third-party-pii-leak` inspect template literals, object literals, spreads and optional chains.
- `gdpr/minimal-data-collected` also covers `@Delete()` and `@All()` routes.

### Added

- CLI flags: `--help`, `--version`, `--config`, `--format console|json|sarif`, `--no-cache`.
- JSON and SARIF 2.1.0 reporters.
- Inline suppression: `// compliance-ignore-next-line [rule-id ...]` and trailing `// compliance-ignore [rule-id ...]`.
- Pull-request CI workflow; the publish workflow now lints and tests first.
- LICENSE, package metadata, `test:coverage` script.

### Internal

- Converted the repository to an npm workspaces monorepo: `packages/core`, `packages/lang-typescript`, `packages/rules-gdpr` and `packages/complinter` (the CLI). Pure move; behavior, rule ids, config, CLI output and exit codes are unchanged (verified by the golden-output tests).
- Added a language adapter abstraction (`LanguageAdapter`, `Rule<Nodes>`, `AnyRule`, `createRuleFactory`, `eraseAdapter`) in `@complinter/core` and a `typescriptAdapter` in `@complinter/lang-typescript`. The runner picks the adapter by file extension and runs only the rules for that language; file discovery asks the runner which files it supports. `RuleContext` now also provides `filename` and `sourceText`. Existing rules, `EngineRunner.run(ast)` and all outputs are unchanged.
- Added `npm run typecheck` (also run in CI) so type-level tests are enforced.
- Tests run through `scripts/run-tests.mjs`, which expands test files itself instead of relying on shell or Node glob support.
- The workspace packages are not published yet; `complinter` is marked `private` until the build bundles its internal packages.

### Removed

- Unused `src/engine/parser.ts`, the `src/test-run.ts` scratch script and its fixture.

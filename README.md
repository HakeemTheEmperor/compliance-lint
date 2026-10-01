# ComplianceLint

**"ESLint for Legal Compliance"**

ComplianceLint is a static analysis CLI tool that bridges the gap between regulatory frameworks and software engineering. It parses TypeScript and JavaScript code (`.ts`, `.tsx`, `.js`, `.jsx`, `.mts`, `.cts`) into an Abstract Syntax Tree (AST) to detect privacy-related risks directly within local development and CI/CD pipelines.

The current MVP ships with 10 heuristic GDPR rules. It is a developer aid, not legal advice: a clean scan cannot establish compliance and a finding needs review in the context of the application and applicable law.

## 🚀 Features

- **AST-Based Precision:** Uses `@typescript-eslint/typescript-estree` for highly accurate code analysis, minimizing false positives.
- **Framework Aware:** Recognizes common NestJS, Express, TypeORM, and Sequelize naming and decorator patterns.
- **CI/CD Ready:** Fails the pipeline if critical compliance rules are violated, preventing regulatory risks from reaching production.
- **Customizable:** Easily toggle rules and severity via `compliance.json`, or suppress a single finding inline.
- **Multiple outputs:** Human-readable console output, JSON, and SARIF 2.1.0 for GitHub code scanning.

## 📦 Installation

Install the package as a development dependency:

```bash
npm install --save-dev complinter
```

## 🛠️ Usage

### Local Execution

Run the scanner directly from your terminal:

```bash
npx complint [options] [directory]
```

| Option                | Description                                                      |
| --------------------- | ---------------------------------------------------------------- |
| `-c, --config <file>` | Config file to use (default: `./compliance.json`)               |
| `-f, --format <fmt>`  | `console` (default), `json`, or `sarif`                          |
| `--no-cache`          | Skip the result cache (`.gdpr-cache.json`)                       |
| `-h, --help`          | Show usage                                                       |
| `-v, --version`       | Print the version                                                |

### Exit codes

| Code | Meaning                                                                                     |
| ---- | ------------------------------------------------------------------------------------------- |
| `0`  | No error-level violations (warnings do not fail the run)                                    |
| `1`  | One or more error-level violations                                                          |
| `2`  | Usage, config or file problems, e.g. a bad flag, malformed `compliance.json`, or a file that cannot be parsed |

### CI example (GitHub code scanning)

```yaml
- run: npx complint --format sarif src > complint.sarif || true
- uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: complint.sarif
```

To fail the build instead, just run `npx complint src`; the exit code does the work.

### NPM Scripts (Recommended)

Add a script to your `package.json` for easy execution and CI/CD integration:

```json
{
  "scripts": {
    "lint:compliance": "complint"
  }
}
```

Run it via:

```bash
npm run lint:compliance
```

## ⚙️ Configuration

Create a `compliance.json` file in the root of your project to customize the scanner's behavior. If omitted, the default settings are applied. The optional CLI directory argument defaults to `src`.

```json
{
  "ignore": ["node_modules", "dist", "**/*.spec.ts", "**/*.test.ts"],
  "rules": {
    "gdpr/minimal-data-collected": "error",
    "gdpr/pii-unhashed-storage": "error",
    "gdpr/data-retention-missing": "warn",
    "gdpr/explicit-pii-logging": "error",
    "gdpr/overly-broad-select": "warn",
    "gdpr/missing-consent-flag": "off"
  }
}
```

`rules` accepts `error`, `warn`, or `off`. Rules you omit keep their defaults.

`ignore` entries are matched against paths relative to the scanned directory. A plain name (`node_modules`) matches a file or directory of that name; patterns may use `*`, `**` and `?`. Providing `ignore` **replaces** the default list (`node_modules`, `dist`, and spec/test files), so include those entries if you still want them ignored.

Invalid configuration (malformed JSON, an unknown severity, a non-array `ignore`) stops the run with exit code 2 rather than silently using defaults. Unknown rule ids only produce a warning.

### Suppressing a finding

```ts
// compliance-ignore-next-line gdpr/explicit-pii-logging
console.log(user);

console.log(user); // compliance-ignore gdpr/explicit-pii-logging
```

Omit the rule id to suppress every rule on that line. Use suppressions sparingly and explain why in a nearby comment.

## Included Rules (MVP)

| Rule                                                                           | Purpose                           | Details                                                                                                                 |
| ------------------------------------------------------------------------------ | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| [`gdpr/minimal-data-collected`](docs/rules/gdpr/minimal-data-collected.md)     | Require structured request bodies | Flags route methods with `@Body()` parameters that have no type or use `any`.                                           |
| [`gdpr/overly-broad-select`](docs/rules/gdpr/overly-broad-select.md)           | Limit query fields                | Flags `find`, `findOne`, `findAndCount`, and `findAll` calls on repository/model/service-like receivers without an options object containing `select`.             |
| [`gdpr/data-retention-missing`](docs/rules/gdpr/data-retention-missing.md)     | Require retention signals         | Checks `@Entity()` classes and classes extending `Model` for recognized retention fields or decorators.                 |
| [`gdpr/explicit-pii-logging`](docs/rules/gdpr/explicit-pii-logging.md)         | Reduce sensitive logging          | Flags known sensitive identifiers and request/user properties passed to recognized logger calls.                        |
| [`gdpr/missing-consent-flag`](docs/rules/gdpr/missing-consent-flag.md)         | Require consent-related DTOs      | Checks registration-like methods for a parameter type that has a consent property (in a class declared in the same file) or a consent keyword in its name.                            |
| [`gdpr/missing-erasure-cascade`](docs/rules/gdpr/missing-erasure-cascade.md)   | Preserve deletion propagation     | Flags `ManyToOne`, `OneToOne`, and `BelongsTo` relations without `onDelete` of `CASCADE` or `SET NULL`.                                 |
| [`gdpr/pii-unhashed-storage`](docs/rules/gdpr/pii-unhashed-storage.md)         | Protect highly sensitive fields   | Flags exact field names such as `password`, `ssn`, `pin`, and `social_security` without an accepted security decorator. |
| [`gdpr/third-party-pii-leak`](docs/rules/gdpr/third-party-pii-leak.md)         | Review outbound PII transfers     | Flags known payload identifiers and request/user properties passed to recognized HTTP clients.                          |
| [`gdpr/unencrypted-pii-column`](docs/rules/gdpr/unencrypted-pii-column.md)     | Encrypt high-risk columns         | Flags exact high-risk field names in TypeORM entities or Sequelize models without encryption or a transformer.          |
| [`gdpr/unprotected-export-route`](docs/rules/gdpr/unprotected-export-route.md) | Protect data exports              | Flags export-like methods or route paths without a recognized auth decorator.                                           |

Each rule page includes accepted examples and known limitations. These rules use names, decorators, and local syntax patterns; they do not perform data-flow analysis or prove that a runtime control is effective.

## Development

```bash
npm install
npm test
npm run test:coverage
npm run lint
npm run build
```

## Publishing

Publishing is automated by [`.github/workflows/publish.yml`](.github/workflows/publish.yml) when a GitHub release is published.

Before the first release:

1. Create the `complinter` package on npm, or confirm that the package is owned by the publishing account.
2. In npm package settings, add a trusted publisher for this repository, the `main` branch, and the `publish.yml` workflow.
3. Update the version in `package.json` and commit it to `main`.
4. Create and publish a GitHub release whose tag matches that version, for example `v1.0.1` if the version in `package.json` is `1.0.1`.

The workflow uses npm trusted publishing with OIDC and package provenance, so no `NPM_TOKEN` repository secret is required. To publish manually instead, run `npm login`, then `npm publish --access public` from the repository root.

## 🤝 Contributing

We welcome contributions! Add focused tests for new AST behavior and keep rule documentation alongside the implementation. See the [Contributing Guide](CONTRIBUTING.md) for setup, development workflow, rule authoring, testing, and pull request guidance.

# ComplianceLint

**"ESLint for Legal Compliance"**

ComplianceLint is a static analysis CLI tool that bridges the gap between regulatory frameworks and software engineering. It parses TypeScript code into an Abstract Syntax Tree (AST) to detect privacy-related risks directly within local development and CI/CD pipelines.

The current MVP ships with 10 heuristic GDPR rules. It is a developer aid, not legal advice: a clean scan cannot establish compliance and a finding needs review in the context of the application and applicable law.

## 🚀 Features

- **AST-Based Precision:** Uses `@typescript-eslint/typescript-estree` for highly accurate code analysis, minimizing false positives.
- **Framework Aware:** Recognizes common NestJS, Express, TypeORM, and Sequelize naming and decorator patterns.
- **CI/CD Ready:** Fails the pipeline if critical compliance rules are violated, preventing regulatory risks from reaching production.
- **Customizable:** Easily toggle rules and severity via `compliance.json`.

## 📦 Installation

Install the package as a development dependency:

```bash
npm install --save-dev complinter
```

## 🛠️ Usage

### Local Execution

Run the scanner directly from your terminal:

```bash
npx complint [directory]
```

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
  "ignore": ["node_modules", "dist", ".git"],
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

`rules` accepts `error`, `warn`, or `off`. The current file walker compares ignored directory and file names literally; glob-style patterns such as `**/*.spec.ts` are not expanded. Unknown rules in the configuration are ignored unless they are registered by the scanner.

## Included Rules (MVP)

| Rule                                                                           | Purpose                           | Details                                                                                                                 |
| ------------------------------------------------------------------------------ | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| [`gdpr/minimal-data-collected`](docs/rules/gdpr/minimal-data-collected.md)     | Require structured request bodies | Flags route methods with `@Body()` parameters that have no type or use `any`.                                           |
| [`gdpr/overly-broad-select`](docs/rules/gdpr/overly-broad-select.md)           | Limit query fields                | Flags `find`, `findOne`, `findAndCount`, and `findAll` calls without an options object containing `select`.             |
| [`gdpr/data-retention-missing`](docs/rules/gdpr/data-retention-missing.md)     | Require retention signals         | Checks `@Entity()` classes and classes extending `Model` for recognized retention fields or decorators.                 |
| [`gdpr/explicit-pii-logging`](docs/rules/gdpr/explicit-pii-logging.md)         | Reduce sensitive logging          | Flags known sensitive identifiers and request/user properties passed to recognized logger calls.                        |
| [`gdpr/missing-consent-flag`](docs/rules/gdpr/missing-consent-flag.md)         | Require consent-related DTOs      | Checks registration-like methods for a parameter type whose name contains a consent keyword.                            |
| [`gdpr/missing-erasure-cascade`](docs/rules/gdpr/missing-erasure-cascade.md)   | Preserve deletion propagation     | Flags `ManyToOne`, `OneToOne`, and `BelongsTo` relations without `onDelete: "CASCADE"`.                                 |
| [`gdpr/pii-unhashed-storage`](docs/rules/gdpr/pii-unhashed-storage.md)         | Protect highly sensitive fields   | Flags exact field names such as `password`, `ssn`, `pin`, and `social_security` without an accepted security decorator. |
| [`gdpr/third-party-pii-leak`](docs/rules/gdpr/third-party-pii-leak.md)         | Review outbound PII transfers     | Flags known payload identifiers and request/user properties passed to recognized HTTP clients.                          |
| [`gdpr/unencrypted-pii-column`](docs/rules/gdpr/unencrypted-pii-column.md)     | Encrypt high-risk columns         | Flags exact high-risk field names in TypeORM entities or Sequelize models without encryption or a transformer.          |
| [`gdpr/unprotected-export-route`](docs/rules/gdpr/unprotected-export-route.md) | Protect data exports              | Flags export-like methods or route paths without a recognized auth decorator.                                           |

Each rule page includes accepted examples and known limitations. These rules use names, decorators, and local syntax patterns; they do not perform data-flow analysis or prove that a runtime control is effective.

## Development

```bash
npm install
npm test
npm run lint
npm run build
```

## 🤝 Contributing

We welcome contributions! Add focused tests for new AST behavior and keep rule documentation alongside the implementation. See the [Contributing Guide](CONTRIBUTING.md) for setup, development workflow, rule authoring, testing, and pull request guidance.

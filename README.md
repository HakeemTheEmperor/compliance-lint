# ComplianceLint 🛡️

**"ESLint for Legal Compliance"**

ComplianceLint is a static analysis CLI tool that bridges the gap between regulatory frameworks and software engineering. It parses your codebase into an Abstract Syntax Tree (AST) to detect data privacy violations (such as GDPR and NDPR non-compliance) directly within your development environment and CI/CD pipelines.

Instead of waiting for an external audit to flag hardcoded PII, missing retention policies, or unprotected export routes, ComplianceLint acts as automated legal counsel for your code.

## 🚀 Features

- **AST-Based Precision:** Uses `@typescript-eslint/typescript-estree` for highly accurate code analysis, minimizing false positives.
- **Framework Aware:** Scans backend architectures including NestJS, Express, TypeORM, and Sequelize.
- **CI/CD Ready:** Fails the pipeline if critical compliance rules are violated, preventing regulatory risks from reaching production.
- **Customizable:** Easily toggle rules and severity via `compliance.json`.

## 📦 Installation

Install the package as a development dependency:

```bash
npm install --save-dev compliance-lint
```

## 🛠️ Usage

### Local Execution

Run the scanner directly from your terminal:

```bash
npx compliance-lint
```

### NPM Scripts (Recommended)

Add a script to your `package.json` for easy execution and CI/CD integration:

```json
{
  "scripts": {
    "lint:compliance": "compliance-lint"
  }
}
```

Run it via:

```bash
npm run lint:compliance
```

## ⚙️ Configuration

Create a `compliance.json` file in the root of your project to customize the scanner's behavior. If omitted, default settings will be applied.

```json
{
  "ignore": ["node_modules", "dist", "**/*.spec.ts"],
  "rules": {
    "gdpr/minimal-data-collected": "error",
    "gdpr/pii-unhashed-storage": "error",
    "gdpr/data-retention-missing": "warn",
    "gdpr/explicit-pii-logging": "error"
  }
}
```

## 📜 Included Rules (MVP)

| Rule                          | Description                                                                    | Target Layer |
| ----------------------------- | ------------------------------------------------------------------------------ | ------------ |
| `gdpr/minimal-data-collected` | Flags DTO properties that are never used in service logic.                     | API          |
| `gdpr/pii-unhashed-storage`   | Detects sensitive fields (e.g., `ssn`, `password`) without hashing decorators. | Database     |
| `gdpr/data-retention-missing` | Checks for missing soft-delete (`deletedAt`) in user entities.                 | Database     |
| `gdpr/unencrypted-pii-column` | Identifies high-risk PII stored as raw varchars without encryption.            | Database     |
| `gdpr/explicit-pii-logging`   | Detects `console.log` passing raw request payloads or user objects.            | API          |

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details on how to write custom AST rules and submit pull requests.

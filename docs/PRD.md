# Product Requirements Document (PRD)

**Product Name:** ComplianceLint  
**Phase:** 1.0 (MVP)  
**Document Status:** Approved

## 1. Product Vision & Strategy

Bridging the gap between statutory legal requirements and daily software engineering operations is a massive challenge. Developers rarely read regulatory frameworks, and compliance officers do not review pull requests.

ComplianceLint translates data privacy laws (like GDPR and NDPR) into technical heuristics. By parsing backend structures (Node.js, NestJS, Express, TypeORM, PostgreSQL) into Abstract Syntax Trees (AST), the tool identifies regulatory violations at the code level before they reach production.

## 2. Target Audience

- **Software Engineers:** Seeking automated feedback on data handling practices directly in their terminal.
- **CTOs & Engineering Managers:** Needing to enforce data privacy standards across their teams without slowing down development.
- **Chief Compliance Officers (Future Phases):** Looking for dashboard reports proving code-level compliance for audits.

## 3. Core Features & Scope (MVP)

1. **CLI Execution Engine:** A Node.js CLI executable (`compliance-lint`) built with `commander`.
2. **AST Parser:** Leverages `@typescript-eslint/typescript-estree` to analyze TypeScript/JavaScript code.
3. **Configuration Loader:** Reads `compliance.json` for custom rule severity (`error`, `warn`, `off`) and directory exclusions.
4. **Rule Engine:** Executes 10 hardcoded GDPR rules evaluating data-at-rest (models) and data-in-motion (controllers/DTOs).
5. **Standard Output Reporter:** Formats violations with file paths, line/column numbers, and legal context (e.g., _Violates GDPR Article 5(1)(c)_).

## 4. Technical Architecture

**Language:** TypeScript (Node.js)  
**Core Dependencies:** `commander` (CLI), `@typescript-eslint/typescript-estree` (Parsing), `chalk` (Console styling).

### 4.1 Folder Structure

```text
compliance-lint/
├── bin/
│   └── cli.js                  # Entry executable (#!/usr/bin/env node)
├── src/
│   ├── config/
│   │   └── config-loader.ts    # Reads compliance.json or applies defaults
│   ├── engine/
│   │   ├── parser.ts           # AST generation logic
│   │   └── runner.ts           # Orchestrates rule evaluation across files
│   ├── rules/
│   │   ├── gdpr/
│   │   │   ├── minimal-data-collected.ts
│   │   │   ├── pii-unhashed-storage.ts
│   │   │   └── ... (remaining MVP rules)
│   │   └── index.ts            # Rule registry map
│   └── reporters/
│       └── console-reporter.ts # Terminal output formatting
├── package.json
├── tsconfig.json
└── README.md
```

## 5. Development Phases

### Phase 1: Engine Foundation & Configuration

- Initialize project with TypeScript and ESLint.
- Implement AST parser wrapper.
- Build configuration loader (`compliance.json`).
- Define the standard interface/type for Rule definitions.

### Phase 2: Data-at-Rest Rules (Database)

- Build AST visitors targeting TypeORM/Sequelize/Prisma patterns.
- Implement rules: `gdpr/pii-unhashed-storage`, `gdpr/unencrypted-pii-column`, `gdpr/data-retention-missing`, `gdpr/missing-erasure-cascade`.

### Phase 3: Data-in-Motion Rules (API Layer)

- Build AST visitors targeting NestJS and Express controller patterns.
- Implement rules: `gdpr/minimal-data-collected`, `gdpr/overly-broad-select`, `gdpr/explicit-pii-logging`, `gdpr/missing-consent-flag`, `gdpr/unprotected-export-route`, `gdpr/third-party-pii-leak`.

### Phase 4: Reporter & DX

- Develop the console reporter to match standard linter output.
- Configure exit codes (1 for errors, 0 for warnings) for CI integration.
- Implement basic file caching to optimize execution time.

### Phase 5: Testing & False Positive Tuning

- Create dummy "compliant" and "non-compliant" repositories.
- Run rigorous unit tests on AST nodes to minimize false positives.

### Phase 6: CI/CD & Pipeline Packaging

- Document GitHub Actions integration.
- Finalize `bin` execution logic.
- Publish `1.0.0-alpha` to NPM registry.

### Phase 7: The SaaS Transition (Cloud Dashboard MVP)

- Introduce `--token` flag for telemetry payload beaming.
- Develop a fast API (FastAPI or NestJS) and a PostgreSQL database.
- Build a web dashboard (Next.js) for visualization and organizational compliance scoring.

### Phase 8: AI-Powered Context Analysis

- Integrate Groq API or Vercel AI SDK.
- Extract complex AST snippets that deterministic rules cannot evaluate.
- Process snippets contextually to assess nuanced data transformations and anonymization logic.

## 6. Success Metrics for MVP

- **Accuracy:** Less than 10% false positive rate on the initial 10 rules.
- **Performance:** Scans a standard backend service (~50,000 LOC) in under 5 seconds.
- **Adoption:** Successful execution within a GitHub Actions pipeline returning appropriate exit codes.

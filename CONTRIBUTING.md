# Contributing to ComplianceLint

Thank you for helping improve ComplianceLint. Contributions are welcome across the rule engine, GDPR rule coverage, parser behavior, developer experience, documentation, and tests.

ComplianceLint is a heuristic static analysis tool. A contribution should make its behavior clear, reproducible, and honest about what the AST can and cannot prove.

## Before You Start

Please check the existing source, tests, and rule documentation before opening an issue or pull request. For a new rule, first confirm that an existing rule cannot express the same check without becoming confusing or overly broad.

When proposing a compliance behavior, include:

- The framework or coding pattern being recognized.
- The privacy or security risk being addressed.
- A small non-compliant example.
- A small compliant example.
- Expected false positives and known blind spots.

The rules provide engineering signals, not legal advice or a complete compliance determination.

## Development Setup

Requirements:

- Node.js with npm.
- A TypeScript-capable editor such as VS Code.

Clone the repository and install dependencies:

```bash
git clone <repository-url>
cd compliance-lint
npm install
```

The project is written in TypeScript and uses `@typescript-eslint/typescript-estree` to parse source code. Tests run directly from TypeScript through `tsx`.

## Project Layout

```text
src/
  cli.ts                         # CLI entry point and scan orchestration
  config/config-loader.ts        # compliance.json loading and defaults
  engine/
    file-discovery.ts            # Recursive TypeScript file discovery
    parser.ts                    # Parser helpers
    runner.ts                    # AST traversal and rule execution
    types.ts                     # Rule, config, and violation contracts
  reporters/console.ts           # Terminal output and exit status
  rules/
    gdpr/                        # GDPR rule implementations

test/
  rules/gdpr/                    # Rule-level tests
  engine/                        # Runner, discovery, and DX tests
  e2e/                           # Cross-rule fixture tests

docs/rules/gdpr/                 # One guide per rule
```

## Branches and Changes

Create a focused branch from the current default branch:

```bash
git switch -c feat/my-change
```

Keep each pull request focused on one problem. Avoid unrelated formatting, dependency upgrades, or refactors in the same change. Preserve existing public APIs unless the change explicitly requires an API update.

Use clear commit messages, for example:

```text
feat(rules): detect unprotected export routes
fix(engine): preserve warning severity in console output
docs: document GDPR rule limitations
```

## Adding or Changing a Rule

A rule implements the `Rule` interface from `src/engine/types.ts`:

```ts
import { TSESTree } from "@typescript-eslint/typescript-estree";
import { Rule } from "@/src/engine/types";

export const exampleRule: Rule = {
  id: "gdpr/example-rule",
  description: "Short description of the behavior being checked.",
  create(context) {
    return {
      CallExpression(node) {
        if (/* recognizable risk */) {
          context.report({
            message: "Explain the risk and relevant legal context.",
            line: node.loc?.start.line ?? 0,
            column: node.loc?.start.column ?? 0,
          });
        }
      },
    };
  },
};
```

### Rule requirements

1. Use a stable ID in the format `framework/rule-name`.
2. Add the rule to `src/rules/index.ts` so it is available to the engine.
3. Keep detection deterministic and based on syntax that the parser exposes.
4. Narrow the visitor before reporting. Check node types explicitly instead of relying on unchecked casts.
5. Report the most useful source location available.
6. Use a specific message that describes the observed pattern and risk.
7. Avoid claiming that a rule proves legal compliance, encryption, authorization, consent, or deletion unless the implementation actually verifies it.
8. Consider both decorator forms where relevant, such as `@Auth` and `@Auth()`.
9. Do not silently change another rule's behavior. Add or update tests for any intentional behavior change.

### Rule registry

The rule registry is the source of truth for shipped rules. After adding a rule, update `src/rules/index.ts` and the default configuration in `src/config/config-loader.ts` when the rule should be enabled by default.

If a rule is intentionally opt-in, document that clearly in the README and its rule page.

## Writing Tests

Every rule should have a test file under `test/rules/gdpr/` that follows the implementation filename. For example:

```text
src/rules/gdpr/example-rule.ts
test/rules/gdpr/example-rule.test.ts
docs/rules/gdpr/example-rule.md
```

At minimum, tests should cover:

- A bad example that produces the expected rule ID.
- A good example that produces no violation.
- Important supported syntax variants.
- A nearby false-positive case when the rule has a meaningful boundary.

Use the existing `node:test`, `node:assert`, parser, and `EngineRunner` pattern:

```ts
import { test } from "node:test";
import * as assert from "node:assert";
import { parse } from "@typescript-eslint/typescript-estree";
import { EngineRunner } from "@/src/engine/runner";
import { exampleRule } from "@/src/rules/gdpr/example-rule";

void test("Rule: gdpr/example-rule", () => {
  const runner = new EngineRunner([exampleRule]);
  const ast = parse(`const value = riskyCall(user);`, { loc: true });

  const violations = runner.run(ast);

  assert.strictEqual(violations.length, 1);
  assert.strictEqual(violations[0].ruleId, "gdpr/example-rule");
});
```

Keep fixtures small. A test should make it obvious which syntax caused the report. Add an end-to-end fixture under `test/e2e/` only when the behavior depends on multiple rules or the complete scan pipeline.

## Documentation Requirements

Each rule must have a matching page at `docs/rules/gdpr/<rule-file-name>.md`. The page should include:

- The exact rule ID.
- What the rule detects.
- A bad example that triggers the current implementation.
- A good example accepted by the current implementation.
- Known limitations, including naming assumptions, unsupported frameworks, and likely false positives or negatives.

Update the rule table and configuration examples in `README.md` when adding, removing, renaming, or changing the default severity of a rule.

Documentation examples should match the tests and implementation. Do not document a capability that is only planned.

## Configuration Changes

Configuration is loaded from `compliance.json` in the caller's working directory. Rule severities are:

- `error`: report the finding as an error and fail the CLI scan.
- `warn`: report the finding without failing the CLI scan.
- `off`: disable the rule.

When changing configuration behavior, test both default values and user overrides. Also test ignore behavior when changing file discovery. Keep the default configuration conservative and explain any newly enabled rule in the README.

## Local Validation

Before opening a pull request, run:

```bash
npm test
npm run lint
npm run build
```

For a rule-only change, run its focused test first:

```bash
npx tsx --import tsconfig-paths/register --test test/rules/gdpr/example-rule.test.ts
```

For a CLI or configuration change, include the relevant engine, config, reporter, file-discovery, or end-to-end tests as well.

If a command cannot be run locally, state that in the pull request and include the reason. Do not hide failing tests or weaken assertions just to make a check pass.

## Pull Requests

A useful pull request description includes:

- What changed and why.
- Which rule, engine path, or documentation surface is affected.
- How the behavior was tested.
- Any compatibility considerations.
- Known limitations or follow-up work.

Keep the review surface easy to inspect. Include before-and-after examples for changes to rule detection or console output. Reviewers should be able to reproduce the reported behavior from the tests and documentation.

Pull requests may be asked to add missing tests, clarify rule limitations, reduce false positives, or separate unrelated changes before merging.

## Reporting Bugs and False Positives

When reporting a bug, include:

- The ComplianceLint version or commit.
- Node.js version and operating system.
- The rule ID.
- A minimal TypeScript reproduction.
- The `compliance.json` configuration, if relevant.
- The expected and actual result.

For a false positive, explain why the code is safe and whether the rule should recognize a new safe pattern or narrow its current heuristic. Avoid including real personal data, credentials, tokens, or proprietary source code in issue reports.

## Security and Privacy

Do not commit secrets, production data, credentials, access tokens, or unredacted personal information. Use synthetic identifiers in fixtures and documentation.

If you discover a security issue in the project or a rule that could expose sensitive source or runtime data, report it privately through the repository's security contact rather than opening a public issue with exploit details.

## License

By contributing, you agree that your contribution may be distributed under the repository's existing license. Please preserve the project's existing licensing and attribution practices.

# Writing a complinter plugin

> **Experimental.** The plugin API (`complinter/plugin-api`, `apiVersion: 1`) may change in minor releases of `complinter` until it is frozen. A breaking change bumps `apiVersion`, and complinter refuses to load a plugin written for a different version, so an outdated plugin fails loudly instead of misbehaving. Pin the `complinter` versions you test against.

A plugin is a module that exports a bundle of rules. Users opt in by listing it under `plugins` in `compliance.json`. [`@complinter/plugin-nestjs`](../packages/plugin-nestjs/) is a complete, real example.

## Quick start

A plugin needs one dependency, `complinter`, declared as a **peer** dependency so that the plugin and the CLI share a single copy:

```json
{
  "name": "complinter-plugin-acme",
  "version": "0.1.0",
  "main": "dist/index.js",
  "peerDependencies": { "complinter": "*" },
  "devDependencies": { "complinter": "*" }
}
```

Import only from `complinter/plugin-api`. Do not import `@complinter/*` packages or anything under `complinter/dist`; they are internal, are not installed alongside the CLI and are not part of the API.

```ts
// src/index.ts
import { AST_NODE_TYPES, defineRule, definePlugin } from "complinter/plugin-api";

const noDebugEndpoints = defineRule({
  id: "acme/no-debug-endpoints",
  description: "Flags routes that dump the request, which can contain personal data.",
  create(context) {
    return {
      // The visitor key is an AST node type; `node` is typed accordingly.
      CallExpression(node) {
        if (
          node.callee.type === AST_NODE_TYPES.MemberExpression &&
          node.callee.property.type === AST_NODE_TYPES.Identifier &&
          node.callee.property.name === "dumpRequest"
        ) {
          context.report({
            message: "dumpRequest() writes the whole request, including personal data, to the response.",
            line: node.loc.start.line,
            column: node.loc.start.column,
          });
        }
      },
    };
  },
});

export default definePlugin({
  name: "complinter-plugin-acme",
  apiVersion: 1,
  namespace: "acme",
  rules: [noDebugEndpoints],
  defaultSeverities: { "acme/no-debug-endpoints": "warn" },
});
```

Users then add it to their project:

```bash
npm install --save-dev complinter complinter-plugin-acme
```

```json
{
  "plugins": ["complinter-plugin-acme"],
  "rules": { "acme/no-debug-endpoints": "error" }
}
```

For private rules inside one project, point `plugins` at a file instead: `"plugins": ["./tools/our-rules.js"]`. It must be plain JavaScript (CommonJS or ESM), start with `./` and stay inside the project.

## The plugin object

| Field               | Required | Meaning                                                                                                                        |
| ------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `name`              | yes      | Usually the package name. Appears in error messages.                                                                           |
| `apiVersion`        | yes      | The API generation the plugin targets; must equal `1`. Write the literal rather than importing `PLUGIN_API_VERSION`, so the plugin pins what it was written for. |
| `namespace`         | yes      | Lowercase letters, digits or hyphens, starting with a letter. Every rule id must be `namespace/rule-name`.                      |
| `rules`             | yes      | The rules, built with `defineRule`.                                                                                            |
| `defaultSeverities` | no       | `error`, `warn` or `off` per rule id. A rule without an entry is an `error`. Users can always override it under `rules`.        |
| `version`           | no       | Read from the plugin's `package.json` when omitted. Used in the cache fingerprint.                                             |
| `adapters`          | no       | Language adapters for other languages. The adapter interface is in the public types but has no second consumer yet; treat it as the least stable part of the API. |

Export the plugin as the module's default export (ESM, or compiled TypeScript) or as `module.exports = plugin` (CommonJS). A named export is not looked at.

## Rules

A rule has an `id`, a `description` and a `create(context)` function that returns **visitors**: an object whose keys are AST node types and whose values are functions called for each node of that type.

- `create` runs **once per file**, not once per node. State kept in its closure (for example a registry collected in a `Program` visitor and read later by `MethodDefinition`) is shared by every visitor for that file. The NestJS plugin's `unserialized-sensitive-response` rule does this.
- `defineRule` types the `node` parameter from the visitor name and rejects unknown visitor names, including a typo next to a valid one. It is checked by `tsc`, so keep `strict` on.
- `context.report({ message, line, column })` records a finding. `line` is 1-based, `column` 0-based. Report on the line a user would put `// compliance-ignore-next-line <rule-id>` above, since that comment is how they suppress it. Severity is assigned by the engine.
- `context.filename` and `context.sourceText` give the file being analysed.
- Node types come from `AST_NODE_TYPES` and `TSESTree`, re-exported from `@typescript-eslint/typescript-estree`, so your rules use the same parser as the engine.

### Writing rules well

The built-in rules are heuristics over syntax and names, and plugin rules should say so. Follow the same bar the project asks of contributors:

- Keep detection deterministic and based on syntax the parser exposes. Narrow the node type before reading properties.
- Name a concrete risk in the message, and the regulation or article only if it actually applies.
- Do not claim a rule proves compliance, encryption, authorization or consent unless it verifies it.
- Handle both `@Auth` and `@Auth()` style decorators where relevant.
- Document each rule with a bad example, a good example and known limitations. Check the new rule against the built-in `gdpr/*` rules and say how they relate (the NestJS pages have a "Relationship to the built-in rules" section).

## Testing

`lintText` runs rules, or a whole plugin, over a source string with the real engine and returns the violations after inline suppressions:

```ts
import { test } from "node:test";
import * as assert from "node:assert";
import { lintText } from "complinter/plugin-api";
import plugin from "../src/index";

void test("flags dumpRequest", () => {
  const violations = lintText(plugin, "app.dumpRequest(req);");
  assert.deepStrictEqual(
    violations.map((v) => v.ruleId),
    ["acme/no-debug-endpoints"],
  );
});

void test("severities come from the config", () => {
  const [violation] = lintText(plugin, "app.dumpRequest(req);", {
    severities: { "acme/no-debug-endpoints": "error" },
  });
  assert.strictEqual(violation.severity, "error");
});
```

`lintText` takes a `filename` option (default `file.ts`) for rules that depend on it. Parse errors are thrown.

## What can go wrong at load time

Any of these stops the run with exit code 2 and a message naming the plugin:

- The plugin cannot be found or fails to import.
- It does not export a valid plugin object, or targets another `apiVersion`.
- It uses a namespace another loaded plugin already claims (`gdpr` is taken by the built-in rules).
- A rule id is outside the plugin's namespace or duplicates another.
- `defaultSeverities` names a rule the plugin does not define.

Plugins run in the same process with the same permissions as the user's project. Do not ask users to list code they cannot trust, and avoid side effects at import time.

## Packaging and releasing

- List `complinter` under `peerDependencies`, with a range that matches the versions you tested, and also under `devDependencies` for your own build and tests. Do not add `@complinter/*` dependencies.
- Compile to JavaScript and point `main` (or `exports`) at it. A published plugin cannot ship TypeScript.
- Verify it the way the official plugin is verified: `npm pack`, install the tarball next to `complinter` in an empty project, and run `npx complint` with the plugin enabled. `packages/complinter/test/pack/pack.test.ts` does exactly that for `@complinter/plugin-nestjs`.
- Name it `complinter-plugin-<name>` or `@scope/complinter-plugin-<name>` so users can find it.

## Stability

What is stable enough to build on today: `definePlugin`, `defineRule`, `lintText`, `AST_NODE_TYPES`, `TSESTree` and the `Rule`, `RuleContext` and `Violation` types, for TypeScript and JavaScript rules. Subject to change before the freeze: language adapters and `NodeMap`/`Visitors` generics, and anything not listed here.

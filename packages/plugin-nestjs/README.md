# @complinter/plugin-nestjs

NestJS rules for [complinter](../../README.md). **Experimental, not yet published**: it lives in the complinter repository while the plugin API settles and will move to its own repository once that API is frozen.

## Rules

| Rule                                                                                      | What it flags                                                                                  |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [`nestjs/pii-in-url`](docs/rules/pii-in-url.md)                                           | Personal data in route paths and `@Param` / `@Query` parameters.                               |
| [`nestjs/unserialized-sensitive-response`](docs/rules/unserialized-sensitive-response.md) | Route handlers returning a (same-file) class with sensitive fields that are not `@Exclude()`d. |

Both are errors by default and can be changed under `rules` in `compliance.json`.

## Use

```bash
npm install --save-dev complinter @complinter/plugin-nestjs
```

```json
{
  "plugins": ["@complinter/plugin-nestjs"]
}
```

## Written against the public plugin API only

The plugin imports nothing but `complinter/plugin-api` and lists `complinter` as a peer dependency. It has no other dependencies, which makes it a worked example of a plugin that could live in any repository.

```ts
import { definePlugin, defineRule } from "complinter/plugin-api";
```

Its tests use `lintText` from the same entry point.

To write a plugin of your own, see the [plugin authoring guide](../../docs/plugins.md); this one is the reference example.

# Changesets

Every change that affects users of `complinter` (rules, CLI behavior, the plugin API, docs shipped in the package) needs a changeset:

```bash
npm run changeset
```

Pick the package, the bump (patch, minor or major) and write the changelog entry for users. Commit the generated file with your change.

The internal packages (`@complinter/core`, `lang-typescript`, `rules-gdpr`) are bundled into `complinter`, so a change to one of them is released as a change to **`complinter`**. Select `complinter`, and also the plugin if you changed a plugin.

See CONTRIBUTING.md for how releases are cut.

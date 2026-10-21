import * as path from "node:path";
import { defineConfig } from "tsup";

const packages = path.resolve(__dirname, "..");

// The CLI is published as one self-contained package: the internal
// @complinter/* packages are inlined into the bundles, while real third-party
// dependencies stay external and are installed from npm.
export default defineConfig({
  entry: {
    cli: "src/cli.ts",
    "plugin-api": "src/plugin-api.ts",
  },
  format: ["cjs"],
  platform: "node",
  target: "node18",
  clean: true,
  sourcemap: false,
  splitting: false,
  // Type declarations only for the public plugin API; the CLI has none.
  dts: {
    entry: { "plugin-api": "src/plugin-api.ts" },
    resolve: [/^@complinter\//],
  },
  tsconfig: path.resolve(__dirname, "../../tsconfig.json"),
  noExternal: [/^@complinter\//],
  external: ["@typescript-eslint/typescript-estree"],
  esbuildOptions(options) {
    // Bundle from source so the build does not depend on the other packages' dist output.
    options.alias = {
      "@complinter/core": path.join(packages, "core/src/index.ts"),
      "@complinter/lang-typescript": path.join(
        packages,
        "lang-typescript/src/index.ts",
      ),
      "@complinter/rules-gdpr": path.join(packages, "rules-gdpr/src/index.ts"),
    };
  },
});

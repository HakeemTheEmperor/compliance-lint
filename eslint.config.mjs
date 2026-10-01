import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import boundaries from "./tools/eslint-plugin-boundaries/index.mjs";

export default defineConfig([
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Custom rules
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Keep workspace packages independent: no deep or cross-package relative imports.
    files: ["packages/**/*.ts"],
    plugins: { boundaries },
    rules: { "boundaries/package-boundaries": "error" },
  },
  {
    ignores: [
      "**/dist/",
      "node_modules/",
      "bin/",
      "**/test/fixtures/",
      "**/*.mjs",
      "**/*.js",
    ],
  },
]);

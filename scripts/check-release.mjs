// Guards the publish workflow. Fails when:
//  - a workspace other than `complinter` is publishable (only the CLI package
//    publishes until the plugin API is frozen),
//  - `complinter` is still private,
//  - the release tag (RELEASE_TAG, e.g. v1.2.3) does not match its version,
//  - the build output the package points at is missing.
//
// Usage: node scripts/check-release.mjs   (RELEASE_TAG is optional)
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packagesDir = path.join(root, "packages");
const problems = [];

for (const dir of fs.readdirSync(packagesDir)) {
  const file = path.join(packagesDir, dir, "package.json");
  if (!fs.existsSync(file)) continue;
  const pkg = JSON.parse(fs.readFileSync(file, "utf8"));

  if (pkg.name !== "complinter") {
    if (!pkg.private) {
      problems.push(`${pkg.name} must stay "private": true; only complinter publishes for now.`);
    }
    continue;
  }

  if (pkg.private) problems.push('complinter is still "private": true.');

  const tag = process.env.RELEASE_TAG;
  if (tag && tag.replace(/^v/, "") !== pkg.version) {
    problems.push(`release tag "${tag}" does not match complinter version ${pkg.version}.`);
  }

  const outputs = [pkg.bin?.complint, pkg.exports?.["./plugin-api"]?.default, pkg.exports?.["./plugin-api"]?.types];
  for (const output of outputs) {
    if (!output || !fs.existsSync(path.join(packagesDir, dir, output))) {
      problems.push(`build output missing: ${String(output)} (run npm run build).`);
    }
  }
}

if (problems.length > 0) {
  console.error(problems.map((p) => `release check: ${p}`).join("\n"));
  process.exit(1);
}
console.log("release check: ok");

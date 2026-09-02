import * as fs from "node:fs";
import * as path from "node:path";

function patternToRegExp(pattern: string): RegExp {
  const normalizedPattern = pattern.replace(/\\/g, "/").replace(/^\.\//, "");
  let expression = "";

  for (let index = 0; index < normalizedPattern.length; index++) {
    const character = normalizedPattern[index];

    if (character === "*" && normalizedPattern[index + 1] === "*") {
      if (normalizedPattern[index + 2] === "/") {
        expression += "(?:.*/)?";
        index += 2;
      } else {
        expression += ".*";
        index += 1;
      }
    } else if (character === "*") {
      expression += "[^/]*";
    } else if (character === "?") {
      expression += "[^/]";
    } else {
      expression += "\\^$+?.()|{}[]".includes(character)
        ? `\\${character}`
        : character;
    }
  }

  return new RegExp(`^${expression}$`);
}

function isIgnored(
  entryName: string,
  relativePath: string,
  ignorePatterns: string[],
): boolean {
  return ignorePatterns.some((pattern) => {
    const normalizedPattern = pattern.replace(/\\/g, "/");
    if (!normalizedPattern.includes("*") && !normalizedPattern.includes("?")) {
      return (
        normalizedPattern === entryName || normalizedPattern === relativePath
      );
    }

    return patternToRegExp(normalizedPattern).test(relativePath);
  });
}

export function getFiles(
  dir: string,
  ignorePatterns: string[] = ["node_modules", "dist", ".git"],
  rootDir: string = dir,
): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(rootDir, fullPath).replace(/\\/g, "/");

    if (
      entry.name === ".git" ||
      isIgnored(entry.name, relativePath, ignorePatterns)
    ) {
      continue;
    }

    if (entry.isDirectory()) {
      files = files.concat(getFiles(fullPath, ignorePatterns, rootDir));
    } else if (entry.isFile() && fullPath.endsWith(".ts")) {
      files.push(fullPath);
    }
  }

  return files;
}

import { TSESTree } from "@typescript-eslint/typescript-estree";
import { Violation } from "./types";

const DIRECTIVE = /^\s*compliance-(ignore(?:-next-line)?)\b\s*(.*)$/;

function parseRuleIds(rest: string): string[] | null {
  const ids = rest
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => /^[\w-]+\/[\w-]+$/.test(s));
  return ids.length > 0 ? ids : null; // null => suppress every rule
}

/**
 * Drops violations suppressed by inline comments:
 *   // compliance-ignore-next-line [rule-id ...]   (next line)
 *   // compliance-ignore [rule-id ...]             (same line, trailing)
 * With no rule ids, every rule is suppressed for that line.
 */
export function applySuppressions(
  violations: Violation[],
  comments: TSESTree.Comment[],
): Violation[] {
  if (comments.length === 0 || violations.length === 0) return violations;

  const byLine = new Map<number, (string[] | null)[]>();
  for (const comment of comments) {
    const match = DIRECTIVE.exec(comment.value);
    if (!match) continue;

    const target =
      match[1] === "ignore-next-line"
        ? comment.loc.end.line + 1
        : comment.loc.start.line;
    const list = byLine.get(target) ?? [];
    list.push(parseRuleIds(match[2]));
    byLine.set(target, list);
  }

  if (byLine.size === 0) return violations;

  return violations.filter((v) => {
    const directives = byLine.get(v.line);
    if (!directives) return true;
    return !directives.some((ids) => ids === null || ids.includes(v.ruleId));
  });
}

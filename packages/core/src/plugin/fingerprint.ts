import { hashContent } from "../engine/cache";
import type { LoadedPlugin } from "./types";

export interface FingerprintInput {
  /** Version of the running tool. */
  version: string;
  /** Ids of every language adapter in use. */
  adapters: readonly string[];
  /** Every plugin that contributes rules, including built-ins. */
  plugins: readonly LoadedPlugin[];
  /** Ids of every rule that is loaded. */
  ruleIds: readonly string[];
  /** Effective severity per rule after merging defaults and user config. */
  severities: Readonly<Record<string, string>>;
}

/**
 * Everything besides file content that can change a result. When this string
 * changes the result cache is discarded, so adding, removing, upgrading or
 * editing a plugin never serves stale findings.
 */
export function createCacheFingerprint(input: FingerprintInput): string {
  const severities = Object.fromEntries(
    Object.entries(input.severities).sort(([a], [b]) => a.localeCompare(b)),
  );
  return hashContent(
    JSON.stringify({
      version: input.version,
      adapters: [...input.adapters].sort(),
      plugins: input.plugins
        .map((p) => ({
          spec: p.spec,
          name: p.plugin.name,
          version: p.version,
          apiVersion: p.plugin.apiVersion,
          contentHash: p.contentHash ?? null,
        }))
        .sort((a, b) => a.spec.localeCompare(b.spec)),
      rules: [...input.ruleIds].sort(),
      severities,
    }),
  );
}

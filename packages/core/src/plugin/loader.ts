import * as fs from "node:fs";
import * as path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { hashContent } from "../engine/cache";
import type { AnyAdapter, AnyRule } from "../engine/language";
import type { RuleSeverity } from "../engine/types";
import { LoadedPlugin, PluginError } from "./types";
import { validatePlugin } from "./validate";

const PACKAGE_NAME = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;

export type PluginSpec =
  | { kind: "package"; name: string }
  | { kind: "local"; relativePath: string };

/**
 * Plugins are named, never located by arbitrary paths or URLs: either an npm
 * package name (resolved from the project) or a "./" path inside the project.
 */
export function classifyPluginSpec(spec: string): PluginSpec {
  const bad = (reason: string): never => {
    throw new PluginError(`Invalid plugin specifier "${spec}": ${reason}`);
  };

  if (typeof spec !== "string" || spec.trim() === "") {
    return bad("it must be a non-empty string.");
  }

  const normalised = spec.replace(/\\/g, "/");
  if (normalised.startsWith("./")) {
    if (normalised.split("/").includes("..")) {
      return bad('local plugins may not use "..".');
    }
    return { kind: "local", relativePath: normalised };
  }
  if (
    normalised.startsWith(".") ||
    normalised.startsWith("/") ||
    /^[a-zA-Z]:/.test(normalised) ||
    normalised.includes(":")
  ) {
    return bad(
      'use an installed package name or a path starting with "./" inside the project (absolute paths and URLs are not allowed).',
    );
  }
  if (!PACKAGE_NAME.test(normalised)) {
    return bad(
      "it is not a valid npm package name (subpaths are not supported).",
    );
  }
  return { kind: "package", name: normalised };
}

function findPackageVersion(entryFile: string): string | undefined {
  let dir = path.dirname(entryFile);
  for (;;) {
    const candidate = path.join(dir, "package.json");
    if (fs.existsSync(candidate)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(candidate, "utf-8")) as {
          name?: string;
          version?: string;
        };
        if (pkg.name) return pkg.version;
      } catch {
        return undefined;
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/** CJS modules arrive as { default: module.exports }; transpiled ESM adds one more level. */
function unwrapModule(mod: unknown): unknown {
  let candidate: unknown = mod;
  for (let depth = 0; depth < 3; depth++) {
    if (
      candidate &&
      typeof candidate === "object" &&
      !("rules" in candidate) &&
      "default" in candidate
    ) {
      candidate = (candidate).default;
    } else {
      break;
    }
  }
  return candidate;
}

/**
 * Loads every plugin named in the config. Package names resolve from
 * `projectDir`; "./" paths must stay inside it. Anything that cannot be
 * found, imported or validated throws a PluginError.
 */
export async function loadPlugins(
  specs: readonly string[],
  projectDir: string,
): Promise<LoadedPlugin[]> {
  const requireFromProject = createRequire(path.join(projectDir, "package.json"));
  const loaded: LoadedPlugin[] = [];

  for (const spec of specs) {
    const target = classifyPluginSpec(spec);

    let entry: string;
    let contentHash: string | undefined;
    if (target.kind === "local") {
      entry = path.resolve(projectDir, target.relativePath);
      const relative = path.relative(projectDir, entry);
      if (relative.startsWith("..") || path.isAbsolute(relative)) {
        throw new PluginError(
          `Invalid plugin specifier "${spec}": local plugins must stay inside the project.`,
        );
      }
      if (!fs.existsSync(entry) || !fs.statSync(entry).isFile()) {
        throw new PluginError(`Cannot find local plugin "${spec}" (${entry}).`);
      }
      contentHash = hashContent(fs.readFileSync(entry, "utf-8"));
    } else {
      try {
        entry = requireFromProject.resolve(target.name);
      } catch {
        throw new PluginError(
          `Cannot find plugin "${spec}" from ${projectDir}. Is it installed?`,
        );
      }
    }

    let mod: unknown;
    try {
      mod = await import(pathToFileURL(entry).href);
    } catch (err) {
      throw new PluginError(
        `Failed to load plugin "${spec}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const plugin = validatePlugin(unwrapModule(mod), spec);
    loaded.push({
      plugin,
      spec,
      version:
        plugin.version ??
        (target.kind === "package" ? findPackageVersion(entry) : undefined) ??
        "unknown",
      contentHash,
    });
  }

  return loaded;
}

export interface AssembledPlugins {
  rules: AnyRule[];
  adapters: AnyAdapter[];
  /** Plugin-declared default severities, merged across plugins. */
  defaultSeverities: Record<string, RuleSeverity>;
}

/**
 * Combines built-in and loaded plugins into the lists the engine uses, and
 * rejects collisions: two plugins claiming one namespace, one rule id, or one
 * adapter id. Built-ins are listed first and keep their ids.
 */
export function assemblePlugins(
  builtins: readonly LoadedPlugin[],
  extra: readonly LoadedPlugin[],
  builtinAdapters: readonly AnyAdapter[] = [],
): AssembledPlugins {
  const rules: AnyRule[] = [];
  const adapters: AnyAdapter[] = [...builtinAdapters];
  const defaultSeverities: Record<string, RuleSeverity> = {};
  const namespaces = new Map<string, string>();
  const ruleIds = new Map<string, string>();
  const adapterIds = new Map<string, string>(
    builtinAdapters.map((a) => [a.id, "built-in"]),
  );

  for (const { plugin, spec } of [...builtins, ...extra]) {
    const owner = plugin.name || spec;

    const takenBy = namespaces.get(plugin.namespace);
    if (takenBy !== undefined) {
      throw new PluginError(
        `Plugins "${takenBy}" and "${owner}" both use the namespace "${plugin.namespace}".`,
      );
    }
    namespaces.set(plugin.namespace, owner);

    for (const rule of plugin.rules) {
      const existing = ruleIds.get(rule.id);
      if (existing !== undefined) {
        throw new PluginError(
          `Rule id "${rule.id}" is defined by both "${existing}" and "${owner}".`,
        );
      }
      ruleIds.set(rule.id, owner);
      rules.push(rule);
    }

    for (const adapter of plugin.adapters ?? []) {
      const existing = adapterIds.get(adapter.id);
      if (existing !== undefined) {
        throw new PluginError(
          `Language adapter "${adapter.id}" is provided by both "${existing}" and "${owner}".`,
        );
      }
      adapterIds.set(adapter.id, owner);
      adapters.push(adapter);
    }

    Object.assign(defaultSeverities, plugin.defaultSeverities);
  }

  return { rules, adapters, defaultSeverities };
}

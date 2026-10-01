import type { RuleSeverity } from "../engine/types";
import { PLUGIN_API_VERSION, Plugin, PluginError } from "./types";

const NAMESPACE = /^[a-z][a-z0-9-]*$/;
const RULE_NAME = /^[a-z0-9][a-z0-9-]*$/;
const SEVERITIES: readonly string[] = ["error", "warn", "off"];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Checks that something a plugin module exported really is a Plugin and
 * returns it typed. Every problem is reported as a PluginError that names the
 * plugin's source, so a bad plugin never fails silently.
 */
export function validatePlugin(candidate: unknown, source: string): Plugin {
  const fail = (problem: string): never => {
    throw new PluginError(`Invalid plugin "${source}": ${problem}`);
  };

  if (!isObject(candidate)) {
    return fail("it must export a plugin object (use definePlugin).");
  }

  const { name, apiVersion, namespace, rules, adapters, defaultSeverities } =
    candidate;

  if (typeof name !== "string" || name.trim() === "") {
    fail('"name" must be a non-empty string.');
  }
  if (apiVersion !== PLUGIN_API_VERSION) {
    fail(
      `it targets plugin API version ${String(apiVersion)} but this complinter supports version ${PLUGIN_API_VERSION}.`,
    );
  }
  if (typeof namespace !== "string" || !NAMESPACE.test(namespace)) {
    fail(
      '"namespace" must be lowercase letters, digits or hyphens, starting with a letter (for example "nestjs").',
    );
  }
  if (!Array.isArray(rules)) {
    fail('"rules" must be an array.');
  }

  const ruleIds = new Set<string>();
  (rules as unknown[]).forEach((rule, index) => {
    if (!isObject(rule)) {
      fail(`rules[${index}] must be an object.`);
      return;
    }
    const id = rule.id;
    if (typeof id !== "string") {
      fail(`rules[${index}] needs a string "id".`);
      return;
    }
    const [prefix, ruleName, ...rest] = id.split("/");
    if (
      prefix !== namespace ||
      ruleName === undefined ||
      rest.length > 0 ||
      !RULE_NAME.test(ruleName)
    ) {
      fail(
        `rule id "${id}" must look like "${String(namespace)}/rule-name" (a plugin may only define rules in its own namespace).`,
      );
    }
    if (ruleIds.has(id)) fail(`rule id "${id}" is defined twice.`);
    ruleIds.add(id);
    if (typeof rule.description !== "string") {
      fail(`rule "${id}" needs a string "description".`);
    }
    if (typeof rule.create !== "function") {
      fail(`rule "${id}" needs a "create" function.`);
    }
    if (rule.language !== undefined && typeof rule.language !== "string") {
      fail(`rule "${id}": "language" must be a string.`);
    }
  });

  if (adapters !== undefined) {
    if (!Array.isArray(adapters)) fail('"adapters" must be an array.');
    (adapters as unknown[]).forEach((adapter, index) => {
      const ok =
        isObject(adapter) &&
        typeof adapter.id === "string" &&
        Array.isArray(adapter.extensions) &&
        adapter.extensions.every((e) => typeof e === "string") &&
        typeof adapter.parse === "function" &&
        typeof adapter.walk === "function";
      if (!ok) {
        fail(
          `adapters[${index}] needs "id", "extensions" (strings), "parse" and "walk".`,
        );
      }
    });
  }

  if (defaultSeverities !== undefined) {
    if (!isObject(defaultSeverities)) {
      fail('"defaultSeverities" must be an object.');
    }
    for (const [id, severity] of Object.entries(
      defaultSeverities as Record<string, unknown>,
    )) {
      if (!ruleIds.has(id)) {
        fail(`"defaultSeverities" mentions "${id}", which is not one of its rules.`);
      }
      if (!SEVERITIES.includes(severity as RuleSeverity)) {
        fail(`default severity for "${id}" must be "error", "warn" or "off".`);
      }
    }
  }

  return candidate as unknown as Plugin;
}

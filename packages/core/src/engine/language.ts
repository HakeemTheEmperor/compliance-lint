import {
  DEFAULT_LANGUAGE,
  NodeMap,
  Rule,
  RuleContext,
  Visitors,
} from "./types";

/** Minimal comment shape the engine needs (ESTree comments satisfy it). */
export interface SourceComment {
  value: string;
  loc: { start: { line: number }; end: { line: number } };
}

export interface ParseResult<Root = unknown> {
  tree: Root;
  comments: readonly SourceComment[];
}

/**
 * Teaches the engine to read one language: how to find its files, parse them
 * and walk the resulting tree. `N` is the language's node vocabulary.
 */
export interface LanguageAdapter<N extends NodeMap = NodeMap, Root = unknown> {
  id: string;
  /** File name suffixes this adapter handles, e.g. ".ts". */
  extensions: readonly string[];
  /** File name suffixes to skip even when an extension matches, e.g. ".d.ts". */
  excludeSuffixes?: readonly string[];
  parse(source: string, filePath: string): ParseResult<Root>;
  /** Calls `visit` for every node, parents before children. */
  walk(
    root: Root,
    visit: (type: keyof N & string, node: N[keyof N]) => void,
  ): void;
}

/** Adapters of different languages can sit in one list. */
export type AnyAdapter = LanguageAdapter<NodeMap, unknown>;

/**
 * Lets adapters with different vocabularies sit in one list. The one cast
 * lives here: an adapter is only ever used with rules of its own language
 * (enforced by `assertLanguagesRegistered` and the runner's language filter).
 */
export function eraseAdapter<N extends NodeMap, Root>(
  adapter: LanguageAdapter<N, Root>,
): AnyAdapter {
  return adapter as unknown as AnyAdapter;
}

/**
 * Type-erased view of a rule. Every `Rule<N>` is assignable to it (visitor
 * parameters are contravariant), so rules of different languages can sit in
 * one list without casts.
 */
export interface AnyRule {
  id: string;
  description: string;
  language?: string;
  create(
    context: RuleContext,
  ): Record<string, ((node: never) => void) | undefined>;
}

/** Fails fast when a rule targets a language nobody registered an adapter for. */
export function assertLanguagesRegistered(
  adapters: readonly AnyAdapter[],
  rules: readonly AnyRule[],
): void {
  const ids = new Set(adapters.map((a) => a.id));
  for (const rule of rules) {
    const language = rule.language ?? DEFAULT_LANGUAGE;
    if (!ids.has(language)) {
      throw new Error(
        `Rule "${rule.id}" targets language "${language}" but no adapter for it is registered.`,
      );
    }
  }
}

/**
 * Resolves to `unknown` (no constraint) when every visitor name is part of the
 * vocabulary and to `never` otherwise. Compared against the stringified
 * vocabulary because string-enum keys (ESTree) do not match plain string
 * literals in `Exclude`.
 */
type OnlyKnownVisitors<V, N> =
  Exclude<keyof V, `${keyof N & string}`> extends never ? unknown : never;

/**
 * Creates a rule-authoring helper bound to one language vocabulary. Visitor
 * parameters are typed and unknown visitor names are rejected, whether the
 * typo stands alone or sits next to a valid visitor.
 */
export function createRuleFactory<N extends NodeMap>(language: string) {
  return <V extends Visitors<N>>(
    rule: {
      id: string;
      description: string;
      create(context: RuleContext): V;
    } & OnlyKnownVisitors<V, N>,
  ): Rule<N> => ({ ...rule, language });
}

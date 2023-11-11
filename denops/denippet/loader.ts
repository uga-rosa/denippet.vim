import { Denops } from "./deps/denops.ts";
import { TOML, YAML } from "./deps/std.ts";
import { is, u } from "./deps/unknownutil.ts";
import { asyncFilter } from "./util.ts";

const isStringOrArray = is.OneOf([is.String, is.ArrayOf(is.String)]);
const isIfKeyword = is.LiteralOneOf(["base", "start", "vimscript", "lua"] as const);
type ifKeyword = u.PredicateType<typeof isIfKeyword>;

const isRawSnippet = is.ObjectOf({
  prefix: is.OptionalOf(isStringOrArray),
  body: isStringOrArray,
  description: is.OptionalOf(is.String),
  if: is.OptionalOf(isIfKeyword),
  eval: is.OptionalOf(is.String),
});

export type RawSnippet = u.PredicateType<typeof isRawSnippet>;

function isBodyFunc(
  x: unknown,
): x is (denops: Denops) => string | string[] | Promise<string | string[]> {
  return typeof x === "function";
}

function isIfFunc(
  x: unknown,
): x is (denops: Denops) => boolean | Promise<boolean> {
  return typeof x === "function";
}

const isTSSnippet = is.ObjectOf({
  prefix: is.OptionalOf(isStringOrArray),
  body: is.OneOf([isStringOrArray, isBodyFunc]),
  description: is.OptionalOf(is.String),
  if: is.OptionalOf(is.OneOf([isIfKeyword, isIfFunc])),
  eval: is.OptionalOf(is.String),
});

export type TSSnippet = u.PredicateType<typeof isTSSnippet>;

export type NormalizedSnippet = {
  name: string;
  prefix: string[];
  body: string | ((denops: Denops) => Promise<string>);
  description?: string;
  if?: ifKeyword | u.PredicateType<typeof isIfFunc>;
  eval?: string;
};

function toArray<T>(x: T | T[]): T[] {
  return Array.isArray(x) ? x : [x];
}

function toString(x: unknown): string {
  return is.ArrayOf(is.String)(x) ? x.join("\n") : `${x}`;
}

// Keys are filetypes
const Cell: Record<string, NormalizedSnippet[]> = {};

function setSnippets(
  filetype: string | string[],
  snippets: NormalizedSnippet[],
): void {
  toArray(filetype).forEach((ft) => {
    if (Cell[ft] === undefined) {
      Cell[ft] = [];
    }
    Cell[ft].push(...snippets);
  });
}

export async function getSnippets(
  denops: Denops,
  ft: string,
): Promise<NormalizedSnippet[]> {
  const snippets = [
    ...Cell[ft] ?? [],
    ...Cell["*"] ?? [],
  ];
  return await asyncFilter(snippets, async (snippet) => {
    if (snippet.if === undefined) {
      return true;
    } else if (isIfFunc(snippet.if)) {
      return Boolean(await snippet.if(denops));
    } else if (snippet.if === "base") {
      return Boolean(await denops.call("denippet#load#base"));
    } else if (snippet.if === "start") {
      return Boolean(await denops.call("denippet#load#start"));
    } else if (!snippet.eval) {
      return false;
    } else if (snippet.if === "vimscript") {
      return Boolean(await denops.call("eval", snippet.eval));
    } else {
      return Boolean(await denops.call("luaeval", "assert(loadstring(_A[1]))()", [snippet.eval]));
    }
  });
}

export async function load(
  filepath: string,
  filetype: string | string[],
): Promise<void> {
  const extension = filepath.split(".").pop()!;
  let snippets: NormalizedSnippet[] = [];
  if (["json", "toml", "yaml"].includes(extension)) {
    const raw = await Deno.readTextFile(filepath);
    const content = extension === "json"
      ? JSON.parse(raw)
      : extension === "toml"
      ? TOML.parse(raw)
      : YAML.parse(raw);
    u.assert(content, is.RecordOf(isRawSnippet));
    snippets = Object.entries(content).map(([name, snip]) => ({
      ...snip,
      name,
      prefix: toArray(snip.prefix ?? name),
      body: toString(snip.body),
    }));
  } else if (extension === "ts") {
    const content = await import(filepath).then((module) => module.snippets);
    u.assert(content, is.RecordOf(isTSSnippet));
    snippets = Object.entries(content).map(([name, snip]) => ({
      ...snip,
      name,
      prefix: toArray(snip.prefix ?? name),
      body: async (denops: Denops) => {
        return toString(
          typeof snip.body === "function" ? await snip.body(denops) : snip.body,
        );
      },
    }));
  } else {
    throw new Error(`Unknown extension: ${extension}`);
  }

  setSnippets(filetype, snippets);
}

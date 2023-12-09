import { Denops } from "./deps/denops.ts";
import { path, TOML, YAML } from "./deps/std.ts";
import { is, u } from "./deps/unknownutil.ts";
import { asyncFilter, getNewline } from "./util.ts";

const isStringOrArray = is.OneOf([is.String, is.ArrayOf(is.String)]);
const isIfKeyword = is.LiteralOneOf(["base", "start", "vimscript", "lua"] as const);
type ifKeyword = u.PredicateType<typeof isIfKeyword>;

const isRawSnippet = is.ObjectOf({
  prefix: is.OptionalOf(isStringOrArray),
  body: isStringOrArray,
  description: is.OptionalOf(isStringOrArray),
  if: is.OptionalOf(isIfKeyword),
  eval: is.OptionalOf(is.String),
});

export type RawSnippet = u.PredicateType<typeof isRawSnippet>;

function isBodyFunc(
  x: unknown,
): x is (denops: Denops) => string | string[] | Promise<string | string[]> {
  return typeof x == "function";
}

function isIfFunc(
  x: unknown,
): x is (denops: Denops) => boolean | Promise<boolean> {
  return typeof x == "function";
}

const isTSSnippet = is.ObjectOf({
  prefix: is.OptionalOf(isStringOrArray),
  body: is.OneOf([isStringOrArray, isBodyFunc]),
  description: is.OptionalOf(isStringOrArray),
  if: is.OptionalOf(is.OneOf([isIfKeyword, isIfFunc])),
  eval: is.OptionalOf(is.String),
});

export type TSSnippet = u.PredicateType<typeof isTSSnippet>;

// For compatibility with VSCode global snippet files (*.code-snippets)
const isGlobalSnippet = is.ObjectOf({
  prefix: is.OptionalOf(isStringOrArray),
  body: isStringOrArray,
  description: is.OptionalOf(isStringOrArray),
  scope: is.OptionalOf(is.String),
});

export type GlobalSnippet = u.PredicateType<typeof isGlobalSnippet>;

function langToFt(lang: string): string {
  return {
    csharp: "cs",
    shellscript: "sh",
  }[lang] ?? lang;
}

export type NormalizedSnippet = {
  name: string;
  prefix: string[];
  body: string | ((denops: Denops) => Promise<string>);
  description: string;
  if?: ifKeyword | u.PredicateType<typeof isIfFunc>;
  eval?: string;
};

function toArray<T>(x: T | T[]): T[] {
  return Array.isArray(x) ? x : [x];
}

function toString(
  x: string | string[] | undefined,
  newline: string,
): string {
  if (x == null) {
    return "";
  } else if (is.String(x)) {
    return x;
  } else {
    return x.join(newline);
  }
}

export class Loader {
  cell: Record<string, NormalizedSnippet[]> = {};

  constructor(
    public denops: Denops,
  ) {}

  reset(): void {
    this.cell = {};
  }

  set(
    filetype: string | string[],
    snippets: NormalizedSnippet[],
  ): void {
    toArray(filetype).forEach((ft) => {
      if (this.cell[ft] == null) {
        this.cell[ft] = [];
      }
      this.cell[ft].push(...snippets);
    });
  }

  async get(ft: string): Promise<NormalizedSnippet[]> {
    const snippets = [
      ...this.cell[ft] ?? [],
      ...this.cell["*"] ?? [],
    ];
    return await asyncFilter(snippets, async (snippet) => {
      if (snippet.if == null) {
        return true;
      } else if (isIfFunc(snippet.if)) {
        return Boolean(await snippet.if(this.denops));
      } else if (snippet.if === "base") {
        return Boolean(await this.denops.call("denippet#load#base", snippet.prefix));
      } else if (snippet.if === "start") {
        return Boolean(await this.denops.call("denippet#load#start", snippet.prefix));
      } else if (!snippet.eval) {
        return false;
      } else if (snippet.if === "vimscript") {
        return Boolean(await this.denops.call("eval", snippet.eval));
      } else {
        return Boolean(
          await this.denops.call("luaeval", "assert(loadstring(_A[1]))()", [snippet.eval]),
        );
      }
    });
  }

  async load(
    filepath: string,
    filetype: string | string[],
  ): Promise<void> {
    const newline = await getNewline(this.denops);
    let snippets: NormalizedSnippet[] = [];

    const extension = filepath.split(".").pop()!;
    if (extension === "ts") {
      const content = await import(path.toFileUrl(filepath).toString())
        .then((module) => module.snippets);
      u.assert(content, is.RecordOf(isTSSnippet));
      snippets = Object.entries(content).map(([name, snip]) => ({
        ...snip,
        name,
        prefix: toArray(snip.prefix ?? name),
        body: async (denops: Denops) => {
          return toString(
            typeof snip.body == "function" ? await snip.body(denops) : snip.body,
            newline,
          );
        },
        description: toString(snip.description, newline),
      }));
    } else {
      const raw = await Deno.readTextFile(filepath);
      if (["json", "toml", "yaml"].includes(extension)) {
        const content = (extension === "json")
          ? JSON.parse(raw)
          : extension === "toml"
          ? TOML.parse(raw)
          : YAML.parse(raw);
        u.assert(content, is.RecordOf(isRawSnippet));
        snippets = Object.entries(content).map(([name, snip]) => ({
          ...snip,
          name,
          prefix: toArray(snip.prefix ?? name),
          body: toString(snip.body, newline),
          description: toString(snip.description, newline),
        }));
      } else if (extension === "code-snippets") {
        const content = JSON.parse(raw);
        u.assert(content, is.RecordOf(isGlobalSnippet));
        for (const [name, snippet] of Object.entries(content)) {
          const ft = snippet.scope ? snippet.scope.split(",").map(langToFt) : "*";
          const snip = {
            ...snippet,
            name,
            prefix: toArray(snippet.prefix ?? name),
            body: toString(snippet.body, newline),
            description: toString(snippet.description, newline),
          };
          this.set(ft, [snip]);
        }
        return;
      } else {
        throw new Error(`Unknown extension: ${extension}`);
      }
    }

    this.set(filetype, snippets);
  }
}

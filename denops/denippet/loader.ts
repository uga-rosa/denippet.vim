import { Denops, is, TOML, u, YAML } from "./deps.ts";

function toArray<T>(x: T | T[]): T[] {
  return Array.isArray(x) ? x : [x];
}

function toString(x: unknown): string {
  if (is.ArrayOf(is.String)(x)) {
    return x.join("\n");
  } else {
    return `${x}`;
  }
}

const isRawSnippet = is.ObjectOf({
  prefix: is.OptionalOf(is.OneOf([is.String, is.ArrayOf(is.String)])),
  body: is.OneOf([is.String, is.ArrayOf(is.String)]),
  description: is.OptionalOf(is.String),
});

export type RawSnippet = u.PredicateType<typeof isRawSnippet>;

const isTSSnippet = is.ObjectOf({
  prefix: is.OptionalOf(is.OneOf([is.String, is.ArrayOf(is.String)])),
  body: is.OneOf([is.String, is.ArrayOf(is.String), is.Function]),
  description: is.OptionalOf(is.String),
});

export type TSSnippet = u.PredicateType<typeof isTSSnippet>;

export type NormalizedSnippet = {
  name: string;
  prefix: string[];
  body: string | ((denops: Denops) => Promise<string>);
  description?: string;
};

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

export function getSnippets(ft: string): NormalizedSnippet[] {
  return [
    ...Cell[ft] ?? [],
    ...Cell["*"] ?? [],
  ];
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
      name,
      prefix: toArray(snip.prefix ?? name),
      body: toString(snip.body),
      description: snip.description,
    }));
  } else if (extension === "ts") {
    const content = await import(filepath).then((module) => module.snippets);
    u.assert(content, is.RecordOf(isTSSnippet));
    snippets = Object.entries(content).map(([name, snip]) => ({
      name,
      prefix: toArray(snip.prefix ?? name),
      body: async (denops: Denops) => {
        return toString(
          typeof snip.body === "function" ? await snip.body(denops) : snip.body,
        );
      },
      description: snip.description,
    }));
  } else {
    throw new Error(`Unknown extension: ${extension}`);
  }

  setSnippets(filetype, snippets);
}

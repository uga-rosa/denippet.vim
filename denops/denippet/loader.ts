import { Denops, TOML, u, YAML } from "./deps.ts";
import { toArray, toString } from "./util.ts";

type RawSnippet = {
  prefix: string | string[];
  body: string | string[];
  description: string;
};

function assertRawSnippet(x: unknown): asserts x is Record<string, RawSnippet> {
  u.assert(
    x,
    u.isRecordOf(
      u.isObjectOf({
        prefix: u.isOneOf([u.isString, u.isArrayOf(u.isString)]),
        body: u.isOneOf([u.isString, u.isArrayOf(u.isString)]),
        description: u.isString,
      }),
    ),
  );
}

type TSSnippet = {
  prefix: string | string[];
  body:
    | string
    | string[]
    | ((denops: Denops) => string | string[] | Promise<string | string[]>);
  description: string;
};

function assertTSSnippet(x: unknown): asserts x is Record<string, TSSnippet> {
  u.assert(
    x,
    u.isRecordOf(
      u.isObjectOf({
        prefix: u.isOneOf([u.isString, u.isArrayOf(u.isString)]),
        body: u.isOneOf([u.isString, u.isArrayOf(u.isString), u.isFunction]),
        description: u.isString,
      }),
    ),
  );
}

export type Snippet = {
  name: string;
  prefix: string[];
  body: string | ((denops: Denops) => Promise<string>);
  description: string;
};

// Keys are filetypes
const Cell: Record<string, Snippet[]> = {};

function setSnippets(
  filetype: string | string[],
  snippets: Snippet[],
): void {
  toArray(filetype).forEach((ft) => {
    if (Cell[ft] === undefined) {
      Cell[ft] = [];
    }
    Cell[ft].push(...snippets);
  });
}

export function getSnippets(ft: string): Snippet[] {
  return Cell[ft] ?? [];
}

export async function load(
  filepath: string,
  filetype: string | string[],
): Promise<void> {
  const extension = filepath.split(".").pop()!;
  let snippets: Snippet[] = [];
  if (["json", "toml", "yaml"].includes(extension)) {
    const raw = await Deno.readTextFile(filepath);
    const content = extension === "json"
      ? JSON.parse(raw)
      : extension === "toml"
      ? TOML.parse(raw)
      : YAML.parse(raw);
    assertRawSnippet(content);
    snippets = Object.entries(content).map(([name, snip]) => ({
      name,
      prefix: toArray(snip.prefix),
      body: toString(snip.body),
      description: snip.description,
    }));
  } else if (extension === "ts") {
    const content = await import(filepath).then((module) => module.snippets);
    assertTSSnippet(content);
    snippets = Object.entries(content).map(([name, snip]) => ({
      name,
      prefix: toArray(snip.prefix),
      body: async (denops: Denops) => {
        return typeof snip.body === "function"
          ? toString(await snip.body(denops))
          : toString(snip.body);
      },
      description: snip.description,
    }));
  } else {
    throw new Error(`Unknown extension: ${extension}`);
  }

  setSnippets(filetype, snippets);
}

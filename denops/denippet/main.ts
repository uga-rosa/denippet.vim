import { au, Denops, echoerr, is, lambda, lsputil, op, u } from "./deps.ts";
import { getSnippets, load, NormalizedSnippet } from "./loader.ts";
import { ParseError, Snippet } from "./parser/vscode.ts";
import { Session } from "./session.ts";
import { register } from "./variable.ts";

type CompleteItem = {
  word: string;
  kind?: string;
  dup?: number;
  user_data?: unknown;
};

type SearchResult = {
  prefix: string;
  body: NormalizedSnippet["body"];
} | {
  prefix?: undefined;
  body?: undefined;
};

async function searchSnippet(
  denops: Denops,
): Promise<SearchResult> {
  const ctx = await lsputil.LineContext.create(denops);
  const lineBeforeCursor = ctx.text.slice(0, ctx.character);

  let bestMatch: SearchResult = {};
  const filetype = await op.filetype.get(denops);
  getSnippets(filetype).forEach((snippet) => {
    snippet.prefix.forEach((prefix) => {
      if (
        lineBeforeCursor.endsWith(prefix) &&
        (bestMatch.prefix === undefined ||
          prefix.length > bestMatch.prefix.length)
      ) {
        bestMatch = { prefix, body: snippet.body };
      }
    });
  });
  return bestMatch;
}

export function main(denops: Denops): void {
  const session = new Session(denops);

  denops.dispatcher = {
    async load(
      filepathU: unknown,
      filetypeU: unknown,
    ): Promise<void> {
      const filepath = u.ensure(filepathU, is.String);
      const filetype = u.ensure(
        filetypeU,
        is.OneOf([is.String, is.ArrayOf(is.String)]),
      );
      try {
        await load(filepath, filetype);
      } catch (e) {
        echoerr(denops, `Failed to load a snippet file ${filepath}.\n${e}`);
      }
    },

    async expandable(): Promise<boolean> {
      const { body } = await searchSnippet(denops);
      return body !== undefined;
    },

    async expand(): Promise<void> {
      const { prefix, body } = await searchSnippet(denops);
      if (body === undefined) {
        return;
      }
      await lsputil.linePatch(denops, prefix.length, 0, "");
      const bodyStr = typeof body === "string" ? body : await body(denops);
      await this.anonymous(bodyStr);
    },

    async anonymous(bodyU: unknown): Promise<void> {
      const body = u.ensure(bodyU, is.String);
      await session.expand(body);
      if (session.snippet) {
        await au.group(denops, "denippet-session", (helper) => {
          const clearId = lambda.register(denops, () => {
            session.drop(true);
          });
          helper.define(
            "InsertLeave",
            "*",
            `call denops#notify('${denops.name}', '${clearId}', [])`,
          );
          const updateId = lambda.register(denops, async () => {
            await session.snippet?.update();
          });
          helper.define(
            "TextChangedI",
            "*",
            `call denops#notify('${denops.name}', '${updateId}', [])`,
          );
        });
      }
    },

    jumpable(dirU: unknown): boolean {
      const dir = u.ensure(dirU, is.LiteralOneOf([1, -1] as const));
      return session.jumpable(dir);
    },

    async jump(dirU: unknown): Promise<void> {
      const dir = u.ensure(dirU, is.LiteralOneOf([1, -1] as const));
      if (!session.snippet) {
        return;
      }
      session.guard();
      await session.jump(dir);
      await denops.cmd("do InsertLeave");
      session.unguard();
    },

    choosable(): boolean {
      return session.choosable();
    },

    async choice(dirU: unknown): Promise<void> {
      const dir = u.ensure(dirU, is.LiteralOneOf([1, -1] as const));
      await session.choice(dir);
    },

    async getCompleteItems(): Promise<CompleteItem[]> {
      const filetype = await op.filetype.get(denops);
      return (await Promise.all(
        getSnippets(filetype).map(async (snippet) => ({
          ...snippet,
          body: typeof snippet.body === "string" ? snippet.body : await snippet.body(denops),
        })),
      )).flatMap((snippet) =>
        snippet.prefix.map((prefix) => ({
          word: prefix,
          kind: "Snippet",
          dup: 1,
          user_data: { denippet: { body: snippet.body } },
        }))
      );
    },

    async snippetToString(bodyU: unknown): Promise<string> {
      const body = u.ensure(bodyU, is.String);
      const result = Snippet(body, 0, denops);
      if (!result.parsed) {
        throw new ParseError("Failed parsing");
      }
      const snippet = result.value;
      return await snippet.getText();
    },

    registerVariable(nameU: unknown, idU: unknown): void {
      const name = u.ensure(nameU, is.String);
      const id = u.ensure(idU, is.String);
      const cb = async (denops: Denops) => {
        const retval = await denops.call("denops#callback#call", id);
        u.assert(retval, is.OptionalOf(is.String));
        return retval;
      };
      register(name, cb);
    },
  };
}

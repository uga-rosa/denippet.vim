import { au, Denops, lambda, lsputil, op, u } from "./deps.ts";
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
        (bestMatch.prefix == null || prefix.length > bestMatch.prefix.length)
      ) {
        bestMatch = { prefix, body: snippet.body };
      }
    });
  });
  return bestMatch;
}

export function main(denops: Denops): void {
  let session: Session | undefined;

  denops.dispatcher = {
    async load(
      filepathU: unknown,
      filetypeU: unknown,
    ): Promise<void> {
      const filepath = u.ensure(filepathU, u.isString);
      const filetype = u.ensure(
        filetypeU,
        u.isOneOf([u.isString, u.isArrayOf(u.isString)]),
      );
      await load(filepath, filetype);
    },

    async expandable(): Promise<boolean> {
      const { body } = await searchSnippet(denops);
      return body != null;
    },

    async expand(): Promise<void> {
      const { prefix, body } = await searchSnippet(denops);
      if (body == null) {
        return;
      }
      await lsputil.linePatch(denops, prefix.length, 0, "");
      const bodyStr = typeof body === "string" ? body : await body(denops);
      await this.anonymous(bodyStr);
    },

    async anonymous(body: unknown): Promise<void> {
      u.assert(body, u.isString);
      session = await Session.create(denops, body);
      if (session != null) {
        await au.group(denops, "denippet-session", (helper) => {
          const clearId = lambda.register(denops, () => {
            session = undefined;
          });
          helper.define(
            "InsertLeave",
            "*",
            `call denops#notify('${denops.name}', '${clearId}', [])`,
          );
          const updateId = lambda.register(denops, async () => {
            await session?.update();
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
      const dir = u.ensure(dirU, u.isLiteralOneOf([1, -1] as const));
      if (session == null) {
        return false;
      } else if (dir === 1) {
        return session.nodeIndex < session.jumpableNodes.length - 1;
      } else {
        return session.nodeIndex > 0;
      }
    },

    async jump(dirU: unknown): Promise<void> {
      const dir = u.ensure(dirU, u.isLiteralOneOf([1, -1] as const));
      if (session == null) {
        return;
      }
      const sessionKeeped = session;
      await session.jump(dir);
      await denops.cmd("do InsertLeave");
      session = sessionKeeped;
    },

    choosable(): boolean {
      return session?.currentNode().type === "choice";
    },

    async choice(dirU: unknown): Promise<void> {
      const dir = u.ensure(dirU, u.isLiteralOneOf([1, -1] as const));
      await session?.choice(dir);
    },

    async getCompleteItems(): Promise<CompleteItem[]> {
      const filetype = await op.filetype.get(denops);
      return getSnippets(filetype).flatMap((snippet) =>
        snippet.prefix.map((prefix) => ({
          word: prefix,
          kind: "Snippet",
          dup: 1,
          user_data: { denippet: { body: snippet.body } },
        }))
      );
    },

    async snippetToString(bodyU: unknown): Promise<string> {
      const body = u.ensure(bodyU, u.isString);
      const result = Snippet(body, 0, denops);
      if (!result.parsed) {
        throw new ParseError("Failed parsing");
      }
      const snippet = result.value;
      return await snippet.getText();
    },

    registerVariable(nameU: unknown, idU: unknown): void {
      const name = u.ensure(nameU, u.isString);
      const id = u.ensure(idU, u.isString);
      const cb = async (denops: Denops) => {
        const retval = await denops.call("denops#callback#call", id);
        u.assert(retval, u.isOptionalOf(u.isString));
        return retval;
      };
      register(name, cb);
    },
  };
}

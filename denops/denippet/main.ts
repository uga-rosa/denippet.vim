import { Denops, lsputil, op, u } from "./deps.ts";
import { getSnippets, load, NormalizedSnippet } from "./loader.ts";
import { Session } from "./session.ts";

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
      const bodyStr = typeof body === "string" ? body : await body(denops);
      u.assert(bodyStr, u.isString);
      await lsputil.linePatch(denops, prefix.length, 0, "");
      session = await Session.create(denops, bodyStr);
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
      await session?.jump(dir);
    },

    choosable(): boolean {
      return session?.currentNode().type === "choice";
    },

    async choice(dirU: unknown): Promise<void> {
      const dir = u.ensure(dirU, u.isLiteralOneOf([1, -1] as const));
      await session?.selectChoice(dir);
    },
  };
}

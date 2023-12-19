import { au, Denops, fn, g, lambda } from "./deps/denops.ts";
import { is, u } from "./deps/unknownutil.ts";
import { lsputil } from "./deps/lsp.ts";
import { Loader, NormalizedSnippet } from "./loader.ts";
import { Session } from "./session.ts";
import { register } from "./variable.ts";
import { echoerr, normalizeNewline } from "./util.ts";
import { UserData } from "../@ddc-sources/denippet.ts";

type CompleteItem = {
  word: string;
  kind?: string;
  dup?: number;
  user_data?: UserData;
};

type SearchResult = {
  prefix: string;
  matched?: RegExpMatchArray;
  body: NormalizedSnippet["body"];
} | {
  prefix?: undefined;
  matched?: undefined;
  body?: undefined;
};

async function searchSnippet(
  loader: Loader,
  id?: string,
): Promise<SearchResult> {
  const ctx = await lsputil.LineContext.create(loader.denops);
  const lineBeforeCursor = ctx.text.slice(0, ctx.character);

  let bestMatch: SearchResult = {};
  const snippets: NormalizedSnippet[] = [];
  if (id != null) {
    const snippet = loader.getById(id);
    if (snippet != null) {
      snippets.push(snippet);
    }
  } else {
    snippets.push(...await loader.get());
  }
  snippets.forEach((snippet) => {
    snippet.prefix.forEach((prefix) => {
      if (
        lineBeforeCursor.endsWith(prefix) &&
        prefix.length > (bestMatch.prefix?.length ?? 0)
      ) {
        bestMatch = { prefix, body: snippet.body };
      }
    });
    snippet.prefix_regexp.forEach((regexp) => {
      const matched = regexp.exec(lineBeforeCursor);
      if (matched && matched[0].length > (bestMatch.prefix?.length ?? 0)) {
        bestMatch = { prefix: matched[0], matched, body: snippet.body };
      }
    });
  });
  return bestMatch;
}

export function main(denops: Denops): void {
  const session = new Session(denops);
  const loader = new Loader(denops);

  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  function debounceUpdate(syncDelay: number): void {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(async () => {
      const id = lambda.register(denops, async () => {
        await session.update(session.snippet?.currentNode().tabstop);
        return true;
      });
      await denops.call(
        "denippet#wait#wait",
        -1,
        `denops#request('${denops.name}', '${id}', [])`,
        1,
      );
    }, syncDelay);
  }

  async function forceUpdate(tabstop?: number): Promise<void> {
    clearTimeout(timeoutId);
    await session.update(tabstop);
  }

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
        await loader.load(filepath, filetype);
      } catch (e) {
        echoerr(denops, `Failed to load a snippet file ${filepath}.\n${e}`);
      }
    },

    async expandable(): Promise<boolean> {
      const { body } = await searchSnippet(loader);
      return body != null;
    },

    async expand(idU: unknown): Promise<void> {
      const id = u.ensure(idU, is.OptionalOf(is.String));
      const { prefix, matched, body } = await searchSnippet(loader, id);
      if (body == null) {
        return;
      }
      const bodyStr = is.String(body) ? body : await body(denops, matched);
      await this.anonymous(bodyStr, prefix);
    },

    async anonymous(bodyU: unknown, prefixU: unknown): Promise<void> {
      const body = normalizeNewline(u.ensure(bodyU, is.OneOf([is.String, is.ArrayOf(is.String)])));
      const prefix = u.ensure(prefixU, is.OptionalOf(is.String));
      if (await session.expand(body, prefix)) {
        const syncDelay = Number(await g.get(denops, "denippet_sync_delay"));

        await au.group(denops, "denippet-session", (helper) => {
          const clearId = lambda.register(denops, async () => {
            await forceUpdate();
            await session.drop();
          });
          helper.define(
            "ModeChanged",
            "*:n",
            `call denops#request('${denops.name}', '${clearId}', [])`,
          );
          if (syncDelay >= 0) {
            const updateId = lambda.register(denops, async () => {
              // pum.vim fires TextChangedI even if the popup menu is visible.
              if (await denops.call("pum#entered").catch(() => false)) {
                return;
              }
              debounceUpdate(syncDelay);
            });
            helper.define(
              "TextChangedI",
              "*",
              `call denops#notify('${denops.name}', '${updateId}', [])`,
            );
          }
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
      if ((await fn.mode(denops))[0] === "i") {
        await forceUpdate(session.snippet.currentNode().tabstop);
      }
      session.guard();
      await session.jump(dir);
      session.unguard();
      if (
        session.snippet?.currentNode().tabstop === 0 &&
        session.snippet?.outer == null &&
        await g.get(denops, "denippet_drop_on_zero", false)
      ) {
        await session.drop();
      }
    },

    choosable(): boolean {
      return session.choosable();
    },

    async choice(dirU: unknown): Promise<void> {
      const dir = u.ensure(dirU, is.LiteralOneOf([1, -1] as const));
      await session.choice(dir);
    },

    async getCompleteItems(): Promise<CompleteItem[]> {
      return (await loader.get()).flatMap((snippet) =>
        snippet.prefix.map((prefix) => ({
          word: prefix,
          kind: "Snippet",
          dup: 1,
          user_data: {
            denippet: {
              id: snippet.id,
              body: typeof snippet.body == "string" ? snippet.body : "",
              description: snippet.description ?? "",
            },
          },
        }))
      );
    },

    snippetToString(bodyU: unknown): string {
      const body = u.ensure(bodyU, is.String);
      const parsed = lsputil.parseSnippet(body);
      if (parsed === "") {
        throw new Error(`Failed parsing: ${body}`);
      }
      return parsed;
    },

    registerVariable(nameU: unknown, idU: unknown): void {
      const name = u.ensure(nameU, is.String);
      const id = u.ensure(idU, is.String);
      const cb = async (denops: Denops, text: string) => {
        const retval = await denops.call("denops#callback#call", id, text);
        u.assert(retval, is.String);
        return retval;
      };
      register(name, cb);
    },

    guard(): void {
      session.guard();
    },

    unguard(): void {
      session.unguard();
    },
  };
}

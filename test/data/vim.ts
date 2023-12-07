import { TSSnippet } from "../../denops/denippet/loader.ts";
import { Denops, fn } from "../../denops/denippet/deps/denops.ts";

export const snippets: Record<string, TSSnippet> = {
  "autoload function": {
    prefix: "fn",
    body: async (denops: Denops) => {
      const path = await fn.expand(denops, "%:p") as string;
      const match = path.match(/autoload\/(.+)\.vim$/);
      const prefix = match ? match[1].replaceAll("/", "#") + "#" : "";
      return [
        `function ${prefix}$1($2) abort`,
        "\t$0",
        "endfunction",
      ];
    },
  },
};

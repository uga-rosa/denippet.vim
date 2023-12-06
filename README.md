# denippet.vim

Denippet is a Vim/Neovim snippet plugin extended from VSCode's snippets.
Powered by [denops.vim](https://github.com/vim-denops/denops.vim).

See [doc](./doc/denippet.txt) for details.

## Features

- Full JS regular expression support
- Snippets can be defined in json/toml/yaml/TypeScript
- Dynamic snippets using TypeScript functions.
- Nested placeholders
    - You can define snippet like `console.log($1${2:, $1})$0`
- Nested snippet expansion
    - You can expand snippet even if you already activated other snippet.

## GIF

```toml
[usestate]
prefix = 'usestate'
body = "const [${1:state}, set${1/(.*)/${1:/capitalize}/}] = useState($2)"
```
![useState](https://github.com/uga-rosa/denippet.vim/assets/82267684/b771c997-41ee-45df-ac14-c62780ca1911)

```toml
[if]
prefix = 'if'
body = """
if ($1) {
  $0
}\
"""
```
![nested-expand](https://github.com/uga-rosa/denippet.vim/assets/82267684/73c5b6ff-a6af-4877-a674-83d3bd6fe36d)

```typescript
import { TSSnippet } from "https://deno.land/x/denippet_vim@v0.3.1/loader.ts";
import { Denops, fn } from "https://deno.land/x/denippet_vim@v0.3.1/deps/denops.ts";

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
```
![autoload-function](https://github.com/uga-rosa/denippet.vim/assets/82267684/463df60e-f1d3-4e7d-acb3-1f4d8e9566d4)

# denippet.vim

Denippet is a Vim/Neovim snippet plugin extended from VSCode's snippets.
Powered by [denops.vim](https://github.com/vim-denops/denops.vim).

See [doc](./doc/denippet.txt) for details.

## Features

- Nested placeholders
    - You can define snippet like `console.log($1${2:, $1})$0`
- Nested snippet expansion
    - You can expand snippet even if you already activated other snippet.
- Snippets can be defined in json/toml/yaml/TypeScript
- Flexible snippets using TypeScript functions.

## GIF

![useState](https://github.com/uga-rosa/denippet.vim/assets/82267684/b771c997-41ee-45df-ac14-c62780ca1911)
![nested-expand](https://github.com/uga-rosa/denippet.vim/assets/82267684/73c5b6ff-a6af-4877-a674-83d3bd6fe36d)
![autoload-function](https://github.com/uga-rosa/denippet.vim/assets/82267684/463df60e-f1d3-4e7d-acb3-1f4d8e9566d4)

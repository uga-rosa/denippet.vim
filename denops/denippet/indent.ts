// https://github.com/hrsh7th/vim-vsnip/blob/7753ba9c10429c29d25abfd11b4c60b76718c438/autoload/vsnip/indent.vim
// Copyright (c) 2019 hrsh7th

import { Denops, fn, op } from "./deps/denops.ts";
import { getNewline, splitLines } from "./util.ts";

async function getOneIndent(
  denops: Denops,
): Promise<string> {
  if (await op.expandtab.get(denops)) {
    let width = await op.shiftwidth.get(denops);
    if (width === 0) {
      width = await op.tabstop.get(denops);
    }
    return " ".repeat(width);
  } else {
    return "\t";
  }
}

async function getBaseIndent(
  denops: Denops,
): Promise<string> {
  const line = await fn.getline(denops, ".");
  return line.match(/^\s*/)?.[0] ?? "";
}

export async function adjustIndent(
  denops: Denops,
  text: string,
): Promise<string> {
  const newline = await getNewline(denops);
  text = text.replaceAll(newline, "\n");

  const oneIndent = await getOneIndent(denops);
  const baseIndent = await getBaseIndent(denops);
  if (oneIndent !== "\t") {
    text = text.replaceAll(
      /(?<=^|\n)\t+/g,
      (match) => oneIndent.repeat(match.length),
    );
  }
  // Add baseIndent to all lines except the first line.
  text = text.replaceAll("\n", `\n${baseIndent}`);
  // Remove indentation on all blank lines except the last line.
  text = text.replaceAll(/\n\s*\n/g, "\n\n");

  return text.replaceAll("\n", newline);
}

export async function trimBaseIndent(
  denops: Denops,
  text: string,
): Promise<string> {
  const newline = await getNewline(denops);

  text = text.replaceAll(newline, "\n");
  const isCharWise = !/\n$/.test(text);
  text = text.replace(/\n$/, "");

  let isFirstLine = true;
  let baseIndent = "";
  splitLines(text).forEach((line) => {
    // Ignore the first line when the text created as char-wise
    if (isCharWise && isFirstLine) {
      isFirstLine = false;
      return;
    }
    // Ignore empty line.
    if (line === "") {
      return;
    }
    // Detect most minimum base indent
    const indent = line.match(/^\s*/)![0];
    if (baseIndent === "" || indent.length < baseIndent.length) {
      baseIndent = indent;
    }
  });

  return text.replaceAll(new RegExp(`(^|\n)${baseIndent}`, "g"), "$1")
    .replaceAll("\n", newline);
}

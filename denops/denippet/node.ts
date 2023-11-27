import { Denops } from "./deps/denops.ts";
import { LSP, lsputil } from "./deps/lsp.ts";
import { camelcase } from "./deps/camelcase.ts";
import { splitLines } from "./util.ts";
import * as V from "./variable.ts";
import { clearExtmark, getExtmarks, setExtmark } from "./extmark.ts";

export type NodeType =
  | "snippet"
  | "tabstop"
  | "placeholder"
  | "choice"
  | "variable"
  | "transform"
  | "format"
  | "text";

export type FormatModifier =
  | "upcase"
  | "downcase"
  | "capitalize"
  | "camelcase"
  | "pascalcase";

function isSamePosition(a: LSP.Position, b: LSP.Position): boolean {
  return a.line === b.line && a.character === b.character;
}

function calcRange(start: LSP.Position, text: string): LSP.Range {
  const lines = splitLines(text);
  const endLine = start.line + lines.length - 1;
  const endCharacter = lines.length > 1
    ? lines[lines.length - 1].length
    : start.character + text.length;
  return { start, end: { line: endLine, character: endCharacter } };
}

export abstract class Node {
  abstract type: NodeType;
  abstract denops: Denops;
  /** 0-indexed, utf-16 offset, end-exclusive */
  range?: LSP.Range;

  isJumpable(): this is Jumpable {
    return ["tabstop", "placeholder", "choice"].includes(this.type);
  }

  getText(_tabstop?: number): string | Promise<string> {
    return "";
  }

  /** Return the position of end of range. */
  async updateRange(start: LSP.Position): Promise<LSP.Position> {
    const text = await this.getText();
    this.range = calcRange(start, text);
    return this.range.end;
  }
}

export class Snippet extends Node {
  type: "snippet" = "snippet";

  constructor(
    public denops: Denops,
    public children: (
      | Tabstop
      | Placeholder
      | Choice
      | Variable
      | Text
    )[],
  ) {
    super();
  }

  async getText(): Promise<string> {
    return await Promise.all(
      this.children.map(async (child) => await child.getText()),
    ).then((children) => children.join(""));
  }

  async updateRange(
    start?: LSP.Position,
    tabstop?: number,
  ): Promise<LSP.Position> {
    if (!start && !this.range) {
      throw new Error("Internal error: Node.Snippet.updateRange");
    }
    start = start ?? this.range!.start;
    let pos = start;
    for (const child of this.children) {
      pos = await child.updateRange(pos, tabstop);
    }
    this.range = { start, end: pos };
    return pos;
  }
}

function shiftRange(range: LSP.Range, start: LSP.Position): LSP.Range {
  if (range.start.line === range.end.line) {
    return {
      start,
      end: {
        line: start.line,
        character: start.character + range.end.character -
          range.start.character,
      },
    };
  } else {
    return {
      start,
      end: {
        line: start.line + range.end.line - range.start.line,
        character: range.end.character,
      },
    };
  }
}

export abstract class Jumpable extends Node {
  input?: string;
  copy?: Jumpable;
  abstract tabstop: number;
  abstract getPriority(): number;

  // Fire on TextChangedI
  async updateInput(range?: LSP.Range): Promise<void> {
    if (range != null) {
      this.range = range;
    } else {
      const extmarks = await getExtmarks(this.denops);
      if (extmarks.length === 0) {
        throw new Error("Internal error: Node.Jumpable.updateInput");
      }
      const range8 = extmarks[0].range;
      this.range = await lsputil.toUtf16Range(this.denops, 0, range8, "utf-8");
    }
    const lines = await lsputil.getText(this.denops, 0, this.range);
    this.input = lines.join("\n");
  }

  async updateRange(
    start: LSP.Position,
    tabstop?: number,
  ): Promise<LSP.Position> {
    const text = await this.getText(tabstop);
    const newRange = calcRange(start, text);
    if (this.copy != null && this.range != null) {
      const range = shiftRange(this.range, start);
      const replacement = splitLines(text);
      const originalText = await lsputil.getText(this.denops, 0, range);
      if (replacement.join("\n") !== originalText.join("\n")) {
        const cursor = await lsputil.getCursor(this.denops);
        await lsputil.setText(this.denops, 0, range, replacement);
        if (cursor.line === range.end.line && cursor.character >= range.end.character) {
          const fixedCursor = replacement.length > 1
            ? {
              line: cursor.line - (range.end.line - range.start.line) + replacement.length - 1,
              character: cursor.character - range.end.character +
                replacement[replacement.length - 1].length,
            }
            : {
              line: cursor.line - (range.end.line - range.start.line),
              character: cursor.character - range.end.character + range.start.character +
                replacement[0].length,
            };
          await lsputil.setCursor(this.denops, fixedCursor);
        }
      }
    }
    this.range = newRange;
    return this.range.end;
  }

  async setExtmark(): Promise<void> {
    if (this.range == null) {
      throw new Error("Internal error: Node.Jumpable.setMark");
    }
    await clearExtmark(this.denops);
    const range = await lsputil.toUtf8Range(this.denops, 0, this.range, "utf-16");
    await setExtmark(this.denops, range);
  }

  async jump(): Promise<void> {
    if (!this.range) {
      throw new Error("Internal error: Node.Jumpable.jump");
    }
    await clearExtmark(this.denops);
    await this.setExtmark();
    const range = await lsputil.toUtf8Range(this.denops, 0, this.range, "utf-16");
    if (isSamePosition(range.start, range.end)) {
      await this.denops.call("denippet#jump#move", range.start);
    } else {
      await this.denops.call("denippet#jump#select", range);
    }
  }
}

export class Tabstop extends Jumpable {
  type: "tabstop" = "tabstop";

  constructor(
    public denops: Denops,
    public tabstop: number,
    public transform?: Transform,
  ) {
    super();
  }

  async getText(tabstop?: number): Promise<string> {
    if (this.input != null) {
      return this.input;
    } else if (this.copy) {
      let text = await this.copy.getText(tabstop);
      if (tabstop !== this.tabstop && this.transform) {
        text = this.transform.transformer(text);
      }
      return text;
    } else {
      return "";
    }
  }

  getPriority(): number {
    return this.transform ? -1 : 0;
  }
}

export class Placeholder extends Jumpable {
  type: "placeholder" = "placeholder";

  constructor(
    public denops: Denops,
    public tabstop: number,
    public children: Snippet["children"],
  ) {
    super();
  }

  async getText(tabstop?: number): Promise<string> {
    if (this.input != null) {
      return this.input;
    } else if (this.copy != null) {
      return await this.copy.getText();
    } else {
      return await Promise.all(
        this.children.map(async (child) => await child.getText(tabstop)),
      ).then((children) => children.join(""));
    }
  }

  getPriority(): number {
    return this.children.length > 0 ? 1 : 0;
  }

  async updateRange(
    start: LSP.Position,
    tabstop?: number,
  ): Promise<LSP.Position> {
    if (this.input != null || this.copy != null) {
      const text = await this.getText(tabstop);
      this.range = calcRange(start, text);
      return this.range.end;
    }
    let pos = start;
    for (const child of this.children) {
      pos = await child.updateRange(pos, tabstop);
    }
    this.range = { start, end: pos };
    return pos;
  }
}

export class Choice extends Jumpable {
  type: "choice" = "choice";
  index = 0;

  constructor(
    public denops: Denops,
    public tabstop: number,
    public items: string[],
  ) {
    super();
  }

  getText(): string {
    return this.items[this.index] ?? "";
  }

  getPriority(): number {
    return 1;
  }

  selectNext(): void {
    if (++this.index >= this.items.length) {
      this.index = 0;
    }
  }

  selectPrev(): void {
    if (--this.index < 0) {
      this.index = this.items.length - 1;
    }
  }
}

export class Variable extends Node {
  type: "variable" = "variable";
  text?: string;

  constructor(
    public denops: Denops,
    public name: string,
    public transform?: Transform,
    public children?: Snippet["children"],
  ) {
    super();
  }

  async getText(): Promise<string> {
    if (this.text == null) {
      this.text = await V.call(this.denops, this.name) ?? "";
      if (this.transform) {
        this.text = this.transform.transformer(this.text);
      }
    }
    return this.text;
  }
}

export class Transform extends Node {
  type: "transform" = "transform";
  pattern: RegExp;
  formats: (Format | Text)[];

  constructor(
    public denops: Denops,
    pattern: string,
    formats: (Format | Text)[],
    option?: string,
  ) {
    super();
    this.pattern = new RegExp(pattern, option);
    this.formats = formats;
  }

  transformer(input: string): string {
    if (this.pattern.flags.includes("g")) {
      return input.replaceAll(
        this.pattern,
        this.formats.map((token) => token.getText()).join(""),
      );
    } else {
      return input.replace(
        this.pattern,
        (_match, ...rest) => {
          const submatches = rest.slice(0, -2) as string[];
          return this.formats.map((token) =>
            token.type === "format"
              ? token.format(submatches[token.captureIndex - 1])
              : token.getText()
          ).join("");
        },
      );
    }
  }
}

export class Format extends Node {
  type: "format" = "format";

  constructor(
    public denops: Denops,
    public captureIndex: number,
    public modifier?: FormatModifier,
    public ifText?: string,
    public elseText?: string,
  ) {
    super();
  }

  format(str?: string): string {
    if (str && this.ifText) {
      return this.ifText;
    } else if (!str && this.elseText) {
      return this.elseText;
    } else if (!str) {
      return "";
    }

    if (this.modifier === "upcase") {
      return str.toUpperCase();
    } else if (this.modifier === "downcase") {
      return str.toLowerCase();
    } else if (this.modifier === "capitalize") {
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    } else if (this.modifier === "camelcase") {
      return camelcase(str);
    } else if (this.modifier === "pascalcase") {
      return camelcase(str, { pascalCase: true });
    }

    return str;
  }
}

export class Text extends Node {
  type: "text" = "text";

  constructor(
    public denops: Denops,
    public text: string,
  ) {
    super();
  }

  getText(): string {
    return this.text;
  }
}

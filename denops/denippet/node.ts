import { api, Denops } from "./deps/denops.ts";
import { LSP, lsputil } from "./deps/lsp.ts";
import { camelcase } from "./deps/camelcase.ts";
import { splitLines } from "./util.ts";
import * as V from "./variable.ts";

export const NAMESPACE = "denippet_jumpable_node";

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

function calcRange(start: LSP.Position, text: string): LSP.Range {
  const lines = splitLines(text);
  const endLine = start.line + lines.length - 1;
  const endCharacter = lines.length > 1
    ? lines[lines.length - 1].length
    : start.character + text.length;
  return { start, end: { line: endLine, character: endCharacter } };
}

function isSamePosition(a: LSP.Position, b: LSP.Position): boolean {
  return a.line === b.line && a.character === b.character;
}

export abstract class Node {
  abstract type: NodeType;
  abstract denops: Denops;
  /** 0-indexed, utf-16 offset, end-exclusive */
  range?: LSP.Range;

  isJumpable(): this is Jumpable {
    return ["tabstop", "placeholder", "choice"].includes(this.type);
  }

  getText(_onJump?: boolean): string | Promise<string> {
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
    onJump?: boolean,
  ): Promise<LSP.Position> {
    if (!start && !this.range) {
      throw new Error("Internal error: Node.Snippet.updateRange");
    }
    start = start ?? this.range!.start;
    let pos = start;
    for (const child of this.children) {
      pos = await child.updateRange(pos, onJump);
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
  extmarkId?: number;
  abstract tabstop: number;
  abstract getPriority(): number;

  #nsId?: number;
  async nsId(): Promise<number> {
    if (this.#nsId === undefined) {
      this.#nsId = await api.nvim_create_namespace(
        this.denops,
        NAMESPACE,
      ) as number;
    }
    return this.#nsId;
  }

  // Fire on TextChangedI
  async updateInput(): Promise<void> {
    if (this.extmarkId === undefined) {
      return;
    }
    const [
      row,
      col,
      { end_row, end_col },
    ] = await api.nvim_buf_get_extmark_by_id(
      this.denops,
      0,
      await this.nsId(),
      this.extmarkId,
      { details: true },
    ) as [number, number, { end_row: number; end_col: number }];
    if (row === undefined) {
      // Invalid extmark id
      return;
    }
    const range8 = lsputil.createRange(row, col, end_row, end_col);
    const range16 = await lsputil.toUtf16Range(this.denops, 0, range8, "utf-8");
    this.range = range16;
    const lines = await lsputil.getText(
      this.denops,
      0,
      range16,
    );
    this.input = lines.join("\n");
  }

  async updateRange(
    start: LSP.Position,
    onJump?: boolean,
  ): Promise<LSP.Position> {
    const text = await this.getText(onJump);
    const newRange = calcRange(start, text);
    if (this.copy !== undefined && this.range !== undefined) {
      const range = shiftRange(this.range, start);
      const replacement = splitLines(text);
      await lsputil.setText(this.denops, 0, range, replacement);
    }
    this.range = newRange;
    return this.range.end;
  }

  async setExtmark(): Promise<void> {
    if (!this.range) {
      throw new Error("Internal error: Node.Jumpable.setExtmark");
    }
    this.extmarkId = await api.nvim_buf_set_extmark(
      this.denops,
      0,
      await this.nsId(),
      this.range.start.line,
      this.range.start.character,
      {
        end_row: this.range.end.line,
        end_col: this.range.end.character,
        right_gravity: false,
        end_right_gravity: true,
      },
    ) as number;
  }

  async drop(): Promise<void> {
    const nsId = await this.nsId();
    await api.nvim_buf_clear_namespace(this.denops, 0, nsId, 0, -1);
  }

  async jump(): Promise<void> {
    if (!this.range) {
      throw new Error("Internal error: Node.Jumpable.jump");
    }
    await this.drop();
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

  async getText(onJump?: boolean): Promise<string> {
    if (this.input !== undefined) {
      return this.input;
    } else if (this.copy) {
      let text = await this.copy.getText(onJump);
      if (onJump && this.transform) {
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

  async getText(onJump?: boolean): Promise<string> {
    if (this.input !== undefined) {
      return this.input;
    } else if (this.copy !== undefined) {
      return await this.copy.getText();
    } else {
      return await Promise.all(
        this.children.map(async (child) => await child.getText(onJump)),
      ).then((children) => children.join(""));
    }
  }

  getPriority(): number {
    return this.children.length > 0 ? 1 : 0;
  }

  async updateRange(
    start: LSP.Position,
    onJump?: boolean,
  ): Promise<LSP.Position> {
    if (this.input !== undefined || this.copy !== undefined) {
      const text = await this.getText(onJump);
      this.range = calcRange(start, text);
      return this.range.end;
    }
    let pos = start;
    for (const child of this.children) {
      pos = await child.updateRange(pos, onJump);
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

  async getText(onJump?: boolean): Promise<string> {
    if (this.text === undefined) {
      this.text = await V.call(this.denops, this.name) ?? "";
      if (onJump && this.transform) {
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

import { api, camelcase, Denops, LSP, lsputil } from "../deps.ts";

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

// 0-indexed, utf-16 offset
function calcRange(start: LSP.Position, text: string): LSP.Range {
  const lines = text.replaceAll(/\r\n?/g, "\n").split("\n");
  const endLine = start.line + lines.length - 1;
  const endCharacter = lines.length > 1
    ? lines[lines.length - 1].length
    : start.character + text.length;
  return { start, end: { line: endLine, character: endCharacter } };
}

function isSamePosition(a: LSP.Position, b: LSP.Position): boolean {
  return a.line === b.line && a.character === b.character;
}

function isSameRange(a: LSP.Range, b: LSP.Range): boolean {
  return isSamePosition(a.start, b.start) && isSamePosition(a.end, b.end);
}

export abstract class Node {
  abstract type: NodeType;
  abstract denops: Denops;
  range?: LSP.Range;

  isJumpable(): this is Jumpable {
    return ["tabstop", "placeholder", "choice"].includes(this.type);
  }

  getText(): string {
    return "";
  }

  /** 0-indexed, utf-16 offset */
  async updateRange(start: LSP.Position): Promise<LSP.Position> {
    const text = this.getText();
    const newRange = calcRange(start, text);
    if (this.range && !isSameRange(this.range, newRange)) {
      const text = this.getText();
      const replacement = text.replaceAll(/\r\n?/g, "\n").split("\n");
      await lsputil.setText(this.denops, 0, this.range, replacement);
    }
    this.range = newRange;
    return this.range.end;
  }
}

export class Snippet extends Node {
  type: "snippet" = "snippet";

  constructor(
    public children: (
      | Tabstop
      | Placeholder
      | Choice
      | Variable
      | Text
    )[],
    public denops: Denops,
  ) {
    super();
  }

  getText(): string {
    return this.children.map((child) => child.getText()).join("");
  }

  async updateRange(start?: LSP.Position): Promise<LSP.Position> {
    if (!start && !this.range) {
      throw new Error("Internal error: Node.Snippet.updateRange");
    }
    let pos = start ?? this.range!.start;
    for (const child of this.children) {
      pos = await child.updateRange(pos);
    }
    return pos;
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
    if (this.#nsId == null) {
      this.#nsId = await api.nvim_create_namespace(
        this.denops,
        NAMESPACE,
      ) as number;
    }
    return this.#nsId;
  }

  // Fire on TextChangedI
  async updateInput(): Promise<void> {
    if (this.extmarkId == null) {
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
    if (row == null) {
      // Invalid extmark id
      return;
    }
    const range8 = lsputil.createRange(row, col, end_row, end_col);
    const range16 = await lsputil.toUtf16Range(this.denops, 0, range8, "utf-8");
    const lines = await lsputil.getText(
      this.denops,
      0,
      range16,
    );
    this.input = lines.join("\n");
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
    await this.setExtmark();
    const range = this.range;
    if (isSamePosition(range.start, range.end)) {
      await lsputil.setCursor(this.denops, range.start);
      return;
    }
    await this.denops.cmd("stopinsert");
    const range8 = await lsputil.toUtf8Range(this.denops, 0, range, "utf-16");
    await this.denops.call("denippet#select", range8);
  }
}

export class Tabstop extends Jumpable {
  type: "tabstop" = "tabstop";
  transformer?: (input: string) => string;

  constructor(
    public denops: Denops,
    public tabstop: number,
    transform?: Transform,
  ) {
    super();

    this.transformer = transform?.transformer;
  }

  getText(): string {
    if (this.input != null) {
      return this.input;
    } else if (this.copy) {
      let text = this.copy.getText();
      if (this.transformer) {
        text = this.transformer(text);
      }
      return text;
    } else {
      return "";
    }
  }

  getPriority(): number {
    return this.transformer ? -1 : 0;
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

  getText(): string {
    if (this.input != null) {
      return this.input;
    } else if (this.copy) {
      return this.copy.getText();
    } else {
      return this.children.map((child) => child.getText()).join("");
    }
  }

  getPriority(): number {
    return this.children.length > 0 ? 1 : 0;
  }

  async updateRange(start: LSP.Position): Promise<LSP.Position> {
    let pos = start;
    for (const child of this.children) {
      pos = await child.updateRange(pos);
    }
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
    this.index++;
    if (this.index >= this.items.length) {
      this.index = 0;
    }
  }

  selectPrev(): void {
    this.index--;
    if (this.index < 0) {
      this.index = this.items.length - 1;
    }
  }
}

export class Variable extends Node {
  type: "variable" = "variable";
  transformer: (input: string) => string;

  constructor(
    public denops: Denops,
    public name: string,
    transform?: Transform,
    public children?: Snippet["children"],
  ) {
    super();

    this.transformer = transform
      ? transform.transformer
      : (input: string) => input;
  }

  getText(): string {
    // TODO
    return "";
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
      return str.charAt(0).toUpperCase() + str?.slice(1).toLowerCase();
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

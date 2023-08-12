import { camelcase } from "../deps.ts";

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

export abstract class Node {
  abstract type: NodeType;
  copy?: Jumpable;

  isJumpable(): this is Jumpable {
    return ["tabstop", "placeholder", "choice"].includes(this.type);
  }
}

export type Jumpable = Tabstop | Placeholder | Choice;

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
  ) {
    super();
  }
}

export class Tabstop extends Node {
  type: "tabstop" = "tabstop";

  constructor(
    public tabstop: number,
    public transform?: Transform,
  ) {
    super();
  }
}

export class Placeholder extends Node {
  type: "placeholder" = "placeholder";

  constructor(
    public tabstop: number,
    public children: Snippet["children"],
  ) {
    super();
  }
}

export class Choice extends Node {
  type: "choice" = "choice";

  constructor(
    public tabstop: number,
    public items: string[],
  ) {
    super();
  }
}

export class Variable extends Node {
  type: "variable" = "variable";

  constructor(
    public name: string,
    public transform?: Transform,
    public children?: Snippet["children"],
  ) {
    super();
  }
}

export class Transform extends Node {
  type: "transform" = "transform";
  pattern: RegExp;
  formats: (Format | Text)[];

  constructor(
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

  getText(): string {
    return "";
  }
}

export class Text extends Node {
  type: "text" = "text";

  constructor(
    public text: string,
  ) {
    super();
  }

  getText(): string {
    return this.text;
  }
}

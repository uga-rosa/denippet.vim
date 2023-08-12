import * as G from "./generator.ts";
import * as N from "./node.ts";

export class ParseError extends Error {
  static {
    this.prototype.name = "ParseError";
  }
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

// https://code.visualstudio.com/docs/editor/userdefinedsnippets#_grammar

const Dollar = G.token("$");
const Open = G.token("{");
const Close = G.token("}");
const Colon = G.token(":");
const Slash = G.token("/");
const Comma = G.token(",");
const Pipe = G.token("|");
const Plus = G.token("+");
const Minus = G.token("-");
const Question = G.token("?");

const Var = G.pattern("[_a-zA-Z][_a-zA-Z0-9]*");
const Int = G.map(G.pattern("[0-9]+"), (value) => Number(value));
const NonZeroInt = G.map(G.pattern("[1-9][0-9]*"), (value) => Number(value));

const Text = (targets: string[], specials: string[]) =>
  G.map(
    G.takeUntil(targets, specials),
    (value) => new N.Text(value.esc),
  );

const anyWithoutText: G.Parser<
  | N.Placeholder
  | N.Tabstop
  | N.Variable
  | N.Choice
> = G.lazy(() => G.or(Placeholder, Tabstop, Variable, Choice));

const Format = G.or(
  G.map(
    G.seq(
      Dollar,
      NonZeroInt,
    ),
    (values) => new N.Format(Number(values[1])),
  ),
  G.map(
    G.seq(
      Dollar,
      Open,
      NonZeroInt,
      Close,
    ),
    (values) => new N.Format(values[2]),
  ),
  G.map(
    G.seq(
      Dollar,
      Open,
      NonZeroInt,
      Colon,
      Slash,
      G.or<N.FormatModifier[]>(
        G.token("upcase"),
        G.token("downcase"),
        G.token("capitalize"),
        G.token("camelcase"),
        G.token("pascalcase"),
      ),
      Close,
    ),
    (values) => new N.Format(values[2], values[5]),
  ),
  G.map(
    G.seq(
      Dollar,
      Open,
      NonZeroInt,
      Colon,
      Plus,
      G.opt(G.takeUntil(["}"], ["\\"])),
      Close,
    ),
    (values) =>
      new N.Format(
        values[2],
        undefined,
        values[5]?.esc,
      ),
  ),
  G.map(
    G.seq(
      Dollar,
      Open,
      NonZeroInt,
      Colon,
      G.seq(
        Question,
        G.opt(G.takeUntil([":"], ["\\"])),
        Colon,
        G.opt(G.takeUntil(["}"], ["\\"])),
      ),
      Close,
    ),
    (values) =>
      new N.Format(
        values[2],
        undefined,
        values[4][1]?.esc,
        values[4][3]?.esc,
      ),
  ),
  G.map(
    G.seq(
      Dollar,
      Open,
      NonZeroInt,
      Colon,
      G.opt(Minus),
      G.opt(G.takeUntil(["}"], ["\\"])),
      Close,
    ),
    (values) =>
      new N.Format(
        values[2],
        undefined,
        undefined,
        values[5]?.esc,
      ),
  ),
);

const Transform = G.map(
  G.seq(
    Slash,
    G.takeUntil(["/"], ["\\"]),
    Slash,
    G.many(G.or(Format, Text(["$", "/"], ["\\"]))),
    Slash,
    G.opt(G.pattern("[ig]+")),
  ),
  (values) => new N.Transform(values[1].raw, values[3], values[5]),
);

const Tabstop = G.or(
  G.map(
    G.seq(
      Dollar,
      Int,
    ),
    (values) => new N.Tabstop(values[1]),
  ),
  G.map(
    G.seq(
      Dollar,
      Open,
      Int,
      Close,
    ),
    (values) => new N.Tabstop(values[2]),
  ),
  G.map(
    G.seq(
      Dollar,
      Open,
      Int,
      Transform,
      Close,
    ),
    (values) => new N.Tabstop(values[2], values[3]),
  ),
);

const Placeholder = G.map(
  G.seq(
    Dollar,
    Open,
    Int,
    Colon,
    G.opt(G.many(G.or(anyWithoutText, Text(["$", "}"], ["\\"])))),
    Close,
  ),
  (values) => new N.Placeholder(values[2], values[4] ?? []),
);

const Choice = G.map(
  G.seq(
    Dollar,
    Open,
    Int,
    Pipe,
    G.many(
      G.map(
        G.seq(Text([",", "|"], []), G.opt(Comma)),
        (values) => values[0].text,
      ),
    ),
    Pipe,
    Close,
  ),
  (values) => new N.Choice(values[2], values[4]),
);

const Variable = G.or(
  G.map(
    G.seq(
      Dollar,
      Var,
    ),
    (values) => new N.Variable(values[1]),
  ),
  G.map(
    G.seq(
      Dollar,
      Open,
      Var,
      Close,
    ),
    (values) => new N.Variable(values[2]),
  ),
  G.map(
    G.seq(
      Dollar,
      Open,
      Var,
      Transform,
      Close,
    ),
    (values) => new N.Variable(values[2], values[3]),
  ),
  G.map(
    G.seq(
      Dollar,
      Open,
      Var,
      Colon,
      G.many(G.or(anyWithoutText, Text(["$", "}"], ["\\"]))),
      Close,
    ),
    (values) => new N.Variable(values[2], undefined, values[4]),
  ),
);

export const Snippet = G.map(
  G.many(G.or(anyWithoutText, Text(["$"], ["}", "\\"]))),
  (values) => new N.Snippet(values),
);

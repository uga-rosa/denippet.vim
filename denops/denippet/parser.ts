import { Denops, LN, lsputil } from "./deps.ts";
import * as Node from "./node.ts";
import { adjustIndent } from "./indent.ts";

type ElementOf<T> = T extends (infer U)[] ? U : never;

export async function parse(
  denops: Denops,
  body: string,
): Promise<Node.Snippet> {
  body = await adjustIndent(denops, body);
  const result = lsputil.Parser(body, 0);
  if (!result.parsed) {
    throw new Error("Failed parsing");
  }

  function convert(n: LN.Tabstop): Node.Tabstop;
  function convert(n: LN.Placeholder): Node.Placeholder;
  function convert(n: LN.Choice): Node.Choice;
  function convert(n: LN.Variable): Node.Variable;
  function convert(n: LN.Text): Node.Text;
  function convert(n: ElementOf<LN.Snippet["children"]>): ElementOf<Node.Snippet["children"]>;
  function convert(n: ElementOf<LN.Snippet["children"]>): ElementOf<Node.Snippet["children"]> {
    if (LN.isTabstop(n)) {
      return new Node.Tabstop(
        denops,
        n.tabstop,
        convertTransform(n.transform),
      );
    } else if (LN.isPlaceholder(n)) {
      return new Node.Placeholder(denops, n.tabstop, n.children?.map(convert));
    } else if (LN.isChoice(n)) {
      return new Node.Choice(denops, n.tabstop, n.items);
    } else if (LN.isVariable(n)) {
      return new Node.Variable(
        denops,
        n.name,
        convertTransform(n.transform),
        n.children?.map(convert),
      );
    } else if (LN.isText(n)) {
      return new Node.Text(denops, n.text);
    } else {
      throw new Error("Unknown node");
    }
  }

  function convertTransform(n?: LN.Transform): Node.Transform | undefined {
    if (n === undefined) {
      return;
    }
    return new Node.Transform(
      denops,
      n.pattern,
      n.formats.map((n) => LN.isFormat(n) ? convertFormat(n) : convertText(n)),
      n.options,
    );
  }

  function convertFormat(n: LN.Format): Node.Format {
    return new Node.Format(denops, n.captureIndex, n.modifier, n.ifText, n.elseText);
  }

  function convertText(n: LN.Text): Node.Text {
    return new Node.Text(denops, n.text);
  }

  return new Node.Snippet(denops, result.value.children.map(convert));
}

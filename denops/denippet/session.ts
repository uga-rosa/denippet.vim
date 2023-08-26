import * as Node from "./parser/node.ts";
import { ParseError, Snippet } from "./parser/vscode.ts";
import { Denops, lsputil, u } from "./deps.ts";
import { adjustIndent } from "./indent.ts";

export class Session {
  nodeIndex = 0;

  constructor(
    public denops: Denops,
    public snippet: Node.Snippet,
    public jumpableNodes: Node.Jumpable[],
  ) {}

  static async create(
    denops: Denops,
    body: string,
  ): Promise<Session | undefined> {
    body = await adjustIndent(denops, body);
    const result = Snippet(body, 0, denops);
    if (!result.parsed) {
      throw new ParseError("Failed parsing");
    }
    const snippet = result.value;

    // Resolve reference relationships using breadth first search.
    const isJumpable = (token: Node.Node): token is Node.Jumpable =>
      token.isJumpable();
    const nodeQueue = snippet.children.filter((node) => node.type !== "text");
    // Key is tabstop
    const jumpableNodeMap = new Map<number, Node.Jumpable>();
    while (true) {
      const node = nodeQueue.shift();
      if (!node) {
        break;
      }

      if (u.isObjectOf({ children: u.isArray })(node)) {
        nodeQueue.push(...node.children.filter(isJumpable));
      }

      if (!node.isJumpable()) {
        continue;
      }

      const existNode = jumpableNodeMap.get(node.tabstop);
      if (!existNode) {
        jumpableNodeMap.set(node.tabstop, node);
      } else if (node.getPriority() > existNode.getPriority()) {
        existNode.copy = node;
        jumpableNodeMap.set(node.tabstop, node);
      } else {
        node.copy = existNode;
      }
    }

    // Sort in ascending order by tabstop.
    const jumpableNodes = [...jumpableNodeMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map((entry) => entry[1]);

    // Set the text to the buffer
    const insertText = snippet.getText();
    await lsputil.linePatch(denops, 0, 0, insertText);

    // No jumpable node
    if (jumpableNodes.length === 0) {
      return;
    }

    // Calculate range each node
    const cursor = await lsputil.getCursor(denops);
    snippet.updateRange(cursor);

    const session = new Session(denops, snippet, jumpableNodes);

    // Set extmarks
    await session.jumpableNodes[0].setExtmark();
  }

  currentNode(): Node.Jumpable {
    return this.jumpableNodes[this.nodeIndex];
  }

  async update() {
    await this.currentNode().updateInput();
    this.snippet.updateRange();
  }
}
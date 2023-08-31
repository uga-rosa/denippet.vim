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
      .sort((a, b) => {
        if (a[0] === 0) {
          return 1;
        } else if (b[0] === 0) {
          return -1;
        }
        return a[0] - b[0];
      })
      .map((entry) => entry[1]);

    // Store the cursor position before do linePatch
    const cursor = await lsputil.getCursor(denops);
    // Set the text to the buffer
    const insertText = snippet.getText();
    await lsputil.linePatch(denops, 0, 0, insertText);

    // No jumpable node
    if (jumpableNodes.length === 0) {
      return;
    }

    // Calculate range each node
    await snippet.updateRange(cursor);

    // Jump to the first node
    await jumpableNodes[0].jump();
    if (jumpableNodes.length === 1 && jumpableNodes[0].tabstop === 0) {
      return;
    }
    const session = new Session(denops, snippet, jumpableNodes);
    return session;
  }

  currentNode(): Node.Jumpable {
    return this.jumpableNodes[this.nodeIndex];
  }

  async update() {
    await this.currentNode().updateInput();
    this.snippet.updateRange();
  }

  async jump(dir: 1 | -1): Promise<void> {
    if (dir === 1) {
      if (this.nodeIndex >= this.jumpableNodes.length - 1) {
        this.nodeIndex = this.jumpableNodes.length - 1;
        return;
      }
      this.nodeIndex++;
    } else {
      if (this.nodeIndex <= 0) {
        this.nodeIndex = 0;
        return;
      }
      this.nodeIndex--;
    }
    await this.currentNode().jump();
  }

  async selectChoice(dir: 1 | -1): Promise<void> {
    const node = this.currentNode();
    if (!isChoiceNode(node)) {
      return;
    }
    if (dir === 1) {
      node.selectNext();
    } else {
      node.selectPrev();
    }
    await this.snippet.updateRange();
  }
}

function isChoiceNode(node: Node.Jumpable): node is Node.Choice {
  return node.type === "choice";
}

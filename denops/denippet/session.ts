import { au, Denops } from "./deps/denops.ts";
import { clearExtmark } from "./extmark.ts";
import { Dir, Snippet } from "./snippet.ts";
import { echoerr } from "./util.ts";

export class Session {
  snippet?: Snippet;
  isGuarded = false;

  constructor(
    public denops: Denops,
  ) {}

  async expand(
    body: string,
    prefix?: string,
  ): Promise<boolean> {
    const snippet = await Snippet.create(this.denops, body, this.snippet, prefix);
    if (snippet.jumpableNodes.length > 0 && snippet.jumpableNodes[0].tabstop > 0) {
      this.snippet = snippet;
      await this.snippet.doNodeEnter();
      return true;
    } else {
      // No jumpable nodes or only $0
      await clearExtmark(this.denops);
      if (this.snippet != null) {
        const range = this.snippet.currentNode().range!;
        range.end = snippet.snippet.range!.end;
        await this.snippet.currentNode().updateInput(range);
        await this.snippet.currentNode().setExtmark();
        await this.snippet.setVar();
      }
      return false;
    }
  }

  guard(): void {
    this.isGuarded = true;
  }

  unguard(): void {
    this.isGuarded = false;
  }

  async drop(): Promise<void> {
    if (this.isGuarded) {
      return;
    }
    await this.snippet?.doNodeLeave();
    this.snippet = undefined;
    await au.group(this.denops, "denippet-session", (helper) => {
      helper.remove(["ModeChanged", "TextChangedI"]);
    });
    await clearExtmark(this.denops);
  }

  async update(tabstop?: number): Promise<void> {
    if (this.isGuarded) {
      return;
    }
    this.guard();
    try {
      await this.snippet?.update(tabstop);
    } catch (e) {
      echoerr(this.denops, e);
      this.unguard();
      await this.drop();
    }
    this.unguard();
  }

  jumpable(dir: Dir): boolean {
    return !!this.snippet?.jumpable(dir);
  }

  async jump(dir: Dir): Promise<void> {
    if (!this.snippet) {
      return;
    }
    let snippet: Snippet | undefined = this.snippet;
    while (snippet && !await snippet.jump(dir)) {
      const innerSnippetNode = snippet.snippet;
      snippet = snippet.outer;
      if (snippet && innerSnippetNode) {
        const node = snippet.currentNode();
        node.range!.end = innerSnippetNode.range!.end;
        if (node.type === "tabstop" || node.type === "placeholder") {
          node.input += await innerSnippetNode.getText();
        }
      }
    }
    if (snippet) {
      this.snippet = snippet;
    }
  }

  choosable(): boolean {
    return !!this.snippet?.choosable();
  }

  async choice(dir: Dir): Promise<void> {
    await this.snippet?.choice(dir);
  }
}

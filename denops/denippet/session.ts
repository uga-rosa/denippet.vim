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
    if (snippet != null) {
      this.snippet = snippet;
      return true;
    } else {
      // No jumpable nodes or only $0
      await clearExtmark(this.denops);
      if (this.snippet != null) {
        await this.snippet.currentNode().updateInput(snippet.snippet.range);
        await this.snippet.currentNode().setExtmark();
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
    try {
      await this.snippet?.update(tabstop);
    } catch (e) {
      echoerr(this.denops, e);
      await this.drop();
    }
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
        node.range = innerSnippetNode.range;
        if (node.type === "tabstop" || node.type === "placeholder") {
          node.input = await innerSnippetNode.getText();
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

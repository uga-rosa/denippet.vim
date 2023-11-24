import { au, Denops } from "./deps/denops.ts";
import { Dir, Snippet } from "./snippet.ts";

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
      return true;
    } else {
      // No jumpable nodes or only $0
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
  }

  async update(): Promise<void> {
    if (this.isGuarded) {
      return;
    }
    try {
      await this.snippet?.update();
    } catch {
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
      const range = snippet.snippet.range;
      snippet = snippet.outer;
      if (snippet && range) {
        snippet.currentNode().range = range;
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

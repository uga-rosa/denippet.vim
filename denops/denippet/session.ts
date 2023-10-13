import { Denops } from "./deps/denops.ts";
import { Dir, Snippet } from "./snippet.ts";

export class Session {
  snippet?: Snippet;
  isGuarded = false;

  constructor(
    public denops: Denops,
  ) {}

  async expand(body: string): Promise<void> {
    this.snippet = await Snippet.create(this.denops, body, this.snippet) ??
      this.snippet;
  }

  drop(all = false): void {
    if (this.isGuarded) {
      return;
    }
    if (all) {
      this.snippet = undefined;
    } else {
      this.snippet = this.snippet?.outer;
    }
  }

  guard(): void {
    this.isGuarded = true;
  }

  unguard(): void {
    this.isGuarded = false;
  }

  async update(): Promise<void> {
    try {
      await this.snippet?.update();
    } catch {
      this.drop();
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
      snippet = snippet.outer;
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

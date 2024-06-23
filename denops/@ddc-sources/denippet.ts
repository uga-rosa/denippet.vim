import {
  BaseSource,
  DdcGatherItems,
  Item,
  Previewer,
} from "https://deno.land/x/ddc_vim@v5.0.1/types.ts";
import {
  GatherArguments,
  GetPreviewerArguments,
  OnCompleteDoneArguments,
} from "https://deno.land/x/ddc_vim@v5.0.1/base/source.ts";
import { Denops, op } from "../denippet/deps/denops.ts";
import { splitLines } from "../denippet/util.ts";
import { lsputil } from "../denippet/deps/lsp.ts";

type Params = Record<PropertyKey, never>;

export type UserData = {
  denippet: {
    id: string;
    body: string;
    description: string;
  };
};

type CompletedEvent =
  | "confirm"
  | "confirm_word"
  | "complete_done"
  | "undefined";

export class Source extends BaseSource<Params> {
  async gather({
    denops,
  }: GatherArguments<Params>): Promise<DdcGatherItems> {
    // We have to go through Vim script to guarantee that Denippet is loaded.
    return await denops.call(
      "denippet#get_complete_items",
      false,
    ) as Item<UserData>[];
  }

  async onCompleteDone({
    denops,
    userData,
  }: OnCompleteDoneArguments<Params, UserData>): Promise<void> {
    // Not expanded if confirmed with additional input.
    const completed_event = await denops.eval("g:pum#completed_event")
      .catch(() => "undefined") as CompletedEvent;
    if (completed_event === "complete_done") {
      return;
    } else if (completed_event === "undefined") {
      // native-ui
      const itemWord = await denops.eval(`v:completed_item.word`) as string;
      const ctx = await lsputil.LineContext.create(denops);
      const beforeLine = ctx.text.slice(0, ctx.character);
      if (!beforeLine.endsWith(itemWord)) {
        return;
      }
    }

    await denops.dispatch("denippet", "expand", userData.denippet.id);
    await denops.call("ddc#skip_next_complete");
  }

  async getPreviewer({
    denops,
    item,
  }: GetPreviewerArguments<Params, UserData>): Promise<Previewer> {
    const userData = item.user_data;
    if (userData == null) {
      return { kind: "empty" };
    }
    const contents: string[] = await this.snippetToString(denops, userData.denippet.body)
      .then(splitLines)
      .catch(() => []);
    if (contents.length > 0) {
      const filetype = await op.filetype.get(denops);
      contents.unshift("```" + filetype);
      contents.push("```");
    }
    if (userData.denippet.description) {
      contents.unshift(userData.denippet.description);
    }
    return { kind: "markdown", contents };
  }

  async snippetToString(
    denops: Denops,
    body: string,
  ): Promise<string> {
    return await denops.dispatch(
      "denippet",
      "snippetToString",
      body,
    ) as string;
  }

  params(): Params {
    return {};
  }
}

import { api, Denops, vim } from "./deps/denops.ts";
import { LSP, lsputil } from "./deps/lsp.ts";

const NAMESPACE = "denippet_jumpable_node";

async function ensureNsId(denops: Denops): Promise<number> {
  return await api.nvim_create_namespace(denops, NAMESPACE) as number;
}

async function ensurePropType(denops: Denops): Promise<string> {
  try {
    await vim.prop_type_add(denops, NAMESPACE, {
      start_incl: true,
      end_incl: true,
    });
  } catch {
    // Already defined
  }
  return NAMESPACE;
}

export async function setExtmark(
  denops: Denops,
  range: LSP.Range,
  extmarkId?: number,
): Promise<void> {
  if (denops.meta.host === "nvim") {
    const opts: Record<string, unknown> = {
      end_row: range.end.line,
      end_col: range.end.character,
      right_gravity: false,
      end_right_gravity: true,
    };
    if (extmarkId != null) {
      opts.id = extmarkId;
    }
    extmarkId = await api.nvim_buf_set_extmark(
      denops,
      0,
      await ensureNsId(denops),
      range.start.line,
      range.start.character,
      opts,
    ) as number;
  } else {
    await vim.prop_add(
      denops,
      range.start.line + 1,
      range.start.character + 1,
      {
        type: await ensurePropType(denops),
        id: extmarkId ?? 23432,
        end_lnum: range.end.line + 1,
        end_col: range.end.character + 1,
      },
    );
  }
}

type Extmark = {
  nsId: number;
  extmarkId: number;
  range: LSP.Range;
};

export async function getExtmarks(
  denops: Denops,
  lnum?: number,
): Promise<Extmark[]> {
  if (denops.meta.host === "nvim") {
    const range = lnum == null ? [0, -1] : [[lnum, 0], [lnum + 1, 0]];
    const nsId = await ensureNsId(denops);
    const extmarks = await api.nvim_buf_get_extmarks(
      denops,
      0,
      nsId,
      range[0],
      range[1],
      { details: true },
    ) as [
      extmark_id: number,
      row: number,
      col: number,
      { end_row: number; end_col: number },
    ][];
    return extmarks.map((mark) => ({
      nsId,
      extmarkId: mark[0],
      range: lsputil.createRange(mark[1], mark[2], mark[3].end_row, mark[3].end_col),
    }));
  } else {
    const range = lnum == null ? [1, -1] : [lnum + 1, lnum + 1];
    const propType = await ensurePropType(denops);
    const props = await vim.prop_list(denops, range[0], {
      end_lnum: range[1],
      type: propType,
    }) as {
      lnum: number;
      col: number;
      length: number;
      id: number;
      start: boolean;
      end: boolean;
    }[];

    const extmarks: Extmark[] = [];
    for (let prop of props) {
      if (!prop.start) {
        continue;
      }
      const start = { line: prop.lnum - 1, character: prop.col - 1 };
      while (!prop.end) {
        prop = await vim.prop_find(denops, {
          type: propType,
          lnum: prop.lnum + 1,
        }) as typeof props[number];
      }
      const range = { start, end: { line: prop.lnum - 1, character: prop.col + prop.length - 1 } };
      extmarks.push({ nsId: -1, extmarkId: prop.id, range });
    }
    return extmarks;
  }
}

export async function clearExtmark(
  denops: Denops,
): Promise<void> {
  if (denops.meta.host === "nvim") {
    await api.nvim_buf_clear_namespace(denops, 0, await ensureNsId(denops), 0, -1);
  } else {
    await vim.prop_remove(denops, { type: await ensurePropType(denops), all: true });
  }
}

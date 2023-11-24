import { api, batch, Denops } from "./deps/denops.ts";
import { LSP, lsputil } from "./deps/lsp.ts";
import { NAMESPACE } from "./node.ts";

export async function asyncFilter<T>(
  array: T[],
  callback: (x: T) => Promise<boolean>,
): Promise<T[]> {
  const bits = await Promise.all(array.map(callback));
  return array.filter((_, i) => bits[i]);
}

export function splitLines(text: string): [string, ...string[]] {
  return text.replaceAll(/\r\n?/g, "\n").split("\n") as [string, ...string[]];
}

type Extmark = [
  extmark_id: number,
  row: number,
  col: number,
  details:
    & Record<string, unknown>
    & {
      ns_id?: number;
      end_col?: number;
      end_row?: number;
    },
];

/**
 * Fix extmarks position
 *
 *                cursor
 *         before ↓ after
 *    xxxxx|xxxxxx|xxxxx|xxxxx -> xxxxx|yyyyy|xxxxxx
 * 1.  ---                         ---
 * 2.  --------                    ----------
 * 3.  ----------------------      ----------------
 * 4.        ---                        -----
 * 5.         ---------------           -----------
 * 6.                     ---                   ---
 */
export async function linePatch(
  denops: Denops,
  before: number,
  after: number,
  insertText: string,
): Promise<void> {
  const cursor = await lsputil.getCursor(denops);
  const lines = splitLines(insertText);

  function shift(pos: LSP.Position): LSP.Position {
    if (lines.length > 1) {
      return {
        line: pos.line + lines.length - 1,
        character: lines[lines.length - 1].length + pos.character - cursor.character - after,
      };
    } else {
      return {
        line: pos.line,
        character: pos.character - before - after + insertText.length,
      };
    }
  }

  // Save and adjust extmarks
  const nsId = await api.nvim_create_namespace(denops, NAMESPACE) as number;
  const extmarks = (await api.nvim_buf_get_extmarks(
    denops,
    0,
    nsId,
    [cursor.line, 0],
    [cursor.line + 1, 0],
    { details: true },
  ) as Extmark[]).map((mark) => {
    if (mark[2] > cursor.character + after) {
      // 6
      const startPos = lsputil.createPosition(mark[1], mark[2]);
      const newStartPos = shift(startPos);
      mark[1] = newStartPos.line;
      mark[2] = newStartPos.character;
    } else if (mark[2] > cursor.character - before) {
      // 4 and 5
      mark[2] = cursor.character - before;
    }
    const details = mark[3];
    if (details.end_row != null && details.end_col != null) {
      const endPos = lsputil.createPosition(details.end_row, details.end_col);
      const beforePos = { ...cursor, character: cursor.character - before };
      const afterPos = { ...cursor, character: cursor.character + after };
      if (lsputil.isPositionBefore(afterPos, endPos)) {
        // 3, 5 and 6
        const newEndPos = shift(endPos);
        details.end_row = newEndPos.line;
        details.end_col = newEndPos.character;
      } else if (lsputil.isPositionBefore(beforePos, endPos, true)) {
        // 2 and 4
        const newAfterPos = shift(afterPos);
        details.end_row = newAfterPos.line;
        details.end_col = newAfterPos.character;
      }
    }
    return mark;
  });

  await lsputil.linePatch(denops, before, after, insertText);

  // Restore extmarks
  await batch(denops, async (denops) => {
    for (const mark of extmarks) {
      const nsId = mark[3].ns_id;
      delete mark[3].ns_id;
      mark[3].id = mark[0];
      await api.nvim_buf_set_extmark(denops, 0, nsId, mark[1], mark[2], mark[3]);
    }
  });
}

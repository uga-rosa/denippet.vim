import { batch, Denops } from "./deps/denops.ts";
import { LSP, lsputil } from "./deps/lsp.ts";
import { getExtmarks, setExtmark } from "./extmark.ts";

export async function echoerr(
  denops: Denops,
  msg: string | Error,
): Promise<void> {
  await batch(denops, async (denops) => {
    await denops.cmd("echohl Error");
    await denops.cmd("echom l:msg", { msg: `${msg}` });
    await denops.cmd("echohl None");
  });
}

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
  const extmarks = (await getExtmarks(denops, cursor.line)).map((mark) => {
    let start = mark.range.start;
    let end = mark.range.end;

    if (start.character > cursor.character + after) {
      // 6
      start = shift(start);
    } else if (start.character > cursor.character - before) {
      // 4 and 5
      start.character = cursor.character - before;
    }

    const beforePos = { ...cursor };
    beforePos.character -= before;
    const afterPos = { ...cursor };
    afterPos.character += after;
    if (lsputil.isPositionBefore(afterPos, end)) {
      // 3, 5 and 6
      end = shift(end);
    } else if (lsputil.isPositionBefore(beforePos, end, true)) {
      // 2 and 4
      end = shift(afterPos);
    }
    return { ...mark, range: { start, end } };
  });

  await lsputil.linePatch(denops, before, after, insertText);

  // Restore extmarks
  for (const mark of extmarks) {
    await setExtmark(denops, mark.range, mark.extmarkId);
  }
}

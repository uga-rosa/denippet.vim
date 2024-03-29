import { batch, Denops, Keymap, q } from "./deps/denops.ts";
import { is } from "./deps/unknownutil.ts";

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

export function normalizeNewline(text: string | string[]): string {
  if (is.String(text)) {
    return text.replaceAll(/\r\n?/g, "\n");
  } else {
    return text.join("\n");
  }
}

export function splitLines(text: string): string[] {
  return normalizeNewline(text).split("\n");
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
  await Keymap.send(denops, [
    q`${q`\<C-g>U\<Left>\<Del>`.repeat(before)}`,
    q`${q`\<Del>`.repeat(after)}`,
    q`${insertText.replaceAll("\n", "\n\\<C-u>")}`,
  ]);
}

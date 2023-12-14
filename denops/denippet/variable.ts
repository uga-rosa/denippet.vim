// https://code.visualstudio.com/docs/editor/userdefinedsnippets#_variables

import { Denops, fn, op } from "./deps/denops.ts";
import { is } from "./deps/unknownutil.ts";
import { trimBaseIndent } from "./indent.ts";

export type VariableFunc = (denops: Denops, text: string) => string | Promise<string>;

const Cell: Record<string, VariableFunc> = {};

export function register(
  name: string,
  cb: VariableFunc,
): void {
  Cell[name] = cb;
}

export async function call(
  denops: Denops,
  name: string,
  text: string,
): Promise<string> {
  return await Cell[name]?.(denops, text);
}

/** The currently selected text or the empty string */
register("TM_SELECTED_TEXT", async (denops) => {
  const text = await fn.getreg(denops, `"`) as string;
  return trimBaseIndent(text);
});

/** The contents of the current line */
register("TM_CURRENT_LINE", async (denops) => {
  return await fn.getline(denops, ".");
});

/** The contents of the word under cursor or the empty string */
register("TM_CURRENT_WORD", () => "");

/** The zero-index based line number */
register("TM_LINE_INDEX", async (denops) => {
  return (await fn.line(denops, ".") - 1).toString();
});

/** The one-index based line number */
register("TM_LINE_NUMBER", async (denops) => {
  return (await fn.line(denops, ".")).toString();
});

/** The filename of the current document */
register("TM_FILENAME", async (denops) => {
  return (await fn.expand(denops, "%:p:t")) as string;
});

/** The filename of the current document without its extensions */
register("TM_FILENAME_BASE", async (denops) => {
  return (await fn.expand(denops, "%:p:t:r")) as string;
});

/** The directory of the current document */
register("TM_DIRECTORY", async (denops) => {
  return (await fn.expand(denops, "%:p:h:t")) as string;
});

/** The full file path of the current document */
register("TM_FILEPATH", async (denops) => {
  return (await fn.expand(denops, "%:p")) as string;
});

/**
 * The relative (to the opened workspace or folder) file path of
 * the current document
 */
register("RELATIVE_FILEPATH", async (denops) => {
  return (await fn.expand(denops, "%")) as string;
});

/** The contents of your clipboard */
register("CLIPBOARD", async (denops, text) => {
  const clipboard = await fn.getreg(denops) as string;
  if (is.String(clipboard)) {
    return trimBaseIndent(clipboard);
  }
  return text;
});

/** The name of the opened workspace or folder */
register("WORKSPACE_NAME", () => "");

/** The path of the opened workspace or folder */
register("WORKSPACE_FOLDER", () => "");

/** The zero-index based cursor number */
register("CURSOR_INDEX", () => "0");

/** The one-index based cursor number */
register("CURSOR_NUMBER", () => "1");

/** The current year */
register("CURRENT_YEAR", async (denops) => {
  return await fn.strftime(denops, "%Y");
});

/** The current year's last two digits */
register("CURRENT_YEAR_SHORT", async (denops) => {
  return await fn.strftime(denops, "%y");
});

/** The month as two digits (example '02') */
register("CURRENT_MONTH", async (denops) => {
  return await fn.strftime(denops, "%m");
});

/** The full name of the month (example 'July') */
register("CURRENT_MONTH_NAME", async (denops) => {
  return await fn.strftime(denops, "%B");
});

/** The short name of the month (example 'Jul') */
register("CURRENT_MONTH_NAME_SHORT", async (denops) => {
  return await fn.strftime(denops, "%b");
});

/** The day of the month as two digits (example '08') */
register("CURRENT_DATE", async (denops) => {
  return await fn.strftime(denops, "%d");
});

/** The name of day (example 'Monday') */
register("CURRENT_DAY_NAME", async (denops) => {
  return await fn.strftime(denops, "%A");
});

/** The short name of the day (example 'Mon') */
register("CURRENT_DAY_NAME_SHORT", async (denops) => {
  return await fn.strftime(denops, "%a");
});

/** The current hour in 24-hour clock format */
register("CURRENT_HOUR", async (denops) => {
  return await fn.strftime(denops, "%H");
});

/** The current minute as two digits */
register("CURRENT_MINUTE", async (denops) => {
  return await fn.strftime(denops, "%M");
});

/** The current second as two digits */
register("CURRENT_SECOND", async (denops) => {
  return await fn.strftime(denops, "%S");
});

/** The number of seconds since the Unix epoch */
register("CURRENT_SECONDS_UNIX", () => {
  return Math.trunc(new Date().getTime() / 1000).toString();
});

/** The current UTC time zone offset as +HH:MM or -HH:MM (example -07:00). */
register("CURRENT_TIMEZONE_OFFSET", () => {
  const date = new Date();
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absOffsetMinutes = Math.abs(offsetMinutes);
  const hours = Math.floor(absOffsetMinutes / 60).toString().padStart(2, "0");
  const minutes = (absOffsetMinutes % 60).toString().padStart(2, "0");
  return `${sign}${hours}:${minutes}`;
});

/** 6 random Base-10 digits */
register("RANDOM", () => {
  const min = 100_000;
  const max = 999_999;
  const random = Math.floor(Math.random() * (max - min + 1)) + min;
  return random.toString();
});

/** 6 random Base-16 digits */
register("RANDOM_HEX", () => {
  const min = 0x100_000;
  const max = 0xfff_fff;
  const random = Math.floor(Math.random() * (max - min + 1)) + min;
  return random.toString(16);
});

/** A Version 4 UUID */
register("UUID", () => crypto.randomUUID());

/** Example output: in PHP /* or in HTML <!-- */
register("BLOCK_COMMENT_START", async (denops, text) => {
  const commentstring = await op.commentstring.get(denops);
  if (!commentstring.endsWith("%s")) {
    return commentstring.split("%s")[0];
  }
  const commentStr = await op.comments.get(denops);
  const comments = commentStr.split(",");
  let blockCommentStart: string | undefined;
  comments.forEach((com) => {
    const [flags, str] = com.split(":");
    if (flags.includes("s")) {
      blockCommentStart = str;
    }
  });
  return blockCommentStart ?? text;
});

/** Example output: in PHP *\/ or in HTML --> */
register("BLOCK_COMMENT_END", async (denops, text) => {
  const commentstring = await op.commentstring.get(denops);
  if (!commentstring.endsWith("%s")) {
    return commentstring.split("%s")[1];
  }
  const commentStr = await op.comments.get(denops);
  const comments = commentStr.split(",");
  let blockCommentStart: string | undefined;
  comments.forEach((com) => {
    const [flags, str] = com.split(":");
    if (flags.includes("e")) {
      blockCommentStart = str;
    }
  });
  return blockCommentStart ?? text;
});

/** Example output: in PHP // */
register("LINE_COMMENT", async (denops, text) => {
  const commentstring = await op.commentstring.get(denops);
  if (commentstring.endsWith("%s")) {
    return commentstring.replace("%s", "");
  }
  return text;
});

import { fn, test } from "./deps/denops.ts";
import { assert, assertEquals } from "./deps/std.ts";
import * as V from "./variable.ts";

test({
  name: "variable",
  mode: "all",
  fn: async (denops, t) => {
    await denops.cmd("e foo.ts");
    await fn.setline(denops, 1, [
      "1234567890",
      "abcdefghij",
      "klmnopqrst",
    ]);

    await t.step({
      name: "TM_SELECTED_TEXT",
      fn: async () => {
        await denops.cmd(`normal! f6vjjy`);
        const actual = await V.call(denops, "TM_SELECTED_TEXT", "");
        assertEquals(actual, "67890\nabcdefghij\nklmnop");
      },
    });

    await t.step({
      name: "TM_CURRENT_LINE",
      fn: async () => {
        await fn.cursor(denops, 2, 0);
        const actual = await V.call(denops, "TM_CURRENT_LINE", "");
        assertEquals(actual, "abcdefghij");
      },
    });

    // TM_CURRENT_WORD is constant value.

    await t.step({
      name: "TM_LINE_INDEX",
      fn: async () => {
        await fn.cursor(denops, 2, 0);
        const actual = await V.call(denops, "TM_LINE_INDEX", "");
        assertEquals(actual, "1");
      },
    });

    await t.step({
      name: "TM_LINE_NUMBER",
      fn: async () => {
        await fn.cursor(denops, 2, 0);
        const actual = await V.call(denops, "TM_LINE_NUMBER", "");
        assertEquals(actual, "2");
      },
    });

    await t.step({
      name: "TM_FILENAME",
      fn: async () => {
        const actual = await V.call(denops, "TM_FILENAME", "");
        assertEquals(actual, "foo.ts");
      },
    });

    await t.step({
      name: "TM_FILENAME_BASE",
      fn: async () => {
        const actual = await V.call(denops, "TM_FILENAME_BASE", "");
        assertEquals(actual, "foo");
      },
    });

    await t.step({
      name: "TM_DIRECTORY",
      fn: async () => {
        const expect = await fn.expand(denops, "%:p:h:t");
        const actual = await V.call(denops, "TM_DIRECTORY", "");
        assertEquals(actual, expect);
      },
    });

    await t.step({
      name: "TM_FILEPATH",
      fn: async () => {
        const expect = await fn.expand(denops, "%:p");
        const actual = await V.call(denops, "TM_FILEPATH", "");
        assertEquals(actual, expect);
      },
    });

    await t.step({
      name: "CLIPBOARD",
      fn: async () => {
        await fn.setreg(denops, "", "foobar");
        const actual = await V.call(denops, "CLIPBOARD", "");
        assertEquals(actual, "foobar");
      },
    });

    // WORKSPACE_NAME
    // WORKSPACE_FOLDER
    // CURSOR_INDEX
    // CURSOR_NUMBER
    // are constant value.

    await t.step({
      name: "CURRENT_YEAR",
      fn: async () => {
        const expect = new Date().getFullYear().toString();
        const actual = await V.call(denops, "CURRENT_YEAR", "");
        assertEquals(actual, expect);
      },
    });

    await t.step({
      name: "CURRENT_YEAR_SHORT",
      fn: async () => {
        const expect = new Date().getFullYear().toString().slice(-2);
        const actual = await V.call(denops, "CURRENT_YEAR_SHORT", "");
        assertEquals(actual, expect);
      },
    });

    await t.step({
      name: "CURRENT_MONTH",
      fn: async () => {
        const expect = (new Date().getMonth() + 1).toString().padStart(2, "0");
        const actual = await V.call(denops, "CURRENT_MONTH", "");
        assertEquals(actual, expect);
      },
    });

    await t.step({
      name: "CURRENT_MONTH_NAME",
      fn: async () => {
        const expect = new Date().toLocaleString("default", { month: "long" });
        const actual = await V.call(denops, "CURRENT_MONTH_NAME", "");
        assertEquals(actual, expect);
      },
    });

    await t.step({
      name: "CURRENT_MONTH_NAME_SHORT",
      fn: async () => {
        const expect = new Date().toLocaleString("default", { month: "short" });
        const actual = await V.call(denops, "CURRENT_MONTH_NAME_SHORT", "");
        assertEquals(actual, expect);
      },
    });

    await t.step({
      name: "CURRENT_DATE",
      fn: async () => {
        const expect = new Date().getDate().toString().padStart(2, "0");
        const actual = await V.call(denops, "CURRENT_DATE", "");
        assertEquals(actual, expect);
      },
    });

    await t.step({
      name: "CURRENT_DAY_NAME",
      fn: async () => {
        const expect = new Date().toLocaleString("default", { weekday: "long" });
        const actual = await V.call(denops, "CURRENT_DAY_NAME", "");
        assertEquals(actual, expect);
      },
    });

    await t.step({
      name: "CURRENT_DAY_NAME_SHORT",
      fn: async () => {
        const expect = new Date().toLocaleString("default", { weekday: "short" });
        const actual = await V.call(denops, "CURRENT_DAY_NAME_SHORT", "");
        assertEquals(actual, expect);
      },
    });

    await t.step({
      name: "CURRENT_HOUR",
      fn: async () => {
        const expect = new Date().getHours().toString().padStart(2, "0");
        const actual = await V.call(denops, "CURRENT_HOUR", "");
        assertEquals(actual, expect);
      },
    });

    await t.step({
      name: "CURRENT_MINUTE",
      fn: async () => {
        const expect = new Date().getMinutes().toString().padStart(2, "0");
        const actual = await V.call(denops, "CURRENT_MINUTE", "");
        assertEquals(actual, expect);
      },
    });

    await t.step({
      name: "CURRENT_SECOND",
      fn: async () => {
        const expect = new Date().getSeconds().toString().padStart(2, "0");
        const actual = await V.call(denops, "CURRENT_SECOND", "");
        assertEquals(actual, expect);
      },
    });

    await t.step({
      name: "CURRENT_SECONDS_UNIX",
      fn: async () => {
        const expect = Math.floor(new Date().getTime() / 1000).toString();
        const actual = await V.call(denops, "CURRENT_SECONDS_UNIX", "");
        assertEquals(actual, expect);
      },
    });

    await t.step({
      name: "CURRENT_TIMEZONE_OFFSET",
      fn: async () => {
        const actual = await V.call(denops, "CURRENT_TIMEZONE_OFFSET", "");
        const pattern = /[+-]\d\d:\d\d/;
        assert(pattern.test(actual));
      },
    });

    await t.step({
      name: "RANDOM",
      fn: async () => {
        const actual = parseInt(await V.call(denops, "RANDOM", ""), 10);
        assert(actual >= 100_000 && actual <= 999_999, "Out of range: ${actual}");
      },
    });

    await t.step({
      name: "RANDOM_HEX",
      fn: async () => {
        const actual = parseInt(await V.call(denops, "RANDOM", ""), 16);
        assert(actual >= 0x100_000 && actual <= 0xfff_fff, `Out of range: ${actual}`);
      },
    });

    await t.step({
      name: "UUID",
      fn: async () => {
        const actual = await V.call(denops, "UUID", "");
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
        assert(uuidPattern.test(actual), `Invalid uuid: ${actual}`);
      },
    });

    await t.step({
      name: "BLOCK_COMMENT_START",
      fn: async () => {
        // TypeScript
        await denops.cmd(`set comments=sO:*\\ -,mO:*\\ \\ ,exO:*/,s1:/*,mb:*,ex:*/,://`);
        await denops.cmd(`set commentstring=//%s`);
        const actual = await V.call(denops, "BLOCK_COMMENT_START", "");
        assertEquals(actual, "/*");
      },
    });

    await t.step({
      name: "BLOCK_COMMENT_END",
      fn: async () => {
        // TypeScript
        await denops.cmd(`set comments=sO:*\\ -,mO:*\\ \\ ,exO:*/,s1:/*,mb:*,ex:*/,://`);
        await denops.cmd(`set commentstring=//%s`);
        const actual = await V.call(denops, "BLOCK_COMMENT_END", "");
        assertEquals(actual, "*/");
      },
    });

    await t.step({
      name: "LINE_COMMENT",
      fn: async () => {
        // TypeScript
        await denops.cmd(`set comments=sO:*\\ -,mO:*\\ \\ ,exO:*/,s1:/*,mb:*,ex:*/,://`);
        await denops.cmd(`set commentstring=//%s`);
        const actual = await V.call(denops, "LINE_COMMENT", "");
        assertEquals(actual, "//");
      },
    });
  },
});

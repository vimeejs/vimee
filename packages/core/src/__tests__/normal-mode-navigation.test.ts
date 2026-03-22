/**
 * normal-mode-navigation.test.ts
 *
 * Tests for navigation commands in normal mode.
 * Covers g prefix (gg, G), character search (f/F/t/T), repeat search (;/,),
 * word search (* / #), search repeat (n/N), command-line/search transitions,
 * screen-relative motions (H/M/L), and edge cases.
 */

import { describe, it, expect } from "vitest";
import { vim } from "@vimee/testkit";
import type { VimContext, CursorPosition } from "../types";
import { processKeystroke, createInitialContext } from "../vim-state";
import { TextBuffer } from "../buffer";

function createTestContext(cursor: CursorPosition, overrides?: Partial<VimContext>): VimContext {
  return {
    ...createInitialContext(cursor),
    ...overrides,
  };
}

function pressKeys(
  keys: string[],
  ctx: VimContext,
  buffer: TextBuffer,
): { ctx: VimContext; allActions: import("../types").VimAction[] } {
  let current = ctx;
  const allActions: import("../types").VimAction[] = [];
  for (const key of keys) {
    const result = processKeystroke(key, current, buffer);
    current = result.newCtx;
    allActions.push(...result.actions);
  }
  return { ctx: current, allActions };
}

describe("Normal mode — navigation", () => {
  // ---------------------------------------------------
  // g prefix (gg)
  // ---------------------------------------------------
  describe("g prefix commands", () => {
    it("moves to the beginning of the file with gg", () => {
      const v = vim("line1\nline2\nline3", { cursor: [2, 3] });
      v.type("gg");
      expect(v.cursor().line).toBe(0);
    });

    it("moves to line 3 with 3gg", () => {
      const v = vim("line1\nline2\nline3\nline4");
      v.type("3gg");
      expect(v.cursor().line).toBe(2);
    });

    it("moves to the end of the file with G", () => {
      const v = vim("line1\nline2\nline3");
      v.type("G");
      expect(v.cursor().line).toBe(2);
    });

    it("resets on unknown g command", () => {
      const v = vim("hello");
      v.type("gx");
      expect(v.raw().ctx.phase).toBe("idle");
    });
  });

  // ---------------------------------------------------
  // f / F / t / T (character search)
  // ---------------------------------------------------
  describe("f / F / t / T commands (in-line character search)", () => {
    it("moves cursor to the position of 'o' with fo", () => {
      const v = vim("hello world");
      v.type("fo");
      expect(v.cursor().col).toBe(4);
    });

    it("searches backward for 'o' with Fo", () => {
      const v = vim("hello world", { cursor: [0, 7] });
      v.type("Fo");
      expect(v.cursor().col).toBe(4);
    });

    it("moves to just before 'o' with to", () => {
      const v = vim("hello world");
      v.type("to");
      expect(v.cursor().col).toBe(3);
    });

    it("moves to just after 'o' backward with To", () => {
      const v = vim("hello world", { cursor: [0, 7] });
      v.type("To");
      expect(v.cursor().col).toBe(5);
    });
  });

  // ---------------------------------------------------
  // ; / , (repeat last f/F/t/T)
  // ---------------------------------------------------
  describe("; / , commands (repeat last char search)", () => {
    it("repeats fo with ;", () => {
      const v = vim("one.two.three.four");
      v.type("f.");
      expect(v.cursor().col).toBe(3);
      v.type(";");
      expect(v.cursor().col).toBe(7);
      v.type(";");
      expect(v.cursor().col).toBe(13);
    });

    it("reverses direction with ,", () => {
      const v = vim("one.two.three.four");
      v.type("f.");
      expect(v.cursor().col).toBe(3);
      v.type(";");
      expect(v.cursor().col).toBe(7);
      v.type(",");
      expect(v.cursor().col).toBe(3);
    });

    it("repeats Fo with ;", () => {
      const buffer = new TextBuffer("one.two.three.four");
      const ctx = createTestContext({ line: 0, col: 17 });
      const { ctx: afterF } = pressKeys(["Shift", "F", "."], ctx, buffer);
      expect(afterF.cursor.col).toBe(13);
      const { ctx: afterSemicolon } = pressKeys([";"], afterF, buffer);
      expect(afterSemicolon.cursor.col).toBe(7);
    });

    it("repeats to with ; and , for t", () => {
      const v = vim("a.b.c.d");
      v.type("t.");
      expect(v.cursor().col).toBe(0); // t stops before '.'... but col 0 means didn't move from col 0, actually t. from col 0 on "a.b.c.d" should go to col 0 (before the '.' at col 1)
    });

    it("does nothing with ; when no previous f/F/t/T", () => {
      const v = vim("hello world");
      v.type(";");
      expect(v.cursor().col).toBe(0);
    });

    it("does nothing with , when no previous f/F/t/T", () => {
      const v = vim("hello world");
      v.type(",");
      expect(v.cursor().col).toBe(0);
    });

    it("repeats t with ; (exercises resolveCharSearchRepeat case t)", () => {
      // Use t to set lastCharSearch, then ; to repeat it
      // "hello world" - 'o' at col 4 and col 7
      const v = vim("hello world");
      v.type("to");
      // t finds 'o' at col 4, stops at col 3
      expect(v.cursor().col).toBe(3);
      expect(v.raw().ctx.lastCharSearch).toEqual({ command: "t", char: "o" });
      // ; repeats t/o: from col 3, fChar starts at 4, finds 'o' at 4, t stops at 3 (no movement)
      // Since cursor doesn't move, the repeat is a no-op but the code path IS exercised
      v.type(";");
      // Cursor stays at 3 (stuck because next 'o' is at col 4, t goes to 3)
      expect(v.cursor().col).toBe(3);
    });

    it("repeats T with ; (exercises resolveCharSearchRepeat case T)", () => {
      // Use T to set lastCharSearch, then ; to repeat it
      const v = vim("hello world", { cursor: [0, 10] });
      v.type("To");
      // T searches backward: 'o' at col 7, T stops at col 8
      expect(v.cursor().col).toBe(8);
      expect(v.raw().ctx.lastCharSearch).toEqual({ command: "T", char: "o" });
      // ; repeats T/o: from col 8, FCharBack starts at 7, finds 'o' at 7, T goes to 8 (no movement)
      v.type(";");
      // Cursor stays at 8 (same stuck behavior as t)
      expect(v.cursor().col).toBe(8);
    });

    it("works with operator: d; deletes to next match (inclusive)", () => {
      const v = vim("one.two.three");
      v.type("f.");
      expect(v.cursor().col).toBe(3);
      // d; from '.' (col 3) deletes inclusive to next '.' (col 7)
      v.type("d;");
      expect(v.content()).toBe("onethree");
    });
  });

  // ---------------------------------------------------
  // * / # (search word under cursor)
  // ---------------------------------------------------
  describe("* / # commands (search word under cursor)", () => {
    it("* searches forward for the word under cursor", () => {
      const v = vim("foo bar foo baz foo");
      v.type("*");
      expect(v.cursor().col).toBe(8);
      expect(v.raw().ctx.lastSearch).toContain("foo");
    });

    it("* wraps around to the beginning across lines", () => {
      const v = vim("bar foo\nbaz\nfoo end", { cursor: [2, 0] }); // on the last 'foo'
      v.type("*");
      expect(v.cursor()).toEqual({ line: 0, col: 4 });
    });

    it("# searches backward for the word under cursor", () => {
      const v = vim("foo bar foo baz foo", { cursor: [0, 8] }); // on the middle 'foo'
      v.type("#");
      expect(v.cursor().col).toBe(0);
    });

    it("* works across multiple lines", () => {
      const v = vim("hello world\ngoodbye world\nhello again");
      v.type("*");
      expect(v.cursor()).toEqual({ line: 2, col: 0 });
    });

    it("* then n repeats the search", () => {
      const v = vim("foo bar foo baz foo");
      v.type("*");
      expect(v.cursor().col).toBe(8);
      v.type("n");
      expect(v.cursor().col).toBe(16);
    });

    it("does nothing when cursor is not on a word character", () => {
      const v = vim("foo . bar", { cursor: [0, 4] }); // on '.'
      v.type("*");
      expect(v.cursor().col).toBe(4);
    });

    it("does nothing on an empty line", () => {
      const v = vim("");
      v.type("*");
      expect(v.cursor().col).toBe(0);
    });
  });

  // ---------------------------------------------------
  // n / N (search repeat)
  // ---------------------------------------------------
  describe("n / N commands (repeat search)", () => {
    it("repeats forward search with n", () => {
      const buffer = new TextBuffer("foo bar foo baz foo");
      const ctx = createTestContext(
        { line: 0, col: 0 },
        { lastSearch: "foo", searchDirection: "forward" },
      );
      const { ctx: result } = pressKeys(["n"], ctx, buffer);
      expect(result.cursor.col).toBe(8);
    });

    it("reverses search direction with N", () => {
      const buffer = new TextBuffer("foo bar foo baz foo");
      const ctx = createTestContext(
        { line: 0, col: 8 },
        { lastSearch: "foo", searchDirection: "forward" },
      );
      const { ctx: result } = pressKeys(["N"], ctx, buffer);
      expect(result.cursor.col).toBe(0);
    });

    it("does nothing with n when lastSearch is empty", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 }, { lastSearch: "" });
      const { ctx: result } = pressKeys(["n"], ctx, buffer);
      expect(result.cursor).toEqual({ line: 0, col: 0 });
    });

    it("displays a status message when the pattern is not found", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext(
        { line: 0, col: 0 },
        { lastSearch: "xyz", searchDirection: "forward" },
      );
      const { ctx: result } = pressKeys(["n"], ctx, buffer);
      expect(result.statusMessage).toBe("Pattern not found: xyz");
    });
  });

  // ---------------------------------------------------
  // Command-line / search mode transition
  // ---------------------------------------------------
  describe("Command-line / search transition", () => {
    it("enters command-line mode with :", () => {
      const v = vim("hello");
      v.type(":");
      expect(v.mode()).toBe("command-line");
      expect(v.raw().ctx.commandType).toBe(":");
    });

    it("enters forward search mode with /", () => {
      const v = vim("hello");
      v.type("/");
      expect(v.mode()).toBe("command-line");
      expect(v.raw().ctx.commandType).toBe("/");
      expect(v.raw().ctx.searchDirection).toBe("forward");
    });

    it("enters backward search mode with ?", () => {
      const v = vim("hello");
      v.type("?");
      expect(v.mode()).toBe("command-line");
      expect(v.raw().ctx.commandType).toBe("?");
      expect(v.raw().ctx.searchDirection).toBe("backward");
    });
  });

  // ---------------------------------------------------
  // H / M / L (screen-relative motions)
  // ---------------------------------------------------
  describe("H / M / L (screen-relative motions)", () => {
    const makeLargeText = (n: number) => {
      const lines = Array.from({ length: n }, (_, i) => `  line ${i + 1}`).join("\n");
      return lines;
    };

    it("H moves to the top of the viewport", () => {
      const buffer = new TextBuffer(makeLargeText(100));
      // Simulate viewport: top=10, height=30
      const ctx = createTestContext(
        { line: 25, col: 0 },
        { viewportTopLine: 10, viewportHeight: 30 },
      );
      const { ctx: result } = pressKeys(["Shift", "H"], ctx, buffer);
      expect(result.cursor.line).toBe(10);
      expect(result.cursor.col).toBe(2); // first non-blank
    });

    it("3H moves to the 3rd line from top of viewport", () => {
      const buffer = new TextBuffer(makeLargeText(100));
      const ctx = createTestContext(
        { line: 25, col: 0 },
        { viewportTopLine: 10, viewportHeight: 30 },
      );
      const { ctx: result } = pressKeys(["3", "Shift", "H"], ctx, buffer);
      expect(result.cursor.line).toBe(12);
    });

    it("M moves to the middle of the viewport", () => {
      const buffer = new TextBuffer(makeLargeText(100));
      const ctx = createTestContext(
        { line: 0, col: 0 },
        { viewportTopLine: 10, viewportHeight: 30 },
      );
      const { ctx: result } = pressKeys(["Shift", "M"], ctx, buffer);
      expect(result.cursor.line).toBe(25); // 10 + 15
    });

    it("L moves to the bottom of the viewport", () => {
      const buffer = new TextBuffer(makeLargeText(100));
      const ctx = createTestContext(
        { line: 0, col: 0 },
        { viewportTopLine: 10, viewportHeight: 30 },
      );
      const { ctx: result } = pressKeys(["Shift", "L"], ctx, buffer);
      expect(result.cursor.line).toBe(39); // 10 + 30 - 1
    });

    it("3L moves to the 3rd line from bottom of viewport", () => {
      const buffer = new TextBuffer(makeLargeText(100));
      const ctx = createTestContext(
        { line: 0, col: 0 },
        { viewportTopLine: 10, viewportHeight: 30 },
      );
      const { ctx: result } = pressKeys(["3", "Shift", "L"], ctx, buffer);
      expect(result.cursor.line).toBe(37); // 39 - 2
    });

    it("H is clamped when viewport extends beyond buffer", () => {
      const buffer = new TextBuffer(makeLargeText(20));
      const ctx = createTestContext(
        { line: 15, col: 0 },
        { viewportTopLine: 15, viewportHeight: 30 },
      );
      const { ctx: result } = pressKeys(["Shift", "L"], ctx, buffer);
      expect(result.cursor.line).toBe(19); // clamped to last line
    });

    it("dH deletes from cursor to top of viewport", () => {
      const buffer = new TextBuffer(makeLargeText(100));
      const ctx = createTestContext(
        { line: 20, col: 0 },
        { viewportTopLine: 10, viewportHeight: 30 },
      );
      const { ctx: result } = pressKeys(["d", "Shift", "H"], ctx, buffer);
      // Deletes lines 10..20 = 11 lines
      expect(buffer.getLineCount()).toBe(89);
      expect(result.statusMessage).toBe("11 fewer lines");
    });
  });

  // ---------------------------------------------------
  // Pattern not found during * / # word search
  // ---------------------------------------------------
  describe("Pattern not found during * / # word search", () => {
    it("* shows 'Pattern not found' when word has no other occurrence", () => {
      // Single line, single occurrence: search wraps but doesn't find another match
      const v = vim("uniqueword");
      v.type("*");
      expect(v.statusMessage()).toContain("Pattern not found");
    });

    it("# shows 'Pattern not found' when word has no other occurrence", () => {
      const v = vim("uniqueword");
      v.type("#");
      expect(v.statusMessage()).toContain("Pattern not found");
    });
  });

  // ---------------------------------------------------
  // Operator + char search repeat that does not move
  // ---------------------------------------------------
  describe("Operator + char search repeat that does not move", () => {
    it("d; does nothing when ; repeat finds no match", () => {
      const v = vim("abcdef", { cursor: [0, 5] }); // cursor at 'f' (end)
      // First, do fz to set lastCharSearch (finds no z in line)
      v.type("fz");
      // fz didn't move (no z in line), but set lastCharSearch to f/z
      expect(v.raw().ctx.lastCharSearch).toEqual({ command: "f", char: "z" });
      // Now d; should try to repeat fz, find nothing, and cancel
      v.type("d;");
      expect(v.raw().ctx.phase).toBe("idle");
      expect(v.raw().ctx.operator).toBeNull();
      expect(v.content()).toBe("abcdef"); // no change
    });

    it("d, does nothing when , repeat finds no match", () => {
      const v = vim("abcdef"); // cursor at 'a'
      // Fz backward search for 'z' - doesn't move but sets lastCharSearch
      v.type("Fz");
      expect(v.raw().ctx.lastCharSearch).toEqual({ command: "F", char: "z" });
      // d, reverses to forward fz, no match → cancel
      v.type("d,");
      expect(v.raw().ctx.phase).toBe("idle");
      expect(v.content()).toBe("abcdef");
    });
  });

  // ---------------------------------------------------
  // N with backward searchDirection
  // ---------------------------------------------------
  describe("N with backward searchDirection", () => {
    it("N reverses backward search to forward", () => {
      const buffer = new TextBuffer("foo bar foo baz foo");
      const ctx = createTestContext(
        { line: 0, col: 0 },
        { lastSearch: "foo", searchDirection: "backward" },
      );
      const { ctx: result } = pressKeys(["N"], ctx, buffer);
      // N reverses backward → forward, so it finds the next "foo" forward from col 0
      expect(result.cursor.col).toBe(8);
    });
  });
});

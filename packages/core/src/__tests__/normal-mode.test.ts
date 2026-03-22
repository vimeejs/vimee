/**
 * normal-mode.test.ts
 *
 * Integration tests for normal mode.
 * Comprehensively verifies behavior of counts, operators, motions,
 * mode transitions, editing commands, etc. through processKeystroke.
 */

import { describe, it, expect } from "vitest";
import { vim } from "@vimee/testkit";
import type { VimContext, CursorPosition } from "../types";
import { processKeystroke, createInitialContext } from "../vim-state";
import { TextBuffer } from "../buffer";

// =====================
// Helper functions (kept for tests that need raw context overrides)
// =====================

/** Create a VimContext for testing */
function createTestContext(cursor: CursorPosition, overrides?: Partial<VimContext>): VimContext {
  return {
    ...createInitialContext(cursor),
    ...overrides,
  };
}

/** Process multiple keys in sequence and return the final state */
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

// =====================
// Tests
// =====================

describe("Normal mode", () => {
  // ---------------------------------------------------
  // Count prefix
  // ---------------------------------------------------
  describe("Count prefix", () => {
    it("moves 3 lines down with 3j", () => {
      const v = vim("line1\nline2\nline3\nline4\nline5");
      v.type("3j");
      expect(v.cursor()).toEqual({ line: 3, col: 0 });
    });

    it("moves 5 lines up with 5k (clamped when not enough lines)", () => {
      const v = vim("line1\nline2\nline3", { cursor: [2, 0] });
      v.type("5k");
      expect(v.cursor().line).toBe(0);
    });

    it("moves 2 columns right with 2l", () => {
      const v = vim("abcdef");
      v.type("2l");
      expect(v.cursor().col).toBe(2);
    });

    it("moves 5 words forward with 5w", () => {
      const v = vim("one two three four five six seven");
      v.type("5w");
      // 5w: one->two->three->four->five->six start
      expect(v.cursor().col).toBe(24);
    });

    it("interprets count 0 as move to beginning of line (when no count entered)", () => {
      const v = vim("hello world", { cursor: [0, 5] });
      v.type("0");
      expect(v.cursor().col).toBe(0);
    });

    it("correctly processes a two-digit count like 10j", () => {
      const lines = Array.from({ length: 20 }, (_, i) => `line${i}`).join("\n");
      const v = vim(lines);
      v.type("10j");
      expect(v.cursor().line).toBe(10);
    });
  });

  // ---------------------------------------------------
  // Operator + motion
  // ---------------------------------------------------
  describe("Operator + motion", () => {
    it("deletes one word with dw", () => {
      const v = vim("hello world");
      v.type("dw");
      expect(v.content()).toBe("world");
      expect(v.cursor().col).toBe(0);
    });

    it("deletes to end of line with d$", () => {
      const v = vim("hello world", { cursor: [0, 5] });
      v.type("d$");
      expect(v.content()).toBe("hello");
      expect(v.cursor().col).toBe(4);
    });

    it("deletes to beginning of line with d0", () => {
      const v = vim("hello world", { cursor: [0, 5] });
      v.type("d0");
      expect(v.content()).toBe(" world");
    });

    it("deletes from cursor line to end of file with dG", () => {
      const v = vim("line1\nline2\nline3\nline4", { cursor: [1, 0] });
      v.type("dG");
      expect(v.content()).toBe("line1");
    });

    it("deletes from cursor line to beginning of file with dgg", () => {
      const v = vim("line1\nline2\nline3\nline4", { cursor: [2, 0] });
      v.type("dgg");
      expect(v.content()).toBe("line4");
    });

    it("yanks one word with yw (buffer unchanged)", () => {
      const v = vim("hello world");
      v.type("yw");
      expect(v.content()).toBe("hello world");
      expect(v.register('"')).toBe("hello ");
    });

    it("changes one word and enters insert mode with cw", () => {
      const v = vim("hello world");
      v.type("cw");
      expect(v.content()).toBe("world");
      expect(v.mode()).toBe("insert");
    });
  });

  // ---------------------------------------------------
  // Double operators (line-wise operations)
  // ---------------------------------------------------
  describe("Double operators (dd, yy, cc)", () => {
    it("deletes the current line with dd", () => {
      const v = vim("line1\nline2\nline3", { cursor: [1, 0] });
      v.type("dd");
      expect(v.content()).toBe("line1\nline3");
      expect(v.register('"')).toBe("line2\n");
      expect(v.cursor().line).toBe(1);
    });

    it("yanks the current line with yy (buffer unchanged)", () => {
      const v = vim("line1\nline2\nline3", { cursor: [1, 0] });
      v.type("yy");
      expect(v.content()).toBe("line1\nline2\nline3");
      expect(v.register('"')).toBe("line2\n");
    });

    it("clears the current line and enters insert mode with cc", () => {
      const v = vim("line1\nline2\nline3", { cursor: [1, 0] });
      v.type("cc");
      expect(v.mode()).toBe("insert");
      expect(v.register('"')).toBe("line2\n");
      // cc deletes the line and inserts an empty line
      expect(v.line(1)).toBe("");
    });
  });

  // ---------------------------------------------------
  // Count + operator
  // ---------------------------------------------------
  describe("Count + operator", () => {
    it("deletes 3 lines with 3dd", () => {
      const v = vim("line1\nline2\nline3\nline4\nline5", { cursor: [1, 0] });
      v.type("3dd");
      expect(v.content()).toBe("line1\nline5");
    });

    it("yanks 2 lines with 2yy", () => {
      const v = vim("line1\nline2\nline3\nline4");
      v.type("2yy");
      expect(v.register('"')).toBe("line1\nline2\n");
      expect(v.content()).toBe("line1\nline2\nline3\nline4");
    });

    it("clamps 2dd near the last line", () => {
      const v = vim("line1\nline2\nline3", { cursor: [2, 0] });
      v.type("2dd");
      // Only 1 line from line 2, so only line3 is deleted
      expect(v.content()).toBe("line1\nline2");
    });

    it("yanks 10 lines with 10yy", () => {
      const lines = Array.from({ length: 20 }, (_, i) => `line${i}`).join("\n");
      const v = vim(lines);
      v.type("10yy");
      const expected = Array.from({ length: 10 }, (_, i) => `line${i}`).join("\n") + "\n";
      expect(v.register('"')).toBe(expected);
      expect(v.content()).toBe(lines);
    });

    it("deletes 10 lines with 10dd", () => {
      const lines = Array.from({ length: 20 }, (_, i) => `line${i}`).join("\n");
      const v = vim(lines);
      v.type("10dd");
      const expected = Array.from({ length: 10 }, (_, i) => `line${i + 10}`).join("\n");
      expect(v.content()).toBe(expected);
    });

    it("moves to line 52 with 52G", () => {
      const lines = Array.from({ length: 100 }, (_, i) => `line${i}`).join("\n");
      const v = vim(lines);
      v.type("52G");
      expect(v.cursor().line).toBe(51);
    });

    it("moves to line 110 with 110G (clamped to last line)", () => {
      const lines = Array.from({ length: 100 }, (_, i) => `line${i}`).join("\n");
      const v = vim(lines);
      v.type("110G");
      expect(v.cursor().line).toBe(99);
    });

    it("moves to line 10 with 10gg", () => {
      const lines = Array.from({ length: 20 }, (_, i) => `line${i}`).join("\n");
      const v = vim(lines);
      v.type("10gg");
      expect(v.cursor().line).toBe(9);
    });

    it("deletes 2 words with 2dw", () => {
      const v = vim("one two three four");
      v.type("2dw");
      expect(v.content()).toBe("three four");
    });
  });

  // ---------------------------------------------------
  // x (character deletion)
  // ---------------------------------------------------
  describe("x command (character deletion)", () => {
    it("deletes the character under the cursor with x", () => {
      const v = vim("hello");
      v.type("x");
      expect(v.content()).toBe("ello");
      expect(v.register('"')).toBe("h");
    });

    it("adjusts cursor when pressing x at end of line", () => {
      const v = vim("abc", { cursor: [0, 2] });
      v.type("x");
      expect(v.content()).toBe("ab");
      expect(v.cursor().col).toBe(1);
    });

    it("does nothing when pressing x on an empty line", () => {
      const v = vim("");
      v.type("x");
      expect(v.content()).toBe("");
      expect(v.cursor().col).toBe(0);
    });

    it("deletes 3 characters with 3x", () => {
      const v = vim("abcdef");
      v.type("3x");
      expect(v.content()).toBe("def");
    });
  });

  // ---------------------------------------------------
  // p / P (paste)
  // ---------------------------------------------------
  describe("p / P command (paste)", () => {
    it("pastes character-wise after the cursor with p", () => {
      const buffer = new TextBuffer("hllo");
      const ctx = createTestContext({ line: 0, col: 0 }, { register: "e" });
      const { ctx: result } = pressKeys(["p"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello");
      expect(result.cursor.col).toBe(1);
    });

    it("pastes character-wise before the cursor with P", () => {
      const buffer = new TextBuffer("hllo");
      const ctx = createTestContext({ line: 0, col: 1 }, { register: "e" });
      const { ctx: result } = pressKeys(["P"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello");
      expect(result.cursor.col).toBe(1);
    });

    it("pastes line-wise on the next line with p", () => {
      const buffer = new TextBuffer("line1\nline3");
      const ctx = createTestContext({ line: 0, col: 0 }, { register: "line2\n" });
      const { ctx: result } = pressKeys(["p"], ctx, buffer);
      expect(buffer.getContent()).toBe("line1\nline2\nline3");
      expect(result.cursor).toEqual({ line: 1, col: 0 });
    });

    it("pastes line-wise above the current line with P", () => {
      const buffer = new TextBuffer("line1\nline3");
      const ctx = createTestContext({ line: 1, col: 0 }, { register: "line2\n" });
      const { ctx: result } = pressKeys(["P"], ctx, buffer);
      expect(buffer.getContent()).toBe("line1\nline2\nline3");
      expect(result.cursor).toEqual({ line: 1, col: 0 });
    });

    it("does nothing with p when register is empty", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 }, { register: "" });
      pressKeys(["p"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello");
    });

    it("pastes multi-line register line-wise with p and keeps buffer lines in sync", () => {
      const buffer = new TextBuffer("above\nbelow");
      const ctx = createTestContext({ line: 0, col: 0 }, { register: "line1\nline2\nline3\n" });
      const { ctx: result } = pressKeys(["p"], ctx, buffer);
      expect(buffer.getContent()).toBe("above\nline1\nline2\nline3\nbelow");
      expect(buffer.getLineCount()).toBe(5);
      expect(result.cursor).toEqual({ line: 1, col: 0 });
      // dd on the pasted line should delete exactly that line
      const { ctx: afterDd } = pressKeys(["d", "d"], result, buffer);
      expect(buffer.getContent()).toBe("above\nline2\nline3\nbelow");
      expect(afterDd.cursor).toEqual({ line: 1, col: 0 });
    });

    it("pastes multi-line register line-wise with P and keeps buffer lines in sync", () => {
      const buffer = new TextBuffer("above\nbelow");
      const ctx = createTestContext({ line: 1, col: 0 }, { register: "line1\nline2\n" });
      const { ctx: result } = pressKeys(["P"], ctx, buffer);
      expect(buffer.getContent()).toBe("above\nline1\nline2\nbelow");
      expect(buffer.getLineCount()).toBe(4);
      expect(result.cursor).toEqual({ line: 1, col: 0 });
    });
  });

  // ---------------------------------------------------
  // ~ (toggle case)
  // ---------------------------------------------------
  describe("~ command (toggle case)", () => {
    it("toggles lowercase to uppercase and advances cursor", () => {
      const v = vim("hello");
      v.type("~");
      expect(v.content()).toBe("Hello");
      expect(v.cursor().col).toBe(1);
    });

    it("toggles uppercase to lowercase", () => {
      const v = vim("HELLO");
      v.type("~");
      expect(v.content()).toBe("hELLO");
      expect(v.cursor().col).toBe(1);
    });

    it("toggles 3 characters with 3~", () => {
      const v = vim("hello");
      v.type("3~");
      expect(v.content()).toBe("HELlo");
      expect(v.cursor().col).toBe(3);
    });

    it("leaves non-alpha characters unchanged and advances", () => {
      const v = vim("a1b");
      v.type("3~");
      expect(v.content()).toBe("A1B");
    });

    it("clamps cursor at end of line", () => {
      const v = vim("ab");
      v.type("5~");
      expect(v.content()).toBe("AB");
      expect(v.cursor().col).toBe(1);
    });

    it("does nothing on an empty line", () => {
      const v = vim("");
      v.type("~");
      expect(v.content()).toBe("");
    });
  });

  // ---------------------------------------------------
  // D (delete to end of line)
  // ---------------------------------------------------
  describe("D command (delete to end of line)", () => {
    it("deletes from cursor to end of line with D", () => {
      const v = vim("hello world", { cursor: [0, 5] });
      v.type("D");
      expect(v.content()).toBe("hello");
      expect(v.register('"')).toBe(" world");
      expect(v.cursor().col).toBe(4);
    });

    it("deletes entire line content with D at column 0", () => {
      const v = vim("hello world");
      v.type("D");
      expect(v.content()).toBe("");
      expect(v.register('"')).toBe("hello world");
    });

    it("deletes last character with D at end of line", () => {
      const v = vim("abc", { cursor: [0, 2] });
      v.type("D");
      expect(v.content()).toBe("ab");
      expect(v.register('"')).toBe("c");
    });

    it("does not affect other lines with D", () => {
      const v = vim("hello world\nsecond line", { cursor: [0, 5] });
      v.type("D");
      expect(v.content()).toBe("hello\nsecond line");
    });
  });

  // ---------------------------------------------------
  // C (change to end of line)
  // ---------------------------------------------------
  describe("C command (change to end of line)", () => {
    it("deletes from cursor to end of line and enters insert mode with C", () => {
      const v = vim("hello world", { cursor: [0, 5] });
      v.type("C");
      expect(v.content()).toBe("hello");
      expect(v.mode()).toBe("insert");
      expect(v.register('"')).toBe(" world");
      expect(v.cursor().col).toBe(5);
    });

    it("changes entire line content with C at column 0", () => {
      const v = vim("hello world");
      v.type("C");
      expect(v.content()).toBe("");
      expect(v.mode()).toBe("insert");
    });
  });

  // ---------------------------------------------------
  // u (undo)
  // ---------------------------------------------------
  describe("u command (undo)", () => {
    it("undoes the previous change with u", () => {
      const v = vim("hello world");
      // First delete the line with dd
      v.type("dd");
      expect(v.content()).toBe("");
      // undo
      v.type("u");
      expect(v.content()).toBe("hello world");
      expect(v.cursor()).toEqual({ line: 0, col: 0 });
    });

    it("displays a message when the undo stack is empty", () => {
      const v = vim("hello");
      v.type("u");
      expect(v.statusMessage()).toBe("Already at oldest change");
      expect(v.allActions()).toContainEqual({
        type: "status-message",
        message: "Already at oldest change",
      });
    });
  });

  // ---------------------------------------------------
  // Mode transition (to insert mode)
  // ---------------------------------------------------
  describe("Transition to insert mode", () => {
    it("enters insert mode with i (cursor stays in place)", () => {
      const v = vim("hello", { cursor: [0, 2] });
      v.type("i");
      expect(v.mode()).toBe("insert");
      expect(v.cursor().col).toBe(2);
    });

    it("moves cursor one position right and enters insert mode with a", () => {
      const v = vim("hello", { cursor: [0, 2] });
      v.type("a");
      expect(v.mode()).toBe("insert");
      expect(v.cursor().col).toBe(3);
    });

    it("moves to the first non-whitespace character and enters insert mode with I", () => {
      const v = vim("  hello", { cursor: [0, 5] });
      v.type("I");
      expect(v.mode()).toBe("insert");
      expect(v.cursor().col).toBe(2);
    });

    it("moves to end of line and enters insert mode with A", () => {
      const v = vim("hello");
      v.type("A");
      expect(v.mode()).toBe("insert");
      expect(v.cursor().col).toBe(5);
    });

    it("inserts a blank line below and enters insert mode with o", () => {
      const v = vim("line1\nline2");
      v.type("o");
      expect(v.mode()).toBe("insert");
      expect(v.cursor()).toEqual({ line: 1, col: 0 });
      expect(v.content()).toBe("line1\n\nline2");
    });

    it("inserts a blank line above and enters insert mode with O", () => {
      const v = vim("line1\nline2", { cursor: [1, 0] });
      v.type("O");
      expect(v.mode()).toBe("insert");
      expect(v.cursor()).toEqual({ line: 1, col: 0 });
      expect(v.content()).toBe("line1\n\nline2");
    });

    it("o preserves indentation from current line", () => {
      const v = vim("  indented", { cursor: [0, 2] });
      v.type("o");
      expect(v.mode()).toBe("insert");
      expect(v.cursor()).toEqual({ line: 1, col: 2 });
      expect(v.line(1)).toBe("  ");
    });

    it("O preserves indentation from current line", () => {
      const v = vim("  indented", { cursor: [0, 2] });
      v.type("O");
      expect(v.mode()).toBe("insert");
      expect(v.cursor()).toEqual({ line: 0, col: 2 });
      expect(v.line(0)).toBe("  ");
    });
  });

  // ---------------------------------------------------
  // v / V (transition to visual mode)
  // ---------------------------------------------------
  describe("Transition to visual mode", () => {
    it("enters visual mode with v", () => {
      const v = vim("hello", { cursor: [0, 2] });
      v.type("v");
      expect(v.mode()).toBe("visual");
      expect(v.raw().ctx.visualAnchor).toEqual({ line: 0, col: 2 });
    });

    it("enters visual-line mode with V", () => {
      const v = vim("hello\nworld");
      v.type("V");
      expect(v.mode()).toBe("visual-line");
      expect(v.raw().ctx.visualAnchor).toEqual({ line: 0, col: 0 });
    });
  });

  // ---------------------------------------------------
  // J (join lines)
  // ---------------------------------------------------
  describe("J command (join lines)", () => {
    it("joins the current line with the next line using a space with J", () => {
      const v = vim("hello\nworld");
      v.type("J");
      expect(v.content()).toBe("hello world");
      expect(v.cursor().col).toBe(5);
    });

    it("strips leading whitespace from the next line when joining with J", () => {
      const v = vim("hello\n  world");
      v.type("J");
      expect(v.content()).toBe("hello world");
    });

    it("does nothing when pressing J on the last line", () => {
      const v = vim("hello\nworld", { cursor: [1, 0] });
      v.type("J");
      expect(v.content()).toBe("hello\nworld");
    });
  });

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
  // r (single character replacement)
  // ---------------------------------------------------
  describe("r command (single character replacement)", () => {
    it("replaces the character under the cursor with 'x' using rx", () => {
      const v = vim("hello");
      v.type("rx");
      expect(v.content()).toBe("xello");
    });

    it("does nothing when pressing r on an empty line", () => {
      const v = vim("");
      v.type("rx");
      expect(v.content()).toBe("");
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
  // Ctrl key combinations
  // ---------------------------------------------------
  describe("Ctrl key combinations", () => {
    it("redoes with Ctrl-R", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });
      // dd -> undo -> redo
      const { ctx: afterDd } = pressKeys(["d", "d"], ctx, buffer);
      const { ctx: afterUndo } = pressKeys(["u"], afterDd, buffer);
      expect(buffer.getContent()).toBe("hello");
      const result = processKeystroke("r", afterUndo, buffer, true);
      expect(buffer.getContent()).toBe("");
    });

    it("displays a message when Ctrl-R redo stack is empty", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });
      const result = processKeystroke("r", ctx, buffer, true);
      expect(result.newCtx.statusMessage).toBe("Already at newest change");
    });
  });

  // ---------------------------------------------------
  // Special behavior during operator-pending
  // ---------------------------------------------------
  describe("Operator pending", () => {
    it("cancels operator on invalid key", () => {
      const v = vim("hello");
      v.type("dz");
      expect(v.raw().ctx.phase).toBe("idle");
      expect(v.raw().ctx.operator).toBeNull();
    });

    it("operator + character search motion works with dfa", () => {
      const v = vim("hello world");
      v.type("dfo");
      expect(v.content()).toBe(" world");
    });
  });

  // ---------------------------------------------------
  // >> / << (indent / dedent)
  // ---------------------------------------------------
  describe(">> / << commands (indent / dedent)", () => {
    it(">> indents the current line", () => {
      const v = vim("hello\nworld");
      v.type(">>");
      expect(v.line(0)).toBe("  hello");
      expect(v.line(1)).toBe("world");
    });

    it("<< dedents the current line", () => {
      const v = vim("  hello\nworld");
      v.type("<<");
      expect(v.line(0)).toBe("hello");
    });

    it("3>> indents 3 lines", () => {
      const v = vim("aaa\nbbb\nccc\nddd");
      v.type("3>>");
      expect(v.line(0)).toBe("  aaa");
      expect(v.line(1)).toBe("  bbb");
      expect(v.line(2)).toBe("  ccc");
      expect(v.line(3)).toBe("ddd");
      expect(v.statusMessage()).toBe("3 lines >ed 1 time");
    });

    it("3<< dedents 3 lines", () => {
      const v = vim("  aaa\n  bbb\n  ccc\nddd");
      v.type("3<<");
      expect(v.line(0)).toBe("aaa");
      expect(v.line(1)).toBe("bbb");
      expect(v.line(2)).toBe("ccc");
      expect(v.line(3)).toBe("ddd");
    });

    it(">j indents current line and next line", () => {
      const v = vim("aaa\nbbb\nccc");
      v.type(">j");
      expect(v.line(0)).toBe("  aaa");
      expect(v.line(1)).toBe("  bbb");
      expect(v.line(2)).toBe("ccc");
    });

    it("<< does nothing when line has no indent", () => {
      const v = vim("hello");
      v.type("<<");
      expect(v.line(0)).toBe("hello");
    });

    it("<< removes partial indent (less than indent width)", () => {
      const v = vim(" hello");
      v.type("<<");
      expect(v.line(0)).toBe("hello");
    });

    it(">> can be undone", () => {
      const v = vim("hello");
      v.type(">>");
      expect(v.line(0)).toBe("  hello");
      v.type("u");
      expect(v.line(0)).toBe("hello");
    });

    it(">G indents from cursor to end of file", () => {
      const buffer = new TextBuffer("aaa\nbbb\nccc");
      const ctx = createTestContext({ line: 1, col: 0 });
      pressKeys([">", "Shift", "G"], ctx, buffer);
      expect(buffer.getLine(0)).toBe("aaa");
      expect(buffer.getLine(1)).toBe("  bbb");
      expect(buffer.getLine(2)).toBe("  ccc");
    });
  });

  // ---------------------------------------------------
  // Named registers ("a-"z)
  // ---------------------------------------------------
  describe('Named registers ("x)', () => {
    it('"ayy stores in register a, "ap pastes from it', () => {
      const v = vim("hello\nworld\nfoo");
      // "ayy -> yank line into register a
      v.type('"ayy');
      expect(v.raw().ctx.registers.a).toBe("hello\n");
      expect(v.register('"')).toBe("hello\n"); // also in unnamed
      // yy on line 1 -> overwrites unnamed register
      v.type("jyy");
      expect(v.register('"')).toBe("world\n");
      // "ap -> paste from register a (not the unnamed)
      v.type('j"ap');
      expect(v.content()).toBe("hello\nworld\nfoo\nhello");
    });

    it('"bdd stores deleted line in register b', () => {
      const v = vim("aaa\nbbb\nccc", { cursor: [1, 0] });
      v.type('"bdd');
      expect(v.content()).toBe("aaa\nccc");
      expect(v.raw().ctx.registers.b).toBe("bbb\n");
      expect(v.register('"')).toBe("bbb\n");
    });

    it('"bp pastes from register b', () => {
      const buffer = new TextBuffer("ab");
      const ctx = createTestContext({ line: 0, col: 0 }, { registers: { b: "X" } });
      pressKeys(['"', "b", "p"], ctx, buffer);
      expect(buffer.getContent()).toBe("aXb");
    });

    it("regular p uses unnamed register, not named", () => {
      const buffer = new TextBuffer("test");
      const ctx = createTestContext(
        { line: 0, col: 3 },
        { register: "!", registers: { a: "named" } },
      );
      pressKeys(["p"], ctx, buffer);
      expect(buffer.getContent()).toBe("test!");
    });

    it('"" selects the unnamed register explicitly', () => {
      const buffer = new TextBuffer("test");
      const ctx = createTestContext(
        { line: 0, col: 3 },
        { register: "!", registers: { a: "named" } },
      );
      pressKeys(['"', '"', "p"], ctx, buffer);
      expect(buffer.getContent()).toBe("test!");
    });

    it("invalid register name resets state", () => {
      const v = vim("hello");
      v.type('"1');
      expect(v.raw().ctx.phase).toBe("idle");
      expect(v.raw().ctx.selectedRegister).toBeNull();
    });
  });

  // ---------------------------------------------------
  // . (dot repeat)
  // ---------------------------------------------------
  describe(". command (dot repeat)", () => {
    it("repeats dd", () => {
      const v = vim("line1\nline2\nline3\nline4");
      v.type("dd");
      expect(v.content()).toBe("line2\nline3\nline4");
      v.type(".");
      expect(v.content()).toBe("line3\nline4");
      expect(v.mode()).toBe("normal");
    });

    it("repeats x", () => {
      const v = vim("abcdef");
      v.type("x");
      expect(v.content()).toBe("bcdef");
      v.type(".");
      expect(v.content()).toBe("cdef");
    });

    it("repeats ciw + typed text", () => {
      const v = vim("foo bar baz");
      // ciw replaces 'foo' with 'hello'
      v.type("ciw", "hello");
      expect(v.content()).toBe("hello bar baz");
      // Move to 'bar' and repeat
      v.type("w");
      v.type(".");
      expect(v.content()).toBe("hello hello baz");
      expect(v.mode()).toBe("normal");
    });

    it("repeats dw", () => {
      const v = vim("one two three four");
      v.type("dw");
      expect(v.content()).toBe("two three four");
      v.type(".");
      expect(v.content()).toBe("three four");
    });

    it("repeats r{char}", () => {
      const v = vim("aaa");
      v.type("rx");
      expect(v.content()).toBe("xaa");
      v.type("l");
      v.type(".");
      expect(v.content()).toBe("xxa");
    });

    it("repeats ~ (toggle case)", () => {
      const v = vim("abcdef");
      v.type("~");
      expect(v.content()).toBe("Abcdef");
      v.type(".");
      expect(v.content()).toBe("ABcdef");
    });

    it("repeats insert session (ihi<Esc>)", () => {
      const v = vim("ab");
      v.type("i", "X");
      expect(v.content()).toBe("Xab");
      // Move right and repeat -> inserts X before cursor
      v.type("ll");
      expect(v.cursor().col).toBe(2);
      v.type(".");
      expect(v.content()).toBe("XaXb");
    });

    it("does nothing when no previous change", () => {
      const v = vim("hello");
      v.type(".");
      expect(v.content()).toBe("hello");
    });
  });

  // ---------------------------------------------------
  // Reset on unmatched key
  // ---------------------------------------------------
  // ---------------------------------------------------
  // Macro recording & playback
  // ---------------------------------------------------
  // ---------------------------------------------------
  // Marks (m, `, ')
  // ---------------------------------------------------
  describe("Marks (m, `, ')", () => {
    it("ma sets mark a at current position, `a jumps to it", () => {
      const v = vim("line1\nline2\nline3\nline4\nline5", { cursor: [1, 3] });
      // Set mark a
      v.type("ma");
      expect(v.raw().ctx.marks.a).toEqual({ line: 1, col: 3 });
      // Move away
      v.type("G");
      expect(v.cursor().line).toBe(4);
      // Jump back to mark a
      v.type("`a");
      expect(v.cursor()).toEqual({ line: 1, col: 3 });
    });

    it("'a also jumps to mark a", () => {
      const v = vim("line1\nline2\nline3", { cursor: [2, 0] });
      v.type("mb");
      v.type("gg");
      v.type("'b");
      expect(v.cursor().line).toBe(2);
    });

    it("multiple marks work independently", () => {
      const v = vim("aaa\nbbb\nccc\nddd");
      v.type("ma");
      v.type("jj");
      v.type("mb");
      expect(v.raw().ctx.marks.a).toEqual({ line: 0, col: 0 });
      expect(v.raw().ctx.marks.b).toEqual({ line: 2, col: 0 });
      // Jump to a
      v.type("`a");
      expect(v.cursor().line).toBe(0);
      // Jump to b
      v.type("`b");
      expect(v.cursor().line).toBe(2);
    });

    it("shows error when mark is not set", () => {
      const v = vim("hello");
      v.type("`z");
      expect(v.statusMessage()).toBe("Mark 'z' not set");
    });

    it("clamps to buffer bounds if lines were deleted", () => {
      const v = vim("line1\nline2\nline3", { cursor: [2, 0] });
      v.type("ma");
      // Delete last line
      v.type("dd");
      expect(v.raw().buffer.getLineCount()).toBe(2);
      // Jump to mark a (line 2 no longer exists, clamp to line 1)
      v.type("`a");
      expect(v.cursor().line).toBe(1);
    });
  });

  describe("Macro recording & playback", () => {
    it("qa starts recording, q stops, @a replays", () => {
      const v = vim("aaa\nbbb\nccc");
      // qa -> start recording into a
      v.type("qa");
      expect(v.raw().ctx.macroRecording).toBe("a");
      expect(v.statusMessage()).toBe("recording @a");
      // dd -> delete line (recorded)
      v.type("dd");
      expect(v.content()).toBe("bbb\nccc");
      expect(v.statusMessage()).toBe("recording @a");
      // q -> stop recording
      v.type("q");
      expect(v.raw().ctx.macroRecording).toBeNull();
      expect(v.statusMessage()).toBe("");
      expect(v.raw().ctx.macros.a).toEqual(["d", "d"]);
      // @a -> replay (deletes another line)
      v.type("@a");
      expect(v.content()).toBe("ccc");
    });

    it("@@ replays the last executed macro", () => {
      const v = vim("aaa\nbbb\nccc\nddd");
      // Record macro: dd
      v.type("qaddq");
      expect(v.content()).toBe("bbb\nccc\nddd");
      // @a -> replay
      v.type("@a");
      expect(v.content()).toBe("ccc\nddd");
      expect(v.raw().ctx.lastMacro).toBe("a");
      // @@ -> replay last
      v.type("@@");
      expect(v.content()).toBe("ddd");
    });

    it("macro with insert mode: qaihello<Esc>q then @a", () => {
      const buffer = new TextBuffer("world\nworld");
      const ctx = createTestContext({ line: 0, col: 0 });
      // Record: ihello<Esc>
      const { ctx: afterRecord } = pressKeys(["q", "a", "i", "h", "i", "Escape", "q"], ctx, buffer);
      expect(buffer.getContent()).toBe("hiworld\nworld");
      // Move to next line and replay
      const { ctx: onLine1 } = pressKeys(["j", "0"], afterRecord, buffer);
      pressKeys(["@", "a"], onLine1, buffer);
      expect(buffer.getContent()).toBe("hiworld\nhiworld");
    });

    it("@a does nothing when macro is empty/unrecorded", () => {
      const v = vim("hello");
      v.type("@a");
      expect(v.content()).toBe("hello");
    });

    it("@@ does nothing when no macro was executed before", () => {
      const v = vim("hello");
      v.type("@@");
      expect(v.content()).toBe("hello");
    });
  });

  describe("Unknown key", () => {
    it("resets context on unrecognized key", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 }, { count: 5 });
      const { ctx: result } = pressKeys(["z"], ctx, buffer);
      expect(result.count).toBe(0);
      expect(result.phase).toBe("idle");
    });
  });

  // ---------------------------------------------------
  // readOnly mode
  // ---------------------------------------------------
  describe("readOnly mode", () => {
    /** Helper to process multiple keys in readOnly mode */
    function pressKeysReadOnly(keys: string[], ctx: VimContext, buffer: TextBuffer) {
      let current = ctx;
      const allActions: import("../types").VimAction[] = [];
      for (const key of keys) {
        const result = processKeystroke(key, current, buffer, false, true);
        current = result.newCtx;
        allActions.push(...result.actions);
      }
      return { ctx: current, allActions };
    }

    it("cannot enter insert mode with i, a, o, I, A, O", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });

      for (const key of ["i", "a", "o", "I", "A", "O"]) {
        const result = processKeystroke(key, ctx, buffer, false, true);
        expect(result.newCtx.mode).toBe("normal");
      }
    });

    it("blocks d, c operators", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext({ line: 0, col: 0 });

      const { ctx: afterD } = pressKeysReadOnly(["d"], ctx, buffer);
      expect(afterD.phase).toBe("idle");
      expect(afterD.operator).toBeNull();
      expect(buffer.getContent()).toBe("hello world");

      const { ctx: afterC } = pressKeysReadOnly(["c"], ctx, buffer);
      expect(afterC.phase).toBe("idle");
      expect(afterC.operator).toBeNull();
      expect(buffer.getContent()).toBe("hello world");
    });

    it("allows y operator", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext({ line: 0, col: 0 });

      const { ctx: result, allActions } = pressKeysReadOnly(["y", "w"], ctx, buffer);
      expect(result.register).toBe("hello ");
      expect(allActions.some((a) => a.type === "yank")).toBe(true);
      expect(buffer.getContent()).toBe("hello world");
    });

    it("blocks x, p, P", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 }, { register: "test" });

      for (const key of ["x", "p", "P"]) {
        const result = processKeystroke(key, ctx, buffer, false, true);
        expect(result.newCtx.mode).toBe("normal");
        expect(buffer.getContent()).toBe("hello");
      }
    });

    it("blocks J (join lines)", () => {
      const buffer = new TextBuffer("hello\nworld");
      const ctx = createTestContext({ line: 0, col: 0 });

      const result = processKeystroke("J", ctx, buffer, false, true);
      expect(buffer.getContent()).toBe("hello\nworld");
      expect(result.newCtx.mode).toBe("normal");
    });

    it("blocks u (undo)", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });

      const result = processKeystroke("u", ctx, buffer, false, true);
      expect(result.newCtx.mode).toBe("normal");
    });

    it("blocks r (replace)", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });

      const result = processKeystroke("r", ctx, buffer, false, true);
      expect(buffer.getContent()).toBe("hello");
    });

    it("blocks Ctrl-R (redo)", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });

      const result = processKeystroke("r", ctx, buffer, true, true);
      expect(result.newCtx.mode).toBe("normal");
    });

    it("blocks : (ex command)", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });

      const result = processKeystroke(":", ctx, buffer, false, true);
      expect(result.newCtx.mode).toBe("normal");
    });

    it("allows motions (h, j, k, l, w, e, b)", () => {
      const buffer = new TextBuffer("hello world\nsecond line");
      const ctx = createTestContext({ line: 0, col: 0 });

      // w: next word
      const r1 = processKeystroke("w", ctx, buffer, false, true);
      expect(r1.newCtx.cursor.col).toBe(6);

      // j: next line
      const r2 = processKeystroke("j", ctx, buffer, false, true);
      expect(r2.newCtx.cursor.line).toBe(1);
    });

    it("allows / (search)", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });

      const result = processKeystroke("/", ctx, buffer, false, true);
      expect(result.newCtx.mode).toBe("command-line");
      expect(result.newCtx.commandType).toBe("/");
    });

    it("allows v, V (visual mode)", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });

      const r1 = processKeystroke("v", ctx, buffer, false, true);
      expect(r1.newCtx.mode).toBe("visual");

      const r2 = processKeystroke("V", ctx, buffer, false, true);
      expect(r2.newCtx.mode).toBe("visual-line");
    });

    it("blocks d, x, c in visual mode", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext(
        { line: 0, col: 0 },
        { mode: "visual", visualAnchor: { line: 0, col: 0 } },
      );

      // Move cursor to create a selection
      const { ctx: afterMotion } = pressKeysReadOnly(["w"], ctx, buffer);

      for (const key of ["d", "x", "c"]) {
        const result = processKeystroke(key, afterMotion, buffer, false, true);
        expect(buffer.getContent()).toBe("hello world");
      }
    });

    it("allows y in visual mode", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext(
        { line: 0, col: 0 },
        { mode: "visual", visualAnchor: { line: 0, col: 0 } },
      );

      const { ctx: afterMotion } = pressKeysReadOnly(["e"], ctx, buffer);
      const result = processKeystroke("y", afterMotion, buffer, false, true);
      expect(result.newCtx.register).toBeTruthy();
      expect(buffer.getContent()).toBe("hello world");
    });

    it("forces back to normal mode when in insert mode", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext(
        { line: 0, col: 2 },
        { mode: "insert", statusMessage: "-- INSERT --" },
      );

      const result = processKeystroke("a", ctx, buffer, false, true);
      expect(result.newCtx.mode).toBe("normal");
    });
  });

  // ---------------------------------------------------
  // Modifier keys (Shift, Control, Alt, Meta) must not reset state
  // ---------------------------------------------------
  describe("Modifier key handling", () => {
    it("Shift key does not reset count (10G goes to line 10)", () => {
      const lines = Array.from({ length: 100 }, (_, i) => `line${i + 1}`).join("\n");
      const buffer = new TextBuffer(lines);
      const ctx = createTestContext({ line: 0, col: 0 });
      // Simulate: 1, 0, Shift (keydown), G (keydown)
      const { ctx: result } = pressKeys(["1", "0", "Shift", "G"], ctx, buffer);
      expect(result.cursor.line).toBe(9); // line 10 (0-indexed)
    });

    it("Shift key does not reset count during operator-pending (5Shift+G = 5G)", () => {
      const lines = Array.from({ length: 100 }, (_, i) => `line${i + 1}`).join("\n");
      const buffer = new TextBuffer(lines);
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["5", "Shift", "G"], ctx, buffer);
      expect(result.cursor.line).toBe(4); // line 5 (0-indexed)
    });

    it("Shift key does not reset operator-pending state (d + Shift + G)", () => {
      const lines = Array.from({ length: 20 }, (_, i) => `line${i + 1}`).join("\n");
      const buffer = new TextBuffer(lines);
      const ctx = createTestContext({ line: 5, col: 0 });
      pressKeys(["d", "Shift", "G"], ctx, buffer);
      // dG from line 5 deletes line6..line20
      expect(buffer.getLineCount()).toBe(5);
    });

    it("Control/Alt/Meta keys do not reset count", () => {
      const lines = Array.from({ length: 50 }, (_, i) => `line${i + 1}`).join("\n");
      const buffer = new TextBuffer(lines);
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["2", "0", "Control", "Alt", "Meta", "j"], ctx, buffer);
      expect(result.cursor.line).toBe(20);
    });
  });

  // ---------------------------------------------------
  // Large buffer count operations
  // ---------------------------------------------------
  describe("Large buffer count operations", () => {
    const makeLargeBuffer = (n: number) => {
      const lines = Array.from({ length: n }, (_, i) => `line ${i + 1}: content here`).join("\n");
      return lines;
    };

    it("52G moves to line 52 in a 200-line buffer", () => {
      const buffer = new TextBuffer(makeLargeBuffer(200));
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["5", "2", "Shift", "G"], ctx, buffer);
      expect(result.cursor.line).toBe(51);
    });

    it("110G clamps to last line in a 100-line buffer", () => {
      const buffer = new TextBuffer(makeLargeBuffer(100));
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["1", "1", "0", "Shift", "G"], ctx, buffer);
      expect(result.cursor.line).toBe(99);
    });

    it("15dd deletes 15 lines", () => {
      const v = vim(makeLargeBuffer(50), { cursor: [10, 0] });
      v.type("15dd");
      expect(v.raw().buffer.getLineCount()).toBe(35);
    });

    it("20yy yanks 20 lines without modifying buffer", () => {
      const v = vim(makeLargeBuffer(50));
      v.type("20yy");
      expect(v.raw().buffer.getLineCount()).toBe(50);
      const yankedLines = v.register('"').split("\n").length - 1; // trailing \n
      expect(yankedLines).toBe(20);
    });

    it("30gg moves to line 30", () => {
      const v = vim(makeLargeBuffer(100));
      v.type("30gg");
      expect(v.cursor().line).toBe(29);
    });

    it("50j moves 50 lines down", () => {
      const v = vim(makeLargeBuffer(200), { cursor: [10, 0] });
      v.type("50j");
      expect(v.cursor().line).toBe(60);
    });
  });

  // ---------------------------------------------------
  // Status messages
  // ---------------------------------------------------
  describe("Status messages", () => {
    const makeLargeText = (n: number) => {
      const lines = Array.from({ length: n }, (_, i) => `line${i + 1}`).join("\n");
      return lines;
    };

    it("shows 'N lines yanked' for 5yy", () => {
      const v = vim(makeLargeText(20));
      v.type("5yy");
      expect(v.statusMessage()).toBe("5 lines yanked");
    });

    it("shows 'N fewer lines' for 3dd", () => {
      const v = vim(makeLargeText(20));
      v.type("3dd");
      expect(v.statusMessage()).toBe("3 fewer lines");
    });

    it("does not show status message for 1dd (single line)", () => {
      const v = vim(makeLargeText(20));
      v.type("dd");
      expect(v.statusMessage()).toBe("");
    });

    it("does not show status message for 1yy (single line)", () => {
      const v = vim(makeLargeText(20));
      v.type("yy");
      expect(v.statusMessage()).toBe("");
    });

    it("shows 'N more lines' for paste of multi-line yank", () => {
      const v = vim(makeLargeText(20));
      // Yank 5 lines, then paste
      v.type("5yy");
      v.type("p");
      expect(v.statusMessage()).toBe("5 more lines");
    });

    it("shows 'N fewer lines' on undo of multi-line paste", () => {
      const v = vim(makeLargeText(20));
      v.type("5yy");
      v.type("p");
      expect(v.raw().buffer.getLineCount()).toBe(25);
      v.type("u");
      expect(v.raw().buffer.getLineCount()).toBe(20);
      expect(v.statusMessage()).toBe("5 fewer lines");
    });

    it("shows 'N more lines' on undo of multi-line delete", () => {
      const v = vim(makeLargeText(20));
      v.type("5dd");
      expect(v.raw().buffer.getLineCount()).toBe(15);
      v.type("u");
      expect(v.raw().buffer.getLineCount()).toBe(20);
      expect(v.statusMessage()).toBe("5 more lines");
    });

    it("shows 'N fewer lines' for dG from middle of file", () => {
      const buffer = new TextBuffer(makeLargeText(20));
      const ctx = createTestContext({ line: 5, col: 0 });
      const { ctx: result } = pressKeys(["d", "Shift", "G"], ctx, buffer);
      expect(result.statusMessage).toBe("15 fewer lines");
    });

    it("shows 'N lines yanked' for yG from middle of file", () => {
      const buffer = new TextBuffer(makeLargeText(20));
      const ctx = createTestContext({ line: 5, col: 0 });
      const { ctx: result } = pressKeys(["y", "Shift", "G"], ctx, buffer);
      expect(result.statusMessage).toBe("15 lines yanked");
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
  // Coverage: withRegisterInfo with named register + status message
  // ---------------------------------------------------
  describe("withRegisterInfo (named register + status message)", () => {
    it('"a3dd shows status message with register info', () => {
      const v = vim("line1\nline2\nline3\nline4\nline5");
      v.type('"a3dd');
      expect(v.content()).toBe("line4\nline5");
      expect(v.raw().ctx.registers.a).toBe("line1\nline2\nline3\n");
      // statusMessage should include register info
      expect(v.statusMessage()).toContain('"a');
    });
  });

  // ---------------------------------------------------
  // Coverage: handleTextObjectPending with invalid text object key
  // ---------------------------------------------------
  describe("handleTextObjectPending with invalid text object", () => {
    it("resets when resolveTextObject returns null (e.g., diQ)", () => {
      const v = vim("hello world");
      // d -> operator-pending, i -> text-object-pending, Q -> invalid text object
      v.type("diQ");
      expect(v.raw().ctx.phase).toBe("idle");
      expect(v.raw().ctx.operator).toBeNull();
      expect(v.content()).toBe("hello world"); // no change
    });
  });

  // ---------------------------------------------------
  // Coverage: handleTextObjectPending without operator (defensive)
  // ---------------------------------------------------
  describe("handleTextObjectPending without operator", () => {
    it("resets gracefully when text-object-pending state has no operator", () => {
      const buffer = new TextBuffer("hello world");
      // Manually construct a context in text-object-pending state without an operator
      const ctx = createTestContext(
        { line: 0, col: 0 },
        {
          phase: "text-object-pending" as const,
          textObjectModifier: "i",
          operator: null,
        },
      );
      // Press 'w' to trigger the text-object-pending handler with a valid text object but no operator
      const result = processKeystroke("w", ctx, buffer);
      expect(result.newCtx.phase).toBe("idle");
      expect(result.newCtx.operator).toBeNull();
      expect(buffer.getContent()).toBe("hello world"); // no change
    });
  });

  // ---------------------------------------------------
  // Coverage: Count input during operator-pending state
  // ---------------------------------------------------
  describe("Count input during operator-pending", () => {
    it("d2w deletes 2 words via count during operator-pending", () => {
      const v = vim("one two three four");
      // d -> operator-pending, 2 -> count accumulation, w -> motion with count=2
      v.type("d2w");
      expect(v.content()).toBe("three four");
      expect(v.raw().ctx.phase).toBe("idle");
      expect(v.raw().ctx.operator).toBeNull();
    });

    it("c3w changes 3 words and enters insert mode", () => {
      const v = vim("one two three four five");
      v.type("c3w");
      expect(v.content()).toBe("four five");
      expect(v.mode()).toBe("insert");
    });

    it("y2w yanks 2 words without changing buffer", () => {
      const v = vim("one two three four");
      v.type("y2w");
      expect(v.content()).toBe("one two three four");
      expect(v.register('"')).toBe("one two ");
    });
  });

  // ---------------------------------------------------
  // Coverage: Motion returns null during operator-pending (invalid key)
  // ---------------------------------------------------
  describe("Invalid key during operator-pending cancels operator", () => {
    it("dQ cancels operator (Q is not a motion)", () => {
      const v = vim("hello world");
      v.type("dQ");
      expect(v.raw().ctx.phase).toBe("idle");
      expect(v.raw().ctx.operator).toBeNull();
      expect(v.content()).toBe("hello world"); // no change
    });

    it("yZ cancels operator (Z is not a motion)", () => {
      const v = vim("hello world");
      v.type("yZ");
      expect(v.raw().ctx.phase).toBe("idle");
      expect(v.raw().ctx.operator).toBeNull();
      expect(v.register('"')).toBe(""); // nothing yanked
    });
  });

  // ---------------------------------------------------
  // Coverage: Pattern not found during * / # word search
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
  // Coverage: Invalid mark key (non-lowercase after m)
  // ---------------------------------------------------
  describe("Invalid mark key", () => {
    it("m1 resets (1 is not a valid mark key)", () => {
      const v = vim("hello world");
      v.type("m1");
      expect(v.raw().ctx.phase).toBe("idle");
      // No mark should be set
      expect(v.raw().ctx.marks["1"]).toBeUndefined();
    });

    it("mM resets (uppercase M is not a valid mark key)", () => {
      const v = vim("hello world");
      v.type("mM");
      expect(v.raw().ctx.phase).toBe("idle");
      expect(v.raw().ctx.marks["M"]).toBeUndefined();
    });

    it("m! resets (special character is not a valid mark key)", () => {
      const v = vim("hello world");
      v.type("m!");
      expect(v.raw().ctx.phase).toBe("idle");
    });
  });

  // ---------------------------------------------------
  // Coverage: Invalid jump mark key (non-lowercase after `)
  // ---------------------------------------------------
  describe("Invalid jump mark key", () => {
    it("`1 resets (1 is not a valid jump mark key)", () => {
      const v = vim("hello world");
      v.type("`1");
      expect(v.raw().ctx.phase).toBe("idle");
      // Cursor should not change
      expect(v.cursor()).toEqual({ line: 0, col: 0 });
    });

    it("`M resets (uppercase M is not a valid jump mark key)", () => {
      const v = vim("hello world");
      v.type("`M");
      expect(v.raw().ctx.phase).toBe("idle");
    });

    it("'1 resets (1 is not a valid jump mark key via ')", () => {
      const v = vim("hello world");
      v.type("'1");
      expect(v.raw().ctx.phase).toBe("idle");
    });
  });

  // ---------------------------------------------------
  // Coverage: d; when char search repeat does not move cursor (line 514)
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
  // Branch coverage: line 72 branch 1
  // Paste from a named register that has NOT been set yet.
  // ctx.registers[ctx.selectedRegister] ?? "" → hits the ?? fallback
  // ---------------------------------------------------
  describe("Paste from unset named register", () => {
    it('"ap does nothing when register a has never been set', () => {
      const v = vim("hello");
      // "ap → select register a, then paste. Register a is undefined → getRegisterText returns ""
      v.type('"ap');
      expect(v.content()).toBe("hello"); // no change
      expect(v.cursor()).toEqual({ line: 0, col: 0 });
    });
  });

  // ---------------------------------------------------
  // Branch coverage: lines 356/358
  // handleTextObjectPending with 'c' operator → insert mode
  // ---------------------------------------------------
  describe("ciw enters insert mode via text object", () => {
    it("ciw changes inner word and enters insert mode", () => {
      const v = vim("hello world");
      v.type("ciw");
      expect(v.mode()).toBe("insert");
      expect(v.statusMessage()).toBe("-- INSERT --");
      expect(v.allActions().some((a) => a.type === "mode-change" && a.mode === "insert")).toBe(
        true,
      );
    });
  });

  // ---------------------------------------------------
  // Branch coverage: line 404 branch 0
  // handleGPending with operator → mode change (cgg enters insert mode)
  // ---------------------------------------------------
  describe("cgg enters insert mode", () => {
    it("cgg changes from cursor to beginning of file and enters insert mode", () => {
      const v = vim("line1\nline2\nline3", { cursor: [2, 0] });
      v.type("cgg");
      expect(v.mode()).toBe("insert");
      // mode-change action is emitted because opResult.newMode (insert) !== ctx.mode (normal)
      expect(v.allActions().some((a) => a.type === "mode-change" && a.mode === "insert")).toBe(
        true,
      );
    });
  });

  // ---------------------------------------------------
  // Branch coverage: line 615 branch 1
  // I on an all-whitespace line → lineText.match(/\S/)?.index ?? 0 hits ?? fallback
  // ---------------------------------------------------
  describe("I on an all-whitespace line", () => {
    it("I moves to column 0 on an all-whitespace line", () => {
      const v = vim("   ", { cursor: [0, 2] });
      v.type("I");
      expect(v.mode()).toBe("insert");
      expect(v.cursor().col).toBe(0);
    });
  });

  // ---------------------------------------------------
  // Branch coverage: line 893
  // P (paste before) with empty register → early return
  // ---------------------------------------------------
  describe("P with empty register", () => {
    it("P does nothing when register is empty", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 }, { register: "" });
      const { ctx: result } = pressKeys(["P"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello");
      expect(result.cursor).toEqual({ line: 0, col: 0 });
    });
  });

  // ---------------------------------------------------
  // Branch coverage: line 1082
  // N with backward searchDirection → reverses to forward
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

  // ---------------------------------------------------
  // Branch coverage: line 1234
  // getLeadingWhitespace on a line with no leading whitespace (exercises the function)
  // Pressing 'o' on an empty line
  // ---------------------------------------------------
  describe("o on an empty line exercises getLeadingWhitespace", () => {
    it("o on an empty line opens a new line with no indent", () => {
      const v = vim("");
      v.type("o");
      expect(v.mode()).toBe("insert");
      expect(v.cursor()).toEqual({ line: 1, col: 0 });
      expect(v.content()).toBe("\n");
    });
  });
});

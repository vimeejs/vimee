/**
 * normal-mode.test.ts
 *
 * Integration tests for normal mode.
 * Comprehensively verifies behavior of counts, operators, motions,
 * mode transitions, editing commands, etc. through processKeystroke.
 */

import { describe, it, expect } from "vitest";
import type { VimContext, CursorPosition } from "../types";
import { processKeystroke, createInitialContext } from "../vim-state";
import { TextBuffer } from "../buffer";

// =====================
// Helper functions
// =====================

/** Create a VimContext for testing */
function createTestContext(
  cursor: CursorPosition,
  overrides?: Partial<VimContext>,
): VimContext {
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
      const buffer = new TextBuffer("line1\nline2\nline3\nline4\nline5");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["3", "j"], ctx, buffer);
      expect(result.cursor).toEqual({ line: 3, col: 0 });
    });

    it("moves 5 lines up with 5k (clamped when not enough lines)", () => {
      const buffer = new TextBuffer("line1\nline2\nline3");
      const ctx = createTestContext({ line: 2, col: 0 });
      const { ctx: result } = pressKeys(["5", "k"], ctx, buffer);
      expect(result.cursor.line).toBe(0);
    });

    it("moves 2 columns right with 2l", () => {
      const buffer = new TextBuffer("abcdef");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["2", "l"], ctx, buffer);
      expect(result.cursor.col).toBe(2);
    });

    it("moves 5 words forward with 5w", () => {
      const buffer = new TextBuffer("one two three four five six seven");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["5", "w"], ctx, buffer);
      // 5w: one->two->three->four->five->six start
      expect(result.cursor.col).toBe(24);
    });

    it("interprets count 0 as move to beginning of line (when no count entered)", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext({ line: 0, col: 5 });
      const { ctx: result } = pressKeys(["0"], ctx, buffer);
      expect(result.cursor.col).toBe(0);
    });

    it("correctly processes a two-digit count like 10j", () => {
      const lines = Array.from({ length: 20 }, (_, i) => `line${i}`).join(
        "\n",
      );
      const buffer = new TextBuffer(lines);
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["1", "0", "j"], ctx, buffer);
      expect(result.cursor.line).toBe(10);
    });
  });

  // ---------------------------------------------------
  // Operator + motion
  // ---------------------------------------------------
  describe("Operator + motion", () => {
    it("deletes one word with dw", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["d", "w"], ctx, buffer);
      expect(buffer.getContent()).toBe("world");
      expect(result.cursor.col).toBe(0);
    });

    it("deletes to end of line with d$", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext({ line: 0, col: 5 });
      const { ctx: result } = pressKeys(["d", "$"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello");
      expect(result.cursor.col).toBe(4);
    });

    it("deletes to beginning of line with d0", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext({ line: 0, col: 5 });
      pressKeys(["d", "0"], ctx, buffer);
      expect(buffer.getContent()).toBe(" world");
    });

    it("deletes from cursor line to end of file with dG", () => {
      const buffer = new TextBuffer("line1\nline2\nline3\nline4");
      const ctx = createTestContext({ line: 1, col: 0 });
      pressKeys(["d", "G"], ctx, buffer);
      expect(buffer.getContent()).toBe("line1");
    });

    it("deletes from cursor line to beginning of file with dgg", () => {
      const buffer = new TextBuffer("line1\nline2\nline3\nline4");
      const ctx = createTestContext({ line: 2, col: 0 });
      pressKeys(["d", "g", "g"], ctx, buffer);
      expect(buffer.getContent()).toBe("line4");
    });

    it("yanks one word with yw (buffer unchanged)", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["y", "w"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello world");
      expect(result.register).toBe("hello ");
    });

    it("changes one word and enters insert mode with cw", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["c", "w"], ctx, buffer);
      expect(buffer.getContent()).toBe("world");
      expect(result.mode).toBe("insert");
    });
  });

  // ---------------------------------------------------
  // Double operators (line-wise operations)
  // ---------------------------------------------------
  describe("Double operators (dd, yy, cc)", () => {
    it("deletes the current line with dd", () => {
      const buffer = new TextBuffer("line1\nline2\nline3");
      const ctx = createTestContext({ line: 1, col: 0 });
      const { ctx: result } = pressKeys(["d", "d"], ctx, buffer);
      expect(buffer.getContent()).toBe("line1\nline3");
      expect(result.register).toBe("line2\n");
      expect(result.cursor.line).toBe(1);
    });

    it("yanks the current line with yy (buffer unchanged)", () => {
      const buffer = new TextBuffer("line1\nline2\nline3");
      const ctx = createTestContext({ line: 1, col: 0 });
      const { ctx: result } = pressKeys(["y", "y"], ctx, buffer);
      expect(buffer.getContent()).toBe("line1\nline2\nline3");
      expect(result.register).toBe("line2\n");
    });

    it("clears the current line and enters insert mode with cc", () => {
      const buffer = new TextBuffer("line1\nline2\nline3");
      const ctx = createTestContext({ line: 1, col: 0 });
      const { ctx: result } = pressKeys(["c", "c"], ctx, buffer);
      expect(result.mode).toBe("insert");
      expect(result.register).toBe("line2\n");
      // cc deletes the line and inserts an empty line
      expect(buffer.getLine(1)).toBe("");
    });
  });

  // ---------------------------------------------------
  // Count + operator
  // ---------------------------------------------------
  describe("Count + operator", () => {
    it("deletes 3 lines with 3dd", () => {
      const buffer = new TextBuffer("line1\nline2\nline3\nline4\nline5");
      const ctx = createTestContext({ line: 1, col: 0 });
      pressKeys(["3", "d", "d"], ctx, buffer);
      expect(buffer.getContent()).toBe("line1\nline5");
    });

    it("yanks 2 lines with 2yy", () => {
      const buffer = new TextBuffer("line1\nline2\nline3\nline4");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["2", "y", "y"], ctx, buffer);
      expect(result.register).toBe("line1\nline2\n");
      expect(buffer.getContent()).toBe("line1\nline2\nline3\nline4");
    });

    it("clamps 2dd near the last line", () => {
      const buffer = new TextBuffer("line1\nline2\nline3");
      const ctx = createTestContext({ line: 2, col: 0 });
      pressKeys(["2", "d", "d"], ctx, buffer);
      // Only 1 line from line 2, so only line3 is deleted
      expect(buffer.getContent()).toBe("line1\nline2");
    });

    it("yanks 10 lines with 10yy", () => {
      const lines = Array.from({ length: 20 }, (_, i) => `line${i}`).join("\n");
      const buffer = new TextBuffer(lines);
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["1", "0", "y", "y"], ctx, buffer);
      const expected = Array.from({ length: 10 }, (_, i) => `line${i}`).join("\n") + "\n";
      expect(result.register).toBe(expected);
      expect(buffer.getContent()).toBe(lines);
    });

    it("deletes 10 lines with 10dd", () => {
      const lines = Array.from({ length: 20 }, (_, i) => `line${i}`).join("\n");
      const buffer = new TextBuffer(lines);
      const ctx = createTestContext({ line: 0, col: 0 });
      pressKeys(["1", "0", "d", "d"], ctx, buffer);
      const expected = Array.from({ length: 10 }, (_, i) => `line${i + 10}`).join("\n");
      expect(buffer.getContent()).toBe(expected);
    });

    it("moves to line 52 with 52G", () => {
      const lines = Array.from({ length: 100 }, (_, i) => `line${i}`).join("\n");
      const buffer = new TextBuffer(lines);
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["5", "2", "G"], ctx, buffer);
      expect(result.cursor.line).toBe(51);
    });

    it("moves to line 110 with 110G (clamped to last line)", () => {
      const lines = Array.from({ length: 100 }, (_, i) => `line${i}`).join("\n");
      const buffer = new TextBuffer(lines);
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["1", "1", "0", "G"], ctx, buffer);
      expect(result.cursor.line).toBe(99);
    });

    it("moves to line 10 with 10gg", () => {
      const lines = Array.from({ length: 20 }, (_, i) => `line${i}`).join("\n");
      const buffer = new TextBuffer(lines);
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["1", "0", "g", "g"], ctx, buffer);
      expect(result.cursor.line).toBe(9);
    });

    it("deletes 2 words with 2dw", () => {
      const buffer = new TextBuffer("one two three four");
      const ctx = createTestContext({ line: 0, col: 0 });
      pressKeys(["2", "d", "w"], ctx, buffer);
      expect(buffer.getContent()).toBe("three four");
    });
  });

  // ---------------------------------------------------
  // x (character deletion)
  // ---------------------------------------------------
  describe("x command (character deletion)", () => {
    it("deletes the character under the cursor with x", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["x"], ctx, buffer);
      expect(buffer.getContent()).toBe("ello");
      expect(result.register).toBe("h");
    });

    it("adjusts cursor when pressing x at end of line", () => {
      const buffer = new TextBuffer("abc");
      const ctx = createTestContext({ line: 0, col: 2 });
      const { ctx: result } = pressKeys(["x"], ctx, buffer);
      expect(buffer.getContent()).toBe("ab");
      expect(result.cursor.col).toBe(1);
    });

    it("does nothing when pressing x on an empty line", () => {
      const buffer = new TextBuffer("");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["x"], ctx, buffer);
      expect(buffer.getContent()).toBe("");
      expect(result.cursor.col).toBe(0);
    });

    it("deletes 3 characters with 3x", () => {
      const buffer = new TextBuffer("abcdef");
      const ctx = createTestContext({ line: 0, col: 0 });
      pressKeys(["3", "x"], ctx, buffer);
      expect(buffer.getContent()).toBe("def");
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
      const ctx = createTestContext(
        { line: 0, col: 0 },
        { register: "line2\n" },
      );
      const { ctx: result } = pressKeys(["p"], ctx, buffer);
      expect(buffer.getContent()).toBe("line1\nline2\nline3");
      expect(result.cursor).toEqual({ line: 1, col: 0 });
    });

    it("pastes line-wise above the current line with P", () => {
      const buffer = new TextBuffer("line1\nline3");
      const ctx = createTestContext(
        { line: 1, col: 0 },
        { register: "line2\n" },
      );
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
      const ctx = createTestContext(
        { line: 0, col: 0 },
        { register: "line1\nline2\nline3\n" },
      );
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
      const ctx = createTestContext(
        { line: 1, col: 0 },
        { register: "line1\nline2\n" },
      );
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
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["~"], ctx, buffer);
      expect(buffer.getContent()).toBe("Hello");
      expect(result.cursor.col).toBe(1);
    });

    it("toggles uppercase to lowercase", () => {
      const buffer = new TextBuffer("HELLO");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["~"], ctx, buffer);
      expect(buffer.getContent()).toBe("hELLO");
      expect(result.cursor.col).toBe(1);
    });

    it("toggles 3 characters with 3~", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["3", "~"], ctx, buffer);
      expect(buffer.getContent()).toBe("HELlo");
      expect(result.cursor.col).toBe(3);
    });

    it("leaves non-alpha characters unchanged and advances", () => {
      const buffer = new TextBuffer("a1b");
      const ctx = createTestContext({ line: 0, col: 0 });
      pressKeys(["3", "~"], ctx, buffer);
      expect(buffer.getContent()).toBe("A1B");
    });

    it("clamps cursor at end of line", () => {
      const buffer = new TextBuffer("ab");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["5", "~"], ctx, buffer);
      expect(buffer.getContent()).toBe("AB");
      expect(result.cursor.col).toBe(1);
    });

    it("does nothing on an empty line", () => {
      const buffer = new TextBuffer("");
      const ctx = createTestContext({ line: 0, col: 0 });
      pressKeys(["~"], ctx, buffer);
      expect(buffer.getContent()).toBe("");
    });
  });

  // ---------------------------------------------------
  // D (delete to end of line)
  // ---------------------------------------------------
  describe("D command (delete to end of line)", () => {
    it("deletes from cursor to end of line with D", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext({ line: 0, col: 5 });
      const { ctx: result } = pressKeys(["D"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello");
      expect(result.register).toBe(" world");
      expect(result.cursor.col).toBe(4);
    });

    it("deletes entire line content with D at column 0", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["D"], ctx, buffer);
      expect(buffer.getContent()).toBe("");
      expect(result.register).toBe("hello world");
    });

    it("deletes last character with D at end of line", () => {
      const buffer = new TextBuffer("abc");
      const ctx = createTestContext({ line: 0, col: 2 });
      const { ctx: result } = pressKeys(["D"], ctx, buffer);
      expect(buffer.getContent()).toBe("ab");
      expect(result.register).toBe("c");
    });

    it("does not affect other lines with D", () => {
      const buffer = new TextBuffer("hello world\nsecond line");
      const ctx = createTestContext({ line: 0, col: 5 });
      pressKeys(["D"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello\nsecond line");
    });
  });

  // ---------------------------------------------------
  // C (change to end of line)
  // ---------------------------------------------------
  describe("C command (change to end of line)", () => {
    it("deletes from cursor to end of line and enters insert mode with C", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext({ line: 0, col: 5 });
      const { ctx: result } = pressKeys(["C"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello");
      expect(result.mode).toBe("insert");
      expect(result.register).toBe(" world");
      expect(result.cursor.col).toBe(5);
    });

    it("changes entire line content with C at column 0", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["C"], ctx, buffer);
      expect(buffer.getContent()).toBe("");
      expect(result.mode).toBe("insert");
    });
  });

  // ---------------------------------------------------
  // u (undo)
  // ---------------------------------------------------
  describe("u command (undo)", () => {
    it("undoes the previous change with u", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext({ line: 0, col: 0 });
      // First delete the line with dd
      const { ctx: afterDelete } = pressKeys(["d", "d"], ctx, buffer);
      expect(buffer.getContent()).toBe("");
      // undo
      const { ctx: afterUndo } = pressKeys(["u"], afterDelete, buffer);
      expect(buffer.getContent()).toBe("hello world");
      expect(afterUndo.cursor).toEqual({ line: 0, col: 0 });
    });

    it("displays a message when the undo stack is empty", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result, allActions } = pressKeys(["u"], ctx, buffer);
      expect(result.statusMessage).toBe("Already at oldest change");
      expect(allActions).toContainEqual({
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
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 2 });
      const { ctx: result } = pressKeys(["i"], ctx, buffer);
      expect(result.mode).toBe("insert");
      expect(result.cursor.col).toBe(2);
    });

    it("moves cursor one position right and enters insert mode with a", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 2 });
      const { ctx: result } = pressKeys(["a"], ctx, buffer);
      expect(result.mode).toBe("insert");
      expect(result.cursor.col).toBe(3);
    });

    it("moves to the first non-whitespace character and enters insert mode with I", () => {
      const buffer = new TextBuffer("  hello");
      const ctx = createTestContext({ line: 0, col: 5 });
      const { ctx: result } = pressKeys(["I"], ctx, buffer);
      expect(result.mode).toBe("insert");
      expect(result.cursor.col).toBe(2);
    });

    it("moves to end of line and enters insert mode with A", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["A"], ctx, buffer);
      expect(result.mode).toBe("insert");
      expect(result.cursor.col).toBe(5);
    });

    it("inserts a blank line below and enters insert mode with o", () => {
      const buffer = new TextBuffer("line1\nline2");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["o"], ctx, buffer);
      expect(result.mode).toBe("insert");
      expect(result.cursor).toEqual({ line: 1, col: 0 });
      expect(buffer.getContent()).toBe("line1\n\nline2");
    });

    it("inserts a blank line above and enters insert mode with O", () => {
      const buffer = new TextBuffer("line1\nline2");
      const ctx = createTestContext({ line: 1, col: 0 });
      const { ctx: result } = pressKeys(["O"], ctx, buffer);
      expect(result.mode).toBe("insert");
      expect(result.cursor).toEqual({ line: 1, col: 0 });
      expect(buffer.getContent()).toBe("line1\n\nline2");
    });

    it("o preserves indentation from current line", () => {
      const buffer = new TextBuffer("  indented");
      const ctx = createTestContext({ line: 0, col: 2 });
      const { ctx: result } = pressKeys(["o"], ctx, buffer);
      expect(result.mode).toBe("insert");
      expect(result.cursor).toEqual({ line: 1, col: 2 });
      expect(buffer.getLine(1)).toBe("  ");
    });

    it("O preserves indentation from current line", () => {
      const buffer = new TextBuffer("  indented");
      const ctx = createTestContext({ line: 0, col: 2 });
      const { ctx: result } = pressKeys(["O"], ctx, buffer);
      expect(result.mode).toBe("insert");
      expect(result.cursor).toEqual({ line: 0, col: 2 });
      expect(buffer.getLine(0)).toBe("  ");
    });
  });

  // ---------------------------------------------------
  // v / V (transition to visual mode)
  // ---------------------------------------------------
  describe("Transition to visual mode", () => {
    it("enters visual mode with v", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 2 });
      const { ctx: result } = pressKeys(["v"], ctx, buffer);
      expect(result.mode).toBe("visual");
      expect(result.visualAnchor).toEqual({ line: 0, col: 2 });
    });

    it("enters visual-line mode with V", () => {
      const buffer = new TextBuffer("hello\nworld");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["V"], ctx, buffer);
      expect(result.mode).toBe("visual-line");
      expect(result.visualAnchor).toEqual({ line: 0, col: 0 });
    });
  });

  // ---------------------------------------------------
  // J (join lines)
  // ---------------------------------------------------
  describe("J command (join lines)", () => {
    it("joins the current line with the next line using a space with J", () => {
      const buffer = new TextBuffer("hello\nworld");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["J"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello world");
      expect(result.cursor.col).toBe(5);
    });

    it("strips leading whitespace from the next line when joining with J", () => {
      const buffer = new TextBuffer("hello\n  world");
      const ctx = createTestContext({ line: 0, col: 0 });
      pressKeys(["J"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello world");
    });

    it("does nothing when pressing J on the last line", () => {
      const buffer = new TextBuffer("hello\nworld");
      const ctx = createTestContext({ line: 1, col: 0 });
      pressKeys(["J"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello\nworld");
    });
  });

  // ---------------------------------------------------
  // g prefix (gg)
  // ---------------------------------------------------
  describe("g prefix commands", () => {
    it("moves to the beginning of the file with gg", () => {
      const buffer = new TextBuffer("line1\nline2\nline3");
      const ctx = createTestContext({ line: 2, col: 3 });
      const { ctx: result } = pressKeys(["g", "g"], ctx, buffer);
      expect(result.cursor.line).toBe(0);
    });

    it("moves to line 3 with 3gg", () => {
      const buffer = new TextBuffer("line1\nline2\nline3\nline4");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["3", "g", "g"], ctx, buffer);
      expect(result.cursor.line).toBe(2);
    });

    it("moves to the end of the file with G", () => {
      const buffer = new TextBuffer("line1\nline2\nline3");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["G"], ctx, buffer);
      expect(result.cursor.line).toBe(2);
    });

    it("resets on unknown g command", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["g", "x"], ctx, buffer);
      expect(result.phase).toBe("idle");
    });
  });

  // ---------------------------------------------------
  // f / F / t / T (character search)
  // ---------------------------------------------------
  describe("f / F / t / T commands (in-line character search)", () => {
    it("moves cursor to the position of 'o' with fo", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["f", "o"], ctx, buffer);
      expect(result.cursor.col).toBe(4);
    });

    it("searches backward for 'o' with Fo", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext({ line: 0, col: 7 });
      const { ctx: result } = pressKeys(["F", "o"], ctx, buffer);
      expect(result.cursor.col).toBe(4);
    });

    it("moves to just before 'o' with to", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["t", "o"], ctx, buffer);
      expect(result.cursor.col).toBe(3);
    });

    it("moves to just after 'o' backward with To", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext({ line: 0, col: 7 });
      const { ctx: result } = pressKeys(["T", "o"], ctx, buffer);
      expect(result.cursor.col).toBe(5);
    });
  });

  // ---------------------------------------------------
  // ; / , (repeat last f/F/t/T)
  // ---------------------------------------------------
  describe("; / , commands (repeat last char search)", () => {
    it("repeats fo with ;", () => {
      const buffer = new TextBuffer("one.two.three.four");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: afterF } = pressKeys(["f", "."], ctx, buffer);
      expect(afterF.cursor.col).toBe(3);
      const { ctx: afterSemicolon } = pressKeys([";"], afterF, buffer);
      expect(afterSemicolon.cursor.col).toBe(7);
      const { ctx: afterSemicolon2 } = pressKeys([";"], afterSemicolon, buffer);
      expect(afterSemicolon2.cursor.col).toBe(13);
    });

    it("reverses direction with ,", () => {
      const buffer = new TextBuffer("one.two.three.four");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: afterF } = pressKeys(["f", "."], ctx, buffer);
      expect(afterF.cursor.col).toBe(3);
      const { ctx: afterSemicolon } = pressKeys([";"], afterF, buffer);
      expect(afterSemicolon.cursor.col).toBe(7);
      const { ctx: afterComma } = pressKeys([","], afterSemicolon, buffer);
      expect(afterComma.cursor.col).toBe(3);
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
      const buffer = new TextBuffer("a.b.c.d");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: afterT } = pressKeys(["t", "."], ctx, buffer);
      expect(afterT.cursor.col).toBe(0); // t stops before '.'... but col 0 means didn't move from col 0, actually t. from col 0 on "a.b.c.d" should go to col 0 (before the '.' at col 1)
    });

    it("does nothing with ; when no previous f/F/t/T", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys([";"], ctx, buffer);
      expect(result.cursor.col).toBe(0);
    });

    it("does nothing with , when no previous f/F/t/T", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys([","], ctx, buffer);
      expect(result.cursor.col).toBe(0);
    });

    it("works with operator: d; deletes to next match (inclusive)", () => {
      const buffer = new TextBuffer("one.two.three");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: afterF } = pressKeys(["f", "."], ctx, buffer);
      expect(afterF.cursor.col).toBe(3);
      // d; from '.' (col 3) deletes inclusive to next '.' (col 7)
      pressKeys(["d", ";"], afterF, buffer);
      expect(buffer.getContent()).toBe("onethree");
    });
  });

  // ---------------------------------------------------
  // * / # (search word under cursor)
  // ---------------------------------------------------
  describe("* / # commands (search word under cursor)", () => {
    it("* searches forward for the word under cursor", () => {
      const buffer = new TextBuffer("foo bar foo baz foo");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["*"], ctx, buffer);
      expect(result.cursor.col).toBe(8);
      expect(result.lastSearch).toContain("foo");
    });

    it("* wraps around to the beginning across lines", () => {
      const buffer = new TextBuffer("bar foo\nbaz\nfoo end");
      const ctx = createTestContext({ line: 2, col: 0 }); // on the last 'foo'
      const { ctx: result } = pressKeys(["*"], ctx, buffer);
      expect(result.cursor).toEqual({ line: 0, col: 4 });
    });

    it("# searches backward for the word under cursor", () => {
      const buffer = new TextBuffer("foo bar foo baz foo");
      const ctx = createTestContext({ line: 0, col: 8 }); // on the middle 'foo'
      const { ctx: result } = pressKeys(["#"], ctx, buffer);
      expect(result.cursor.col).toBe(0);
    });

    it("* works across multiple lines", () => {
      const buffer = new TextBuffer("hello world\ngoodbye world\nhello again");
      const ctx = createTestContext({ line: 0, col: 0 }); // on 'hello'
      const { ctx: result } = pressKeys(["*"], ctx, buffer);
      expect(result.cursor).toEqual({ line: 2, col: 0 });
    });

    it("* then n repeats the search", () => {
      const buffer = new TextBuffer("foo bar foo baz foo");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: afterStar } = pressKeys(["*"], ctx, buffer);
      expect(afterStar.cursor.col).toBe(8);
      const { ctx: afterN } = pressKeys(["n"], afterStar, buffer);
      expect(afterN.cursor.col).toBe(16);
    });

    it("does nothing when cursor is not on a word character", () => {
      const buffer = new TextBuffer("foo . bar");
      const ctx = createTestContext({ line: 0, col: 4 }); // on '.'
      const { ctx: result } = pressKeys(["*"], ctx, buffer);
      expect(result.cursor.col).toBe(4);
    });

    it("does nothing on an empty line", () => {
      const buffer = new TextBuffer("");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["*"], ctx, buffer);
      expect(result.cursor.col).toBe(0);
    });
  });

  // ---------------------------------------------------
  // r (single character replacement)
  // ---------------------------------------------------
  describe("r command (single character replacement)", () => {
    it("replaces the character under the cursor with 'x' using rx", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });
      pressKeys(["r", "x"], ctx, buffer);
      expect(buffer.getContent()).toBe("xello");
    });

    it("does nothing when pressing r on an empty line", () => {
      const buffer = new TextBuffer("");
      const ctx = createTestContext({ line: 0, col: 0 });
      pressKeys(["r", "x"], ctx, buffer);
      expect(buffer.getContent()).toBe("");
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
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys([":"], ctx, buffer);
      expect(result.mode).toBe("command-line");
      expect(result.commandType).toBe(":");
    });

    it("enters forward search mode with /", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["/"], ctx, buffer);
      expect(result.mode).toBe("command-line");
      expect(result.commandType).toBe("/");
      expect(result.searchDirection).toBe("forward");
    });

    it("enters backward search mode with ?", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["?"], ctx, buffer);
      expect(result.mode).toBe("command-line");
      expect(result.commandType).toBe("?");
      expect(result.searchDirection).toBe("backward");
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
      expect(result.newCtx.statusMessage).toBe(
        "Already at newest change",
      );
    });
  });

  // ---------------------------------------------------
  // Special behavior during operator-pending
  // ---------------------------------------------------
  describe("Operator pending", () => {
    it("cancels operator on invalid key", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["d", "z"], ctx, buffer);
      expect(result.phase).toBe("idle");
      expect(result.operator).toBeNull();
    });

    it("operator + character search motion works with dfa", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["d", "f", "o"], ctx, buffer);
      expect(buffer.getContent()).toBe(" world");
    });
  });

  // ---------------------------------------------------
  // >> / << (indent / dedent)
  // ---------------------------------------------------
  describe(">> / << commands (indent / dedent)", () => {
    it(">> indents the current line", () => {
      const buffer = new TextBuffer("hello\nworld");
      const ctx = createTestContext({ line: 0, col: 0 });
      pressKeys([">", ">"], ctx, buffer);
      expect(buffer.getLine(0)).toBe("  hello");
      expect(buffer.getLine(1)).toBe("world");
    });

    it("<< dedents the current line", () => {
      const buffer = new TextBuffer("  hello\nworld");
      const ctx = createTestContext({ line: 0, col: 0 });
      pressKeys(["<", "<"], ctx, buffer);
      expect(buffer.getLine(0)).toBe("hello");
    });

    it("3>> indents 3 lines", () => {
      const buffer = new TextBuffer("aaa\nbbb\nccc\nddd");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["3", ">", ">"], ctx, buffer);
      expect(buffer.getLine(0)).toBe("  aaa");
      expect(buffer.getLine(1)).toBe("  bbb");
      expect(buffer.getLine(2)).toBe("  ccc");
      expect(buffer.getLine(3)).toBe("ddd");
      expect(result.statusMessage).toBe('3 lines >ed 1 time');
    });

    it("3<< dedents 3 lines", () => {
      const buffer = new TextBuffer("  aaa\n  bbb\n  ccc\nddd");
      const ctx = createTestContext({ line: 0, col: 0 });
      pressKeys(["3", "<", "<"], ctx, buffer);
      expect(buffer.getLine(0)).toBe("aaa");
      expect(buffer.getLine(1)).toBe("bbb");
      expect(buffer.getLine(2)).toBe("ccc");
      expect(buffer.getLine(3)).toBe("ddd");
    });

    it(">j indents current line and next line", () => {
      const buffer = new TextBuffer("aaa\nbbb\nccc");
      const ctx = createTestContext({ line: 0, col: 0 });
      pressKeys([">", "j"], ctx, buffer);
      expect(buffer.getLine(0)).toBe("  aaa");
      expect(buffer.getLine(1)).toBe("  bbb");
      expect(buffer.getLine(2)).toBe("ccc");
    });

    it("<< does nothing when line has no indent", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });
      pressKeys(["<", "<"], ctx, buffer);
      expect(buffer.getLine(0)).toBe("hello");
    });

    it("<< removes partial indent (less than indent width)", () => {
      const buffer = new TextBuffer(" hello");
      const ctx = createTestContext({ line: 0, col: 0 });
      pressKeys(["<", "<"], ctx, buffer);
      expect(buffer.getLine(0)).toBe("hello");
    });

    it(">> can be undone", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: afterIndent } = pressKeys([">", ">"], ctx, buffer);
      expect(buffer.getLine(0)).toBe("  hello");
      pressKeys(["u"], afterIndent, buffer);
      expect(buffer.getLine(0)).toBe("hello");
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
      const buffer = new TextBuffer("hello\nworld\nfoo");
      const ctx = createTestContext({ line: 0, col: 0 });
      // "ayy -> yank line into register a
      const { ctx: afterYank } = pressKeys(['"', "a", "y", "y"], ctx, buffer);
      expect(afterYank.registers.a).toBe("hello\n");
      expect(afterYank.register).toBe("hello\n"); // also in unnamed
      // yy on line 1 -> overwrites unnamed register
      const { ctx: afterYy } = pressKeys(["j", "y", "y"], afterYank, buffer);
      expect(afterYy.register).toBe("world\n");
      // "ap -> paste from register a (not the unnamed)
      const { ctx: moved } = pressKeys(["j"], afterYy, buffer);
      pressKeys(['"', "a", "p"], moved, buffer);
      expect(buffer.getContent()).toBe("hello\nworld\nfoo\nhello");
    });

    it('"bdd stores deleted line in register b', () => {
      const buffer = new TextBuffer("aaa\nbbb\nccc");
      const ctx = createTestContext({ line: 1, col: 0 });
      const { ctx: afterDd } = pressKeys(['"', "b", "d", "d"], ctx, buffer);
      expect(buffer.getContent()).toBe("aaa\nccc");
      expect(afterDd.registers.b).toBe("bbb\n");
      expect(afterDd.register).toBe("bbb\n");
    });

    it('"bp pastes from register b', () => {
      const buffer = new TextBuffer("ab");
      const ctx = createTestContext(
        { line: 0, col: 0 },
        { registers: { b: "X" } },
      );
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
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(['"', "1"], ctx, buffer);
      expect(result.phase).toBe("idle");
      expect(result.selectedRegister).toBeNull();
    });
  });

  // ---------------------------------------------------
  // . (dot repeat)
  // ---------------------------------------------------
  describe(". command (dot repeat)", () => {
    it("repeats dd", () => {
      const buffer = new TextBuffer("line1\nline2\nline3\nline4");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: afterDd } = pressKeys(["d", "d"], ctx, buffer);
      expect(buffer.getContent()).toBe("line2\nline3\nline4");
      const { ctx: afterDot } = pressKeys(["."], afterDd, buffer);
      expect(buffer.getContent()).toBe("line3\nline4");
      expect(afterDot.mode).toBe("normal");
    });

    it("repeats x", () => {
      const buffer = new TextBuffer("abcdef");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: afterX } = pressKeys(["x"], ctx, buffer);
      expect(buffer.getContent()).toBe("bcdef");
      const { ctx: afterDot } = pressKeys(["."], afterX, buffer);
      expect(buffer.getContent()).toBe("cdef");
    });

    it("repeats ciw + typed text", () => {
      const buffer = new TextBuffer("foo bar baz");
      const ctx = createTestContext({ line: 0, col: 0 });
      // ciw replaces 'foo' with 'hello'
      const { ctx: afterChange } = pressKeys(
        ["c", "i", "w", "h", "e", "l", "l", "o", "Escape"],
        ctx,
        buffer,
      );
      expect(buffer.getContent()).toBe("hello bar baz");
      // Move to 'bar' and repeat
      const { ctx: onBar } = pressKeys(["w"], afterChange, buffer);
      const { ctx: afterDot } = pressKeys(["."], onBar, buffer);
      expect(buffer.getContent()).toBe("hello hello baz");
      expect(afterDot.mode).toBe("normal");
    });

    it("repeats dw", () => {
      const buffer = new TextBuffer("one two three four");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: afterDw } = pressKeys(["d", "w"], ctx, buffer);
      expect(buffer.getContent()).toBe("two three four");
      const { ctx: afterDot } = pressKeys(["."], afterDw, buffer);
      expect(buffer.getContent()).toBe("three four");
    });

    it("repeats r{char}", () => {
      const buffer = new TextBuffer("aaa");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: afterR } = pressKeys(["r", "x"], ctx, buffer);
      expect(buffer.getContent()).toBe("xaa");
      const { ctx: afterMove } = pressKeys(["l"], afterR, buffer);
      pressKeys(["."], afterMove, buffer);
      expect(buffer.getContent()).toBe("xxa");
    });

    it("repeats ~ (toggle case)", () => {
      const buffer = new TextBuffer("abcdef");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: afterTilde } = pressKeys(["~"], ctx, buffer);
      expect(buffer.getContent()).toBe("Abcdef");
      pressKeys(["."], afterTilde, buffer);
      expect(buffer.getContent()).toBe("ABcdef");
    });

    it("repeats insert session (ihi<Esc>)", () => {
      const buffer = new TextBuffer("ab");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: afterInsert } = pressKeys(
        ["i", "X", "Escape"],
        ctx,
        buffer,
      );
      expect(buffer.getContent()).toBe("Xab");
      // Move right and repeat -> inserts X before cursor
      const { ctx: moved } = pressKeys(["l", "l"], afterInsert, buffer);
      expect(moved.cursor.col).toBe(2);
      pressKeys(["."], moved, buffer);
      expect(buffer.getContent()).toBe("XaXb");
    });

    it("does nothing when no previous change", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });
      pressKeys(["."], ctx, buffer);
      expect(buffer.getContent()).toBe("hello");
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
      const buffer = new TextBuffer("line1\nline2\nline3\nline4\nline5");
      const ctx = createTestContext({ line: 1, col: 3 });
      // Set mark a
      const { ctx: afterMark } = pressKeys(["m", "a"], ctx, buffer);
      expect(afterMark.marks.a).toEqual({ line: 1, col: 3 });
      // Move away
      const { ctx: moved } = pressKeys(["G"], afterMark, buffer);
      expect(moved.cursor.line).toBe(4);
      // Jump back to mark a
      const { ctx: jumped } = pressKeys(["`", "a"], moved, buffer);
      expect(jumped.cursor).toEqual({ line: 1, col: 3 });
    });

    it("'a also jumps to mark a", () => {
      const buffer = new TextBuffer("line1\nline2\nline3");
      const ctx = createTestContext({ line: 2, col: 0 });
      const { ctx: afterMark } = pressKeys(["m", "b"], ctx, buffer);
      const { ctx: moved } = pressKeys(["g", "g"], afterMark, buffer);
      const { ctx: jumped } = pressKeys(["'", "b"], moved, buffer);
      expect(jumped.cursor.line).toBe(2);
    });

    it("multiple marks work independently", () => {
      const buffer = new TextBuffer("aaa\nbbb\nccc\nddd");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: a1 } = pressKeys(["m", "a"], ctx, buffer);
      const { ctx: a2 } = pressKeys(["j", "j", "m", "b"], a1, buffer);
      expect(a2.marks.a).toEqual({ line: 0, col: 0 });
      expect(a2.marks.b).toEqual({ line: 2, col: 0 });
      // Jump to a
      const { ctx: ja } = pressKeys(["`", "a"], a2, buffer);
      expect(ja.cursor.line).toBe(0);
      // Jump to b
      const { ctx: jb } = pressKeys(["`", "b"], ja, buffer);
      expect(jb.cursor.line).toBe(2);
    });

    it("shows error when mark is not set", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["`", "z"], ctx, buffer);
      expect(result.statusMessage).toBe("Mark 'z' not set");
    });

    it("clamps to buffer bounds if lines were deleted", () => {
      const buffer = new TextBuffer("line1\nline2\nline3");
      const ctx = createTestContext({ line: 2, col: 0 });
      const { ctx: afterMark } = pressKeys(["m", "a"], ctx, buffer);
      // Delete last line
      const { ctx: afterDd } = pressKeys(["d", "d"], afterMark, buffer);
      expect(buffer.getLineCount()).toBe(2);
      // Jump to mark a (line 2 no longer exists, clamp to line 1)
      const { ctx: jumped } = pressKeys(["`", "a"], afterDd, buffer);
      expect(jumped.cursor.line).toBe(1);
    });
  });

  describe("Macro recording & playback", () => {
    it("qa starts recording, q stops, @a replays", () => {
      const buffer = new TextBuffer("aaa\nbbb\nccc");
      const ctx = createTestContext({ line: 0, col: 0 });
      // qa -> start recording into a
      const { ctx: recording } = pressKeys(["q", "a"], ctx, buffer);
      expect(recording.macroRecording).toBe("a");
      expect(recording.statusMessage).toBe("recording @a");
      // dd -> delete line (recorded)
      const { ctx: afterDd } = pressKeys(["d", "d"], recording, buffer);
      expect(buffer.getContent()).toBe("bbb\nccc");
      expect(afterDd.statusMessage).toBe("recording @a");
      // q -> stop recording
      const { ctx: stopped } = pressKeys(["q"], afterDd, buffer);
      expect(stopped.macroRecording).toBeNull();
      expect(stopped.statusMessage).toBe("");
      expect(stopped.macros.a).toEqual(["d", "d"]);
      // @a -> replay (deletes another line)
      pressKeys(["@", "a"], stopped, buffer);
      expect(buffer.getContent()).toBe("ccc");
    });

    it("@@ replays the last executed macro", () => {
      const buffer = new TextBuffer("aaa\nbbb\nccc\nddd");
      const ctx = createTestContext({ line: 0, col: 0 });
      // Record macro: dd
      const { ctx: afterRecord } = pressKeys(["q", "a", "d", "d", "q"], ctx, buffer);
      expect(buffer.getContent()).toBe("bbb\nccc\nddd");
      // @a -> replay
      const { ctx: afterAt } = pressKeys(["@", "a"], afterRecord, buffer);
      expect(buffer.getContent()).toBe("ccc\nddd");
      expect(afterAt.lastMacro).toBe("a");
      // @@ -> replay last
      pressKeys(["@", "@"], afterAt, buffer);
      expect(buffer.getContent()).toBe("ddd");
    });

    it("macro with insert mode: qaihello<Esc>q then @a", () => {
      const buffer = new TextBuffer("world\nworld");
      const ctx = createTestContext({ line: 0, col: 0 });
      // Record: ihello<Esc>
      const { ctx: afterRecord } = pressKeys(
        ["q", "a", "i", "h", "i", "Escape", "q"],
        ctx,
        buffer,
      );
      expect(buffer.getContent()).toBe("hiworld\nworld");
      // Move to next line and replay
      const { ctx: onLine1 } = pressKeys(["j", "0"], afterRecord, buffer);
      pressKeys(["@", "a"], onLine1, buffer);
      expect(buffer.getContent()).toBe("hiworld\nhiworld");
    });

    it("@a does nothing when macro is empty/unrecorded", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });
      pressKeys(["@", "a"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello");
    });

    it("@@ does nothing when no macro was executed before", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });
      pressKeys(["@", "@"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello");
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
    function pressKeysReadOnly(
      keys: string[],
      ctx: VimContext,
      buffer: TextBuffer,
    ) {
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

      const { ctx: result, allActions } = pressKeysReadOnly(
        ["y", "w"],
        ctx,
        buffer,
      );
      expect(result.register).toBe("hello ");
      expect(allActions.some((a) => a.type === "yank")).toBe(true);
      expect(buffer.getContent()).toBe("hello world");
    });

    it("blocks x, p, P", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext(
        { line: 0, col: 0 },
        { register: "test" },
      );

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
      return new TextBuffer(lines);
    };

    it("52G moves to line 52 in a 200-line buffer", () => {
      const buffer = makeLargeBuffer(200);
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["5", "2", "Shift", "G"], ctx, buffer);
      expect(result.cursor.line).toBe(51);
    });

    it("110G clamps to last line in a 100-line buffer", () => {
      const buffer = makeLargeBuffer(100);
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["1", "1", "0", "Shift", "G"], ctx, buffer);
      expect(result.cursor.line).toBe(99);
    });

    it("15dd deletes 15 lines", () => {
      const buffer = makeLargeBuffer(50);
      const ctx = createTestContext({ line: 10, col: 0 });
      pressKeys(["1", "5", "d", "d"], ctx, buffer);
      expect(buffer.getLineCount()).toBe(35);
    });

    it("20yy yanks 20 lines without modifying buffer", () => {
      const buffer = makeLargeBuffer(50);
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["2", "0", "y", "y"], ctx, buffer);
      expect(buffer.getLineCount()).toBe(50);
      const yankedLines = result.register.split("\n").length - 1; // trailing \n
      expect(yankedLines).toBe(20);
    });

    it("30gg moves to line 30", () => {
      const buffer = makeLargeBuffer(100);
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["3", "0", "g", "g"], ctx, buffer);
      expect(result.cursor.line).toBe(29);
    });

    it("50j moves 50 lines down", () => {
      const buffer = makeLargeBuffer(200);
      const ctx = createTestContext({ line: 10, col: 0 });
      const { ctx: result } = pressKeys(["5", "0", "j"], ctx, buffer);
      expect(result.cursor.line).toBe(60);
    });
  });

  // ---------------------------------------------------
  // Status messages
  // ---------------------------------------------------
  describe("Status messages", () => {
    const makeLargeBuffer = (n: number) => {
      const lines = Array.from({ length: n }, (_, i) => `line${i + 1}`).join("\n");
      return new TextBuffer(lines);
    };

    it("shows 'N lines yanked' for 5yy", () => {
      const buffer = makeLargeBuffer(20);
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["5", "y", "y"], ctx, buffer);
      expect(result.statusMessage).toBe("5 lines yanked");
    });

    it("shows 'N fewer lines' for 3dd", () => {
      const buffer = makeLargeBuffer(20);
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["3", "d", "d"], ctx, buffer);
      expect(result.statusMessage).toBe("3 fewer lines");
    });

    it("does not show status message for 1dd (single line)", () => {
      const buffer = makeLargeBuffer(20);
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["d", "d"], ctx, buffer);
      expect(result.statusMessage).toBe("");
    });

    it("does not show status message for 1yy (single line)", () => {
      const buffer = makeLargeBuffer(20);
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["y", "y"], ctx, buffer);
      expect(result.statusMessage).toBe("");
    });

    it("shows 'N more lines' for paste of multi-line yank", () => {
      const buffer = makeLargeBuffer(20);
      const ctx = createTestContext({ line: 0, col: 0 });
      // Yank 5 lines, then paste
      const { ctx: afterYank } = pressKeys(["5", "y", "y"], ctx, buffer);
      const { ctx: afterPaste } = pressKeys(["p"], afterYank, buffer);
      expect(afterPaste.statusMessage).toBe("5 more lines");
    });

    it("shows 'N fewer lines' on undo of multi-line paste", () => {
      const buffer = makeLargeBuffer(20);
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: afterYank } = pressKeys(["5", "y", "y"], ctx, buffer);
      const { ctx: afterPaste } = pressKeys(["p"], afterYank, buffer);
      expect(buffer.getLineCount()).toBe(25);
      const { ctx: afterUndo } = pressKeys(["u"], afterPaste, buffer);
      expect(buffer.getLineCount()).toBe(20);
      expect(afterUndo.statusMessage).toBe("5 fewer lines");
    });

    it("shows 'N more lines' on undo of multi-line delete", () => {
      const buffer = makeLargeBuffer(20);
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: afterDd } = pressKeys(["5", "d", "d"], ctx, buffer);
      expect(buffer.getLineCount()).toBe(15);
      const { ctx: afterUndo } = pressKeys(["u"], afterDd, buffer);
      expect(buffer.getLineCount()).toBe(20);
      expect(afterUndo.statusMessage).toBe("5 more lines");
    });

    it("shows 'N fewer lines' for dG from middle of file", () => {
      const buffer = makeLargeBuffer(20);
      const ctx = createTestContext({ line: 5, col: 0 });
      const { ctx: result } = pressKeys(["d", "Shift", "G"], ctx, buffer);
      expect(result.statusMessage).toBe("15 fewer lines");
    });

    it("shows 'N lines yanked' for yG from middle of file", () => {
      const buffer = makeLargeBuffer(20);
      const ctx = createTestContext({ line: 5, col: 0 });
      const { ctx: result } = pressKeys(["y", "Shift", "G"], ctx, buffer);
      expect(result.statusMessage).toBe("15 lines yanked");
    });
  });

  // ---------------------------------------------------
  // H / M / L (screen-relative motions)
  // ---------------------------------------------------
  describe("H / M / L (screen-relative motions)", () => {
    const makeLargeBuffer = (n: number) => {
      const lines = Array.from({ length: n }, (_, i) => `  line ${i + 1}`).join("\n");
      return new TextBuffer(lines);
    };

    it("H moves to the top of the viewport", () => {
      const buffer = makeLargeBuffer(100);
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
      const buffer = makeLargeBuffer(100);
      const ctx = createTestContext(
        { line: 25, col: 0 },
        { viewportTopLine: 10, viewportHeight: 30 },
      );
      const { ctx: result } = pressKeys(["3", "Shift", "H"], ctx, buffer);
      expect(result.cursor.line).toBe(12);
    });

    it("M moves to the middle of the viewport", () => {
      const buffer = makeLargeBuffer(100);
      const ctx = createTestContext(
        { line: 0, col: 0 },
        { viewportTopLine: 10, viewportHeight: 30 },
      );
      const { ctx: result } = pressKeys(["Shift", "M"], ctx, buffer);
      expect(result.cursor.line).toBe(25); // 10 + 15
    });

    it("L moves to the bottom of the viewport", () => {
      const buffer = makeLargeBuffer(100);
      const ctx = createTestContext(
        { line: 0, col: 0 },
        { viewportTopLine: 10, viewportHeight: 30 },
      );
      const { ctx: result } = pressKeys(["Shift", "L"], ctx, buffer);
      expect(result.cursor.line).toBe(39); // 10 + 30 - 1
    });

    it("3L moves to the 3rd line from bottom of viewport", () => {
      const buffer = makeLargeBuffer(100);
      const ctx = createTestContext(
        { line: 0, col: 0 },
        { viewportTopLine: 10, viewportHeight: 30 },
      );
      const { ctx: result } = pressKeys(["3", "Shift", "L"], ctx, buffer);
      expect(result.cursor.line).toBe(37); // 39 - 2
    });

    it("H is clamped when viewport extends beyond buffer", () => {
      const buffer = makeLargeBuffer(20);
      const ctx = createTestContext(
        { line: 15, col: 0 },
        { viewportTopLine: 15, viewportHeight: 30 },
      );
      const { ctx: result } = pressKeys(["Shift", "L"], ctx, buffer);
      expect(result.cursor.line).toBe(19); // clamped to last line
    });

    it("dH deletes from cursor to top of viewport", () => {
      const buffer = makeLargeBuffer(100);
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
});

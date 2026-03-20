/**
 * visual-mode.test.ts
 *
 * Integration tests for visual mode (character-wise and line-wise).
 * Verifies selection expansion/contraction, operator execution, and mode switching.
 */

import { describe, it, expect } from "vitest";
import type { VimContext, CursorPosition } from "../types";
import { processKeystroke, createInitialContext } from "../vim-state";
import { TextBuffer } from "../buffer";

// =====================
// Helper functions
// =====================

/** Create a VimContext in visual mode for testing */
function createVisualContext(
  cursor: CursorPosition,
  anchor: CursorPosition,
  overrides?: Partial<VimContext>,
): VimContext {
  return {
    ...createInitialContext(cursor),
    mode: "visual",
    visualAnchor: { ...anchor },
    statusMessage: "-- VISUAL --",
    ...overrides,
  };
}

/** Create a VimContext in visual-line mode for testing */
function createVisualLineContext(
  cursor: CursorPosition,
  anchor: CursorPosition,
  overrides?: Partial<VimContext>,
): VimContext {
  return {
    ...createInitialContext(cursor),
    mode: "visual-line",
    visualAnchor: { ...anchor },
    statusMessage: "-- VISUAL LINE --",
    ...overrides,
  };
}

/** Create a VimContext in visual-block mode for testing */
function createBlockContext(
  cursor: CursorPosition,
  anchor: CursorPosition,
  overrides?: Partial<VimContext>,
): VimContext {
  return {
    ...createInitialContext(cursor),
    mode: "visual-block",
    visualAnchor: { ...anchor },
    statusMessage: "-- VISUAL BLOCK --",
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

describe("Visual mode", () => {
  // ---------------------------------------------------
  // Starting visual mode and cursor movement
  // ---------------------------------------------------
  describe("Starting visual mode and cursor movement", () => {
    it("enters visual mode with v and sets the anchor", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createInitialContext({ line: 0, col: 3 });
      const { ctx: result } = pressKeys(["v"], ctx, buffer);
      expect(result.mode).toBe("visual");
      expect(result.visualAnchor).toEqual({ line: 0, col: 3 });
    });

    it("expands selection to the right with l", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createVisualContext(
        { line: 0, col: 3 },
        { line: 0, col: 3 },
      );
      const { ctx: result } = pressKeys(["l", "l"], ctx, buffer);
      expect(result.cursor.col).toBe(5);
      expect(result.visualAnchor).toEqual({ line: 0, col: 3 });
    });

    it("expands selection to the line below with j", () => {
      const buffer = new TextBuffer("hello\nworld\nfoo");
      const ctx = createVisualContext(
        { line: 0, col: 2 },
        { line: 0, col: 2 },
      );
      const { ctx: result } = pressKeys(["j"], ctx, buffer);
      expect(result.cursor.line).toBe(1);
      expect(result.visualAnchor).toEqual({ line: 0, col: 2 });
    });

    it("moves cursor left and shrinks selection with h", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createVisualContext(
        { line: 0, col: 5 },
        { line: 0, col: 3 },
      );
      const { ctx: result } = pressKeys(["h"], ctx, buffer);
      expect(result.cursor.col).toBe(4);
    });

    it("moves to the beginning of the file with gg", () => {
      const buffer = new TextBuffer("line1\nline2\nline3");
      const ctx = createVisualContext(
        { line: 2, col: 0 },
        { line: 2, col: 0 },
      );
      const { ctx: result } = pressKeys(["g", "g"], ctx, buffer);
      expect(result.cursor.line).toBe(0);
      expect(result.visualAnchor).toEqual({ line: 2, col: 0 });
    });
  });

  // ---------------------------------------------------
  // Operators in visual mode
  // ---------------------------------------------------
  describe("Operators in visual mode", () => {
    it("deletes the selection with d", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createVisualContext(
        { line: 0, col: 5 },
        { line: 0, col: 0 },
      );
      const { ctx: result } = pressKeys(["d"], ctx, buffer);
      expect(buffer.getContent()).toBe("world");
      expect(result.mode).toBe("normal");
      expect(result.visualAnchor).toBeNull();
    });

    it("deletes the selection with x (same behavior as d)", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createVisualContext(
        { line: 0, col: 5 },
        { line: 0, col: 0 },
      );
      const { ctx: result } = pressKeys(["x"], ctx, buffer);
      expect(buffer.getContent()).toBe("world");
      expect(result.mode).toBe("normal");
    });

    it("yanks the selection with y (buffer unchanged)", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createVisualContext(
        { line: 0, col: 4 },
        { line: 0, col: 0 },
      );
      const { ctx: result } = pressKeys(["y"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello world");
      expect(result.register).toBe("hello");
      expect(result.mode).toBe("normal");
    });

    it("deletes the selection and enters insert mode with c", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createVisualContext(
        { line: 0, col: 4 },
        { line: 0, col: 0 },
      );
      const { ctx: result } = pressKeys(["c"], ctx, buffer);
      expect(buffer.getContent()).toBe(" world");
      expect(result.mode).toBe("insert");
    });

    it("deletes a multi-line selection with d", () => {
      const buffer = new TextBuffer("line1\nline2\nline3");
      const ctx = createVisualContext(
        { line: 1, col: 2 },
        { line: 0, col: 3 },
      );
      const { ctx: result } = pressKeys(["d"], ctx, buffer);
      // line1 cols 0-2 + line2 cols 3+ are deleted
      expect(result.mode).toBe("normal");
    });
  });

  // ---------------------------------------------------
  // Visual-line mode
  // ---------------------------------------------------
  describe("Visual-line mode", () => {
    it("enters visual-line mode with V", () => {
      const buffer = new TextBuffer("line1\nline2\nline3");
      const ctx = createInitialContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["V"], ctx, buffer);
      expect(result.mode).toBe("visual-line");
    });

    it("deletes entire lines with d in visual-line mode", () => {
      const buffer = new TextBuffer("line1\nline2\nline3");
      const ctx = createVisualLineContext(
        { line: 1, col: 0 },
        { line: 0, col: 0 },
      );
      const { ctx: result } = pressKeys(["d"], ctx, buffer);
      expect(buffer.getContent()).toBe("line3");
      expect(result.mode).toBe("normal");
      expect(result.register).toBe("line1\nline2\n");
    });

    it("yanks entire lines with y in visual-line mode", () => {
      const buffer = new TextBuffer("line1\nline2\nline3");
      const ctx = createVisualLineContext(
        { line: 1, col: 0 },
        { line: 0, col: 0 },
      );
      const { ctx: result } = pressKeys(["y"], ctx, buffer);
      expect(buffer.getContent()).toBe("line1\nline2\nline3");
      expect(result.register).toBe("line1\nline2\n");
      expect(result.mode).toBe("normal");
    });

    it("expands selection downward when pressing j in visual-line mode", () => {
      const buffer = new TextBuffer("line1\nline2\nline3");
      const ctx = createVisualLineContext(
        { line: 0, col: 0 },
        { line: 0, col: 0 },
      );
      const { ctx: result } = pressKeys(["j"], ctx, buffer);
      expect(result.cursor.line).toBe(1);
      expect(result.mode).toBe("visual-line");
    });
  });

  // ---------------------------------------------------
  // Escape (exit visual mode)
  // ---------------------------------------------------
  describe("Escape (exit visual mode)", () => {
    it("returns to normal mode with Escape", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createVisualContext(
        { line: 0, col: 5 },
        { line: 0, col: 0 },
      );
      const { ctx: result } = pressKeys(["Escape"], ctx, buffer);
      expect(result.mode).toBe("normal");
      expect(result.visualAnchor).toBeNull();
    });

    it("returns to normal mode when pressing Escape in visual-line mode", () => {
      const buffer = new TextBuffer("line1\nline2");
      const ctx = createVisualLineContext(
        { line: 1, col: 0 },
        { line: 0, col: 0 },
      );
      const { ctx: result } = pressKeys(["Escape"], ctx, buffer);
      expect(result.mode).toBe("normal");
    });
  });

  // ---------------------------------------------------
  // Mode switching (re-pressing v / V)
  // ---------------------------------------------------
  describe("Mode switching", () => {
    it("returns to normal mode when pressing v again in visual mode", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createVisualContext(
        { line: 0, col: 3 },
        { line: 0, col: 0 },
      );
      const { ctx: result } = pressKeys(["v"], ctx, buffer);
      expect(result.mode).toBe("normal");
    });

    it("switches to visual-line mode when pressing V in visual mode", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createVisualContext(
        { line: 0, col: 3 },
        { line: 0, col: 0 },
      );
      const { ctx: result } = pressKeys(["V"], ctx, buffer);
      expect(result.mode).toBe("visual-line");
    });

    it("returns to normal mode when pressing V again in visual-line mode", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createVisualLineContext(
        { line: 0, col: 0 },
        { line: 0, col: 0 },
      );
      const { ctx: result } = pressKeys(["V"], ctx, buffer);
      expect(result.mode).toBe("normal");
    });

    it("switches to visual mode when pressing v in visual-line mode", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createVisualLineContext(
        { line: 0, col: 0 },
        { line: 0, col: 0 },
      );
      const { ctx: result } = pressKeys(["v"], ctx, buffer);
      expect(result.mode).toBe("visual");
    });
  });

  // ---------------------------------------------------
  // Count prefix
  // ---------------------------------------------------
  describe("Count prefix", () => {
    it("moves cursor 3 positions right with 3l", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createVisualContext(
        { line: 0, col: 0 },
        { line: 0, col: 0 },
      );
      const { ctx: result } = pressKeys(["3", "l"], ctx, buffer);
      expect(result.cursor.col).toBe(3);
    });
  });

  // ---------------------------------------------------
  // Edge case: visualAnchor is null
  // ---------------------------------------------------
  describe("Edge cases", () => {
    it("operator does nothing when visualAnchor is null", () => {
      const buffer = new TextBuffer("hello");
      const ctx: VimContext = {
        ...createInitialContext({ line: 0, col: 0 }),
        mode: "visual",
        visualAnchor: null,
      };
      const { ctx: result } = pressKeys(["d"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello");
      expect(result.mode).toBe("visual");
    });
  });

  // ---------------------------------------------------
  // Visual block mode (Ctrl-V)
  // ---------------------------------------------------
  describe("Visual block mode", () => {
    it("enters visual-block mode with Ctrl-V", () => {
      const buffer = new TextBuffer("hello\nworld");
      const ctx = createInitialContext({ line: 0, col: 0 });
      const result = processKeystroke("v", ctx, buffer, true); // ctrlKey=true
      expect(result.newCtx.mode).toBe("visual-block");
      expect(result.newCtx.statusMessage).toBe("-- VISUAL BLOCK --");
      expect(result.newCtx.visualAnchor).toEqual({ line: 0, col: 0 });
    });

    it("exits visual-block with Ctrl-V again", () => {
      const buffer = new TextBuffer("hello\nworld");
      const ctx = createBlockContext({ line: 1, col: 2 }, { line: 0, col: 0 });
      const result = processKeystroke("v", ctx, buffer, true);
      expect(result.newCtx.mode).toBe("normal");
      expect(result.newCtx.visualAnchor).toBeNull();
    });

    it("exits visual-block with Escape", () => {
      const buffer = new TextBuffer("hello\nworld");
      const ctx = createBlockContext({ line: 1, col: 2 }, { line: 0, col: 0 });
      const result = processKeystroke("Escape", ctx, buffer);
      expect(result.newCtx.mode).toBe("normal");
    });

    it("motions move the cursor in visual-block", () => {
      const buffer = new TextBuffer("hello\nworld\nfoo");
      const ctx = createBlockContext({ line: 0, col: 0 }, { line: 0, col: 0 });
      const { ctx: result } = pressKeys(["j", "l", "l"], ctx, buffer);
      expect(result.cursor).toEqual({ line: 1, col: 2 });
      expect(result.visualAnchor).toEqual({ line: 0, col: 0 });
    });

    it("d deletes the rectangular block", () => {
      const buffer = new TextBuffer("abcde\nfghij\nklmno");
      // Select columns 1-3 on lines 0-1
      const ctx = createBlockContext(
        { line: 1, col: 3 },
        { line: 0, col: 1 },
      );
      const { ctx: result } = pressKeys(["d"], ctx, buffer);
      expect(buffer.getLine(0)).toBe("ae");
      expect(buffer.getLine(1)).toBe("fj");
      expect(buffer.getLine(2)).toBe("klmno"); // unaffected
      expect(result.mode).toBe("normal");
      expect(result.register).toBe("bcd\nghi");
    });

    it("y yanks the rectangular block without modifying buffer", () => {
      const buffer = new TextBuffer("abcde\nfghij\nklmno");
      const ctx = createBlockContext(
        { line: 2, col: 2 },
        { line: 0, col: 1 },
      );
      const { ctx: result } = pressKeys(["y"], ctx, buffer);
      expect(buffer.getContent()).toBe("abcde\nfghij\nklmno");
      expect(result.register).toBe("bc\ngh\nlm");
      expect(result.mode).toBe("normal");
    });

    it("c deletes the block and enters insert mode", () => {
      const buffer = new TextBuffer("abcde\nfghij");
      const ctx = createBlockContext(
        { line: 1, col: 2 },
        { line: 0, col: 1 },
      );
      const { ctx: result } = pressKeys(["c"], ctx, buffer);
      expect(buffer.getLine(0)).toBe("ade");
      expect(buffer.getLine(1)).toBe("fij");
      expect(result.mode).toBe("insert");
      expect(result.register).toBe("bc\ngh");
    });

    it("o swaps anchor and cursor", () => {
      const buffer = new TextBuffer("abcde\nfghij");
      const ctx = createBlockContext(
        { line: 1, col: 3 },
        { line: 0, col: 1 },
      );
      const { ctx: result } = pressKeys(["o"], ctx, buffer);
      expect(result.cursor).toEqual({ line: 0, col: 1 });
      expect(result.visualAnchor).toEqual({ line: 1, col: 3 });
    });

    it("switches from visual to visual-block with Ctrl-V", () => {
      const buffer = new TextBuffer("hello\nworld");
      const ctx = createVisualContext(
        { line: 0, col: 3 },
        { line: 0, col: 0 },
      );
      const result = processKeystroke("v", ctx, buffer, true);
      expect(result.newCtx.mode).toBe("visual-block");
      expect(result.newCtx.visualAnchor).toEqual({ line: 0, col: 0 });
    });

    it("switches from visual-block to visual with v", () => {
      const buffer = new TextBuffer("hello\nworld");
      const ctx = createBlockContext(
        { line: 1, col: 3 },
        { line: 0, col: 0 },
      );
      const result = processKeystroke("v", ctx, buffer);
      expect(result.newCtx.mode).toBe("visual");
    });

    it("switches from visual-block to visual-line with V", () => {
      const buffer = new TextBuffer("hello\nworld");
      const ctx = createBlockContext(
        { line: 1, col: 3 },
        { line: 0, col: 0 },
      );
      const result = processKeystroke("V", ctx, buffer);
      expect(result.newCtx.mode).toBe("visual-line");
    });

    it("I inserts text at block left column on all lines", () => {
      const buffer = new TextBuffer("abcde\nfghij\nklmno");
      // Block select cols 2-3 on lines 0-2
      const ctx = createBlockContext(
        { line: 2, col: 3 },
        { line: 0, col: 2 },
      );
      // I enters insert mode at left col (2) on first line
      const { ctx: insertCtx } = pressKeys(["Shift", "I"], ctx, buffer);
      expect(insertCtx.mode).toBe("insert");
      expect(insertCtx.cursor).toEqual({ line: 0, col: 2 });
      expect(insertCtx.blockInsert).not.toBeNull();

      // Type "XX"
      const { ctx: afterType } = pressKeys(["X", "X"], insertCtx, buffer);
      expect(buffer.getLine(0)).toBe("abXXcde");

      // Escape -> text is replicated to lines 1 and 2
      const { ctx: afterEsc } = pressKeys(["Escape"], afterType, buffer);
      expect(afterEsc.mode).toBe("normal");
      expect(buffer.getLine(0)).toBe("abXXcde");
      expect(buffer.getLine(1)).toBe("fgXXhij");
      expect(buffer.getLine(2)).toBe("klXXmno");
      expect(afterEsc.blockInsert).toBeNull();
    });

    it("A appends text at block right column on all lines", () => {
      const buffer = new TextBuffer("abcde\nfghij\nklmno");
      // Block select cols 1-2 on lines 0-1
      const ctx = createBlockContext(
        { line: 1, col: 2 },
        { line: 0, col: 1 },
      );
      // A enters insert mode at right col + 1 (3) on first line
      const { ctx: insertCtx } = pressKeys(["Shift", "A"], ctx, buffer);
      expect(insertCtx.mode).toBe("insert");
      expect(insertCtx.cursor).toEqual({ line: 0, col: 3 });

      // Type "Z"
      const { ctx: afterType } = pressKeys(["Z"], insertCtx, buffer);
      expect(buffer.getLine(0)).toBe("abcZde");

      // Escape
      const { ctx: afterEsc } = pressKeys(["Escape"], afterType, buffer);
      expect(buffer.getLine(0)).toBe("abcZde");
      expect(buffer.getLine(1)).toBe("fghZij");
      expect(buffer.getLine(2)).toBe("klmno"); // not in block range
    });

    it("I with no text typed does not modify other lines", () => {
      const buffer = new TextBuffer("abc\ndef\nghi");
      const ctx = createBlockContext(
        { line: 2, col: 1 },
        { line: 0, col: 0 },
      );
      const { ctx: insertCtx } = pressKeys(["Shift", "I"], ctx, buffer);
      // Immediately Escape without typing
      pressKeys(["Escape"], insertCtx, buffer);
      expect(buffer.getContent()).toBe("abc\ndef\nghi");
    });

    it("I pads short lines with spaces", () => {
      const buffer = new TextBuffer("abcdef\nab\nabcdef");
      // Block select col 4 on lines 0-2
      const ctx = createBlockContext(
        { line: 2, col: 4 },
        { line: 0, col: 4 },
      );
      const { ctx: insertCtx } = pressKeys(["Shift", "I"], ctx, buffer);
      const { ctx: afterType } = pressKeys(["X"], insertCtx, buffer);
      pressKeys(["Escape"], afterType, buffer);
      expect(buffer.getLine(0)).toBe("abcdXef");
      expect(buffer.getLine(1)).toBe("ab  X"); // padded with spaces, nothing after
      expect(buffer.getLine(2)).toBe("abcdXef");
    });

    it("block insert can be undone with u", () => {
      const buffer = new TextBuffer("abc\ndef\nghi");
      const ctx = createBlockContext(
        { line: 2, col: 1 },
        { line: 0, col: 0 },
      );
      const { ctx: insertCtx } = pressKeys(["Shift", "I"], ctx, buffer);
      const { ctx: afterType } = pressKeys(["X"], insertCtx, buffer);
      const { ctx: afterEsc } = pressKeys(["Escape"], afterType, buffer);
      expect(buffer.getLine(0)).toBe("Xabc");
      expect(buffer.getLine(1)).toBe("Xdef");
      expect(buffer.getLine(2)).toBe("Xghi");
      // Undo the block replication
      const { ctx: afterUndo } = pressKeys(["u"], afterEsc, buffer);
      expect(buffer.getLine(0)).toBe("Xabc"); // first line typed directly
      expect(buffer.getLine(1)).toBe("def");   // reverted
      expect(buffer.getLine(2)).toBe("ghi");   // reverted
      expect(afterUndo.mode).toBe("normal");
    });
  });

  // ---------------------------------------------------
  // Named registers in visual mode
  // ---------------------------------------------------
  describe("Named registers in visual mode", () => {
    it('"ay yanks into named register a with status message', () => {
      const buffer = new TextBuffer("line1\nline2\nline3\nline4");
      const ctx = createVisualContext(
        { line: 2, col: 0 },
        { line: 0, col: 0 },
        { mode: "visual-line" },
      );
      const { ctx: result } = pressKeys(['"', "a", "y"], ctx, buffer);
      expect(result.mode).toBe("normal");
      expect(result.register).toBe("line1\nline2\nline3\n");
      expect(result.registers.a).toBe("line1\nline2\nline3\n");
      expect(result.statusMessage).toBe('3 lines yanked into "a');
    });

    it('"ay then yy then "ap pastes from register a', () => {
      const buffer = new TextBuffer("aaa\nbbb\nccc");
      // Visual select line 0, "ay
      const ctx = createVisualContext(
        { line: 0, col: 0 },
        { line: 0, col: 0 },
        { mode: "visual-line" },
      );
      const { ctx: afterAy } = pressKeys(['"', "a", "y"], ctx, buffer);
      expect(afterAy.registers.a).toBe("aaa\n");
      // yy on line 1 -> overwrites unnamed
      const { ctx: afterYy } = pressKeys(["j", "y", "y"], afterAy, buffer);
      expect(afterYy.register).toBe("bbb\n");
      // "ap on line 2 -> paste from register a
      const { ctx: onLine2 } = pressKeys(["j"], afterYy, buffer);
      pressKeys(['"', "a", "p"], onLine2, buffer);
      expect(buffer.getContent()).toBe("aaa\nbbb\nccc\naaa");
    });

    it('"bd in visual mode deletes into register b', () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createVisualContext(
        { line: 0, col: 4 },
        { line: 0, col: 0 },
      );
      const { ctx: result } = pressKeys(['"', "b", "d"], ctx, buffer);
      expect(buffer.getContent()).toBe(" world");
      expect(result.registers.b).toBe("hello");
      expect(result.register).toBe("hello");
    });

    it("visual block yank into named register", () => {
      const buffer = new TextBuffer("abcde\nfghij\nklmno");
      const ctx = createBlockContext(
        { line: 1, col: 2 },
        { line: 0, col: 1 },
      );
      const { ctx: result } = pressKeys(['"', "c", "y"], ctx, buffer);
      expect(result.registers.c).toBe("bc\ngh");
      expect(result.statusMessage).toBe('2 lines yanked into "c');
    });
  });
});

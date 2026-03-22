/**
 * visual-block-mode.test.ts
 *
 * Tests for visual block mode (Ctrl-V): entering/exiting, motions,
 * operators (d/y/c), block insert (I/A), mode switching, and undo.
 */

import { describe, it, expect } from "vitest";
import type { VimContext, CursorPosition } from "../types";
import { processKeystroke, createInitialContext } from "../vim-state";
import { TextBuffer } from "../buffer";
import { vim } from "@vimee/testkit";

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

describe("Visual mode", () => {
  // ---------------------------------------------------
  // Visual block mode (Ctrl-V)
  // ---------------------------------------------------
  describe("Visual block mode", () => {
    it("enters visual-block mode with Ctrl-V", () => {
      const v = vim("hello\nworld");
      v.type("<C-v>");
      expect(v.mode()).toBe("visual-block");
      expect(v.statusMessage()).toBe("-- VISUAL BLOCK --");
      expect(v.raw().ctx.visualAnchor).toEqual({ line: 0, col: 0 });
    });

    it("exits visual-block with Ctrl-V again", () => {
      const v = vim("hello\nworld", { mode: "visual-block", cursor: [1, 2], anchor: [0, 0] });
      v.type("<C-v>");
      expect(v.mode()).toBe("normal");
      expect(v.raw().ctx.visualAnchor).toBeNull();
    });

    it("exits visual-block with Escape", () => {
      const v = vim("hello\nworld", { mode: "visual-block", cursor: [1, 2], anchor: [0, 0] });
      v.type("<Esc>");
      expect(v.mode()).toBe("normal");
    });

    it("motions move the cursor in visual-block", () => {
      const v = vim("hello\nworld\nfoo", { mode: "visual-block", cursor: [0, 0], anchor: [0, 0] });
      v.type("jll");
      expect(v.cursor()).toEqual({ line: 1, col: 2 });
      expect(v.raw().ctx.visualAnchor).toEqual({ line: 0, col: 0 });
    });

    it("d deletes the rectangular block", () => {
      const v = vim("abcde\nfghij\nklmno", {
        mode: "visual-block",
        cursor: [1, 3],
        anchor: [0, 1],
      });
      v.type("d");
      expect(v.line(0)).toBe("ae");
      expect(v.line(1)).toBe("fj");
      expect(v.line(2)).toBe("klmno"); // unaffected
      expect(v.mode()).toBe("normal");
      expect(v.register('"')).toBe("bcd\nghi");
    });

    it("y yanks the rectangular block without modifying buffer", () => {
      const v = vim("abcde\nfghij\nklmno", {
        mode: "visual-block",
        cursor: [2, 2],
        anchor: [0, 1],
      });
      v.type("y");
      expect(v.content()).toBe("abcde\nfghij\nklmno");
      expect(v.register('"')).toBe("bc\ngh\nlm");
      expect(v.mode()).toBe("normal");
    });

    it("c deletes the block and enters insert mode", () => {
      const v = vim("abcde\nfghij", { mode: "visual-block", cursor: [1, 2], anchor: [0, 1] });
      v.type("c");
      expect(v.line(0)).toBe("ade");
      expect(v.line(1)).toBe("fij");
      expect(v.mode()).toBe("insert");
      expect(v.register('"')).toBe("bc\ngh");
    });

    it("o swaps anchor and cursor", () => {
      const v = vim("abcde\nfghij", { mode: "visual-block", cursor: [1, 3], anchor: [0, 1] });
      v.type("o");
      expect(v.cursor()).toEqual({ line: 0, col: 1 });
      expect(v.raw().ctx.visualAnchor).toEqual({ line: 1, col: 3 });
    });

    it("switches from visual to visual-block with Ctrl-V", () => {
      const v = vim("hello\nworld", { mode: "visual", cursor: [0, 3], anchor: [0, 0] });
      v.type("<C-v>");
      expect(v.mode()).toBe("visual-block");
      expect(v.raw().ctx.visualAnchor).toEqual({ line: 0, col: 0 });
    });

    it("switches from visual-block to visual with v", () => {
      const v = vim("hello\nworld", { mode: "visual-block", cursor: [1, 3], anchor: [0, 0] });
      v.type("v");
      expect(v.mode()).toBe("visual");
    });

    it("switches from visual-block to visual-line with V", () => {
      const v = vim("hello\nworld", { mode: "visual-block", cursor: [1, 3], anchor: [0, 0] });
      v.type("V");
      expect(v.mode()).toBe("visual-line");
    });

    // Kept with old pattern: blockInsert context override
    it("I inserts text at block left column on all lines", () => {
      const buffer = new TextBuffer("abcde\nfghij\nklmno");
      // Block select cols 2-3 on lines 0-2
      const ctx = createBlockContext({ line: 2, col: 3 }, { line: 0, col: 2 });
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

    // Kept with old pattern: blockInsert context override
    it("A appends text at block right column on all lines", () => {
      const buffer = new TextBuffer("abcde\nfghij\nklmno");
      // Block select cols 1-2 on lines 0-1
      const ctx = createBlockContext({ line: 1, col: 2 }, { line: 0, col: 1 });
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

    // Kept with old pattern: blockInsert context override
    it("I with no text typed does not modify other lines", () => {
      const buffer = new TextBuffer("abc\ndef\nghi");
      const ctx = createBlockContext({ line: 2, col: 1 }, { line: 0, col: 0 });
      const { ctx: insertCtx } = pressKeys(["Shift", "I"], ctx, buffer);
      // Immediately Escape without typing
      pressKeys(["Escape"], insertCtx, buffer);
      expect(buffer.getContent()).toBe("abc\ndef\nghi");
    });

    // Kept with old pattern: blockInsert context override
    it("I pads short lines with spaces", () => {
      const buffer = new TextBuffer("abcdef\nab\nabcdef");
      // Block select col 4 on lines 0-2
      const ctx = createBlockContext({ line: 2, col: 4 }, { line: 0, col: 4 });
      const { ctx: insertCtx } = pressKeys(["Shift", "I"], ctx, buffer);
      const { ctx: afterType } = pressKeys(["X"], insertCtx, buffer);
      pressKeys(["Escape"], afterType, buffer);
      expect(buffer.getLine(0)).toBe("abcdXef");
      expect(buffer.getLine(1)).toBe("ab  X"); // padded with spaces, nothing after
      expect(buffer.getLine(2)).toBe("abcdXef");
    });

    // Kept with old pattern: blockInsert context override
    it("block insert can be undone with u", () => {
      const buffer = new TextBuffer("abc\ndef\nghi");
      const ctx = createBlockContext({ line: 2, col: 1 }, { line: 0, col: 0 });
      const { ctx: insertCtx } = pressKeys(["Shift", "I"], ctx, buffer);
      const { ctx: afterType } = pressKeys(["X"], insertCtx, buffer);
      const { ctx: afterEsc } = pressKeys(["Escape"], afterType, buffer);
      expect(buffer.getLine(0)).toBe("Xabc");
      expect(buffer.getLine(1)).toBe("Xdef");
      expect(buffer.getLine(2)).toBe("Xghi");
      // Undo the block replication
      const { ctx: afterUndo } = pressKeys(["u"], afterEsc, buffer);
      expect(buffer.getLine(0)).toBe("Xabc"); // first line typed directly
      expect(buffer.getLine(1)).toBe("def"); // reverted
      expect(buffer.getLine(2)).toBe("ghi"); // reverted
      expect(afterUndo.mode).toBe("normal");
    });
  });
});

/**
 * visual-mode-basic.test.ts
 *
 * Basic visual mode operations: entering visual mode, cursor movement,
 * operators, visual-line mode, escape, mode switching, count prefix, and edge cases.
 */

import { describe, it, expect } from "vitest";
import type { VimContext, CursorPosition } from "../types";
import { processKeystroke, createInitialContext } from "../vim-state";
import { TextBuffer } from "../buffer";
import { vim } from "@vimee/testkit";

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
  // Starting visual mode and cursor movement
  // ---------------------------------------------------
  describe("Starting visual mode and cursor movement", () => {
    it("enters visual mode with v and sets the anchor", () => {
      const v = vim("hello world", { cursor: [0, 3] });
      v.type("v");
      expect(v.mode()).toBe("visual");
      expect(v.raw().ctx.visualAnchor).toEqual({ line: 0, col: 3 });
    });

    it("expands selection to the right with l", () => {
      const v = vim("hello world", { mode: "visual", cursor: [0, 3], anchor: [0, 3] });
      v.type("ll");
      expect(v.cursor().col).toBe(5);
      expect(v.raw().ctx.visualAnchor).toEqual({ line: 0, col: 3 });
    });

    it("expands selection to the line below with j", () => {
      const v = vim("hello\nworld\nfoo", { mode: "visual", cursor: [0, 2], anchor: [0, 2] });
      v.type("j");
      expect(v.cursor().line).toBe(1);
      expect(v.raw().ctx.visualAnchor).toEqual({ line: 0, col: 2 });
    });

    it("moves cursor left and shrinks selection with h", () => {
      const v = vim("hello world", { mode: "visual", cursor: [0, 5], anchor: [0, 3] });
      v.type("h");
      expect(v.cursor().col).toBe(4);
    });

    it("moves to the beginning of the file with gg", () => {
      const v = vim("line1\nline2\nline3", { mode: "visual", cursor: [2, 0], anchor: [2, 0] });
      v.type("gg");
      expect(v.cursor().line).toBe(0);
      expect(v.raw().ctx.visualAnchor).toEqual({ line: 2, col: 0 });
    });
  });

  // ---------------------------------------------------
  // Operators in visual mode
  // ---------------------------------------------------
  describe("Operators in visual mode", () => {
    it("deletes the selection with d", () => {
      const v = vim("hello world", { mode: "visual", cursor: [0, 5], anchor: [0, 0] });
      v.type("d");
      expect(v.content()).toBe("world");
      expect(v.mode()).toBe("normal");
      expect(v.raw().ctx.visualAnchor).toBeNull();
    });

    it("deletes the selection with x (same behavior as d)", () => {
      const v = vim("hello world", { mode: "visual", cursor: [0, 5], anchor: [0, 0] });
      v.type("x");
      expect(v.content()).toBe("world");
      expect(v.mode()).toBe("normal");
    });

    it("yanks the selection with y (buffer unchanged)", () => {
      const v = vim("hello world", { mode: "visual", cursor: [0, 4], anchor: [0, 0] });
      v.type("y");
      expect(v.content()).toBe("hello world");
      expect(v.register('"')).toBe("hello");
      expect(v.mode()).toBe("normal");
    });

    it("deletes the selection and enters insert mode with c", () => {
      const v = vim("hello world", { mode: "visual", cursor: [0, 4], anchor: [0, 0] });
      v.type("c");
      expect(v.content()).toBe(" world");
      expect(v.mode()).toBe("insert");
    });

    it("deletes a multi-line selection with d", () => {
      const v = vim("line1\nline2\nline3", { mode: "visual", cursor: [1, 2], anchor: [0, 3] });
      v.type("d");
      // line1 cols 0-2 + line2 cols 3+ are deleted
      expect(v.mode()).toBe("normal");
    });
  });

  // ---------------------------------------------------
  // Visual-line mode
  // ---------------------------------------------------
  describe("Visual-line mode", () => {
    it("enters visual-line mode with V", () => {
      const v = vim("line1\nline2\nline3");
      v.type("V");
      expect(v.mode()).toBe("visual-line");
    });

    it("deletes entire lines with d in visual-line mode", () => {
      const v = vim("line1\nline2\nline3", { mode: "visual-line", cursor: [1, 0], anchor: [0, 0] });
      v.type("d");
      expect(v.content()).toBe("line3");
      expect(v.mode()).toBe("normal");
      expect(v.register('"')).toBe("line1\nline2\n");
    });

    it("yanks entire lines with y in visual-line mode", () => {
      const v = vim("line1\nline2\nline3", { mode: "visual-line", cursor: [1, 0], anchor: [0, 0] });
      v.type("y");
      expect(v.content()).toBe("line1\nline2\nline3");
      expect(v.register('"')).toBe("line1\nline2\n");
      expect(v.mode()).toBe("normal");
    });

    it("expands selection downward when pressing j in visual-line mode", () => {
      const v = vim("line1\nline2\nline3", { mode: "visual-line", cursor: [0, 0], anchor: [0, 0] });
      v.type("j");
      expect(v.cursor().line).toBe(1);
      expect(v.mode()).toBe("visual-line");
    });
  });

  // ---------------------------------------------------
  // Escape (exit visual mode)
  // ---------------------------------------------------
  describe("Escape (exit visual mode)", () => {
    it("returns to normal mode with Escape", () => {
      const v = vim("hello world", { mode: "visual", cursor: [0, 5], anchor: [0, 0] });
      v.type("<Esc>");
      expect(v.mode()).toBe("normal");
      expect(v.raw().ctx.visualAnchor).toBeNull();
    });

    it("returns to normal mode when pressing Escape in visual-line mode", () => {
      const v = vim("line1\nline2", { mode: "visual-line", cursor: [1, 0], anchor: [0, 0] });
      v.type("<Esc>");
      expect(v.mode()).toBe("normal");
    });
  });

  // ---------------------------------------------------
  // Mode switching (re-pressing v / V)
  // ---------------------------------------------------
  describe("Mode switching", () => {
    it("returns to normal mode when pressing v again in visual mode", () => {
      const v = vim("hello", { mode: "visual", cursor: [0, 3], anchor: [0, 0] });
      v.type("v");
      expect(v.mode()).toBe("normal");
    });

    it("switches to visual-line mode when pressing V in visual mode", () => {
      const v = vim("hello", { mode: "visual", cursor: [0, 3], anchor: [0, 0] });
      v.type("V");
      expect(v.mode()).toBe("visual-line");
    });

    it("returns to normal mode when pressing V again in visual-line mode", () => {
      const v = vim("hello", { mode: "visual-line", cursor: [0, 0], anchor: [0, 0] });
      v.type("V");
      expect(v.mode()).toBe("normal");
    });

    it("switches to visual mode when pressing v in visual-line mode", () => {
      const v = vim("hello", { mode: "visual-line", cursor: [0, 0], anchor: [0, 0] });
      v.type("v");
      expect(v.mode()).toBe("visual");
    });
  });

  // ---------------------------------------------------
  // Count prefix
  // ---------------------------------------------------
  describe("Count prefix", () => {
    it("moves cursor 3 positions right with 3l", () => {
      const v = vim("hello world", { mode: "visual", cursor: [0, 0], anchor: [0, 0] });
      v.type("3l");
      expect(v.cursor().col).toBe(3);
    });
  });

  // ---------------------------------------------------
  // Edge case: visualAnchor is null
  // (kept with old pattern: can't create null anchor via testkit)
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
});

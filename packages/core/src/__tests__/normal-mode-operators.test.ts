/**
 * normal-mode-operators.test.ts
 *
 * Tests for operator commands in normal mode.
 * Covers operator + motion (d, y, c), double operators (dd, yy, cc),
 * character deletion (x), D, C, indent/dedent (>> / <<),
 * operator-pending state, and count during operator-pending.
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

describe("Normal mode — operators", () => {
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
  // Operator pending
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
  // Count input during operator-pending
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
  // Invalid key during operator-pending cancels operator
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
});

/**
 * normal-mode-count.test.ts
 *
 * Tests for count prefix handling in normal mode.
 * Covers numeric count accumulation, count + operator combinations,
 * and large buffer count operations.
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

describe("Normal mode — count", () => {
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
});

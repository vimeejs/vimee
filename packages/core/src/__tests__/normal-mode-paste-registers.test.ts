/**
 * normal-mode-paste-registers.test.ts
 *
 * Tests for paste commands and named register operations in normal mode.
 * Covers p/P (paste), named registers ("a-"z), register info display,
 * and edge cases like pasting from unset or empty registers.
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

describe("Normal mode — paste & registers", () => {
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
  // withRegisterInfo (named register + status message)
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
  // Paste from unset named register
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
  // P with empty register
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
});

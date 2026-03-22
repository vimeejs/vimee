/**
 * normal-mode-editing.test.ts
 *
 * Tests for editing commands in normal mode.
 * Covers toggle case (~), join lines (J), single character replacement (r),
 * undo (u), dot repeat (.), and status messages.
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

describe("Normal mode — editing", () => {
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
});

/**
 * insert-mode.test.ts
 *
 * Tests for insert mode.
 * Verifies behavior of character input, Backspace, Delete, Enter, Tab, and Escape.
 */

import { describe, it, expect } from "vitest";
import type { VimContext, VimAction, CursorPosition } from "../types";
import { processInsertMode } from "../insert-mode";
import { TextBuffer } from "../buffer";

// =====================
// Helper functions
// =====================

/** Create a VimContext in insert mode for testing */
function createInsertContext(cursor: CursorPosition, overrides?: Partial<VimContext>): VimContext {
  return {
    mode: "insert",
    phase: "idle",
    count: 0,
    operator: null,
    cursor,
    visualAnchor: null,
    register: "",
    registers: {},
    selectedRegister: null,
    commandBuffer: "",
    commandType: null,
    lastSearch: "",
    searchDirection: "forward",
    charCommand: null,
    lastCharSearch: null,
    textObjectModifier: null,
    statusMessage: "-- INSERT --",
    indentStyle: "space",
    indentWidth: 2,
    lastChange: [],
    pendingChange: [],
    blockInsert: null,
    marks: {},
    macroRecording: null,
    macros: {},
    lastMacro: null,
    viewportTopLine: 0,
    viewportHeight: 24,
    ...overrides,
  };
}

/** Process multiple keys in sequence and return the final state */
type KeyInput = string | { key: string; ctrlKey: boolean };

function pressKeys(
  keys: KeyInput[],
  ctx: VimContext,
  buffer: TextBuffer,
): { ctx: VimContext; allActions: VimAction[] } {
  let current = ctx;
  const allActions: VimAction[] = [];
  for (const input of keys) {
    const key = typeof input === "string" ? input : input.key;
    const ctrlKey = typeof input === "string" ? false : input.ctrlKey;
    const result = processInsertMode(key, current, buffer, ctrlKey);
    current = result.newCtx;
    allActions.push(...result.actions);
  }
  return { ctx: current, allActions };
}

// =====================
// Tests
// =====================

describe("Insert mode", () => {
  // ---------------------------------------------------
  // Character input
  // ---------------------------------------------------
  describe("Character input", () => {
    it("inserts a single character", () => {
      const buffer = new TextBuffer("hllo");
      const ctx = createInsertContext({ line: 0, col: 1 });
      const { ctx: result } = pressKeys(["e"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello");
      expect(result.cursor.col).toBe(2);
    });

    it("inserts multiple characters consecutively", () => {
      const buffer = new TextBuffer("");
      const ctx = createInsertContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["h", "e", "l", "l", "o"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello");
      expect(result.cursor.col).toBe(5);
    });

    it("inserts a character in the middle of a line", () => {
      const buffer = new TextBuffer("helo");
      const ctx = createInsertContext({ line: 0, col: 2 });
      const { ctx: result } = pressKeys(["l"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello");
      expect(result.cursor.col).toBe(3);
    });

    it("inserts a character at the end of a line", () => {
      const buffer = new TextBuffer("hell");
      const ctx = createInsertContext({ line: 0, col: 4 });
      const { ctx: result } = pressKeys(["o"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello");
      expect(result.cursor.col).toBe(5);
    });

    it("inserts a character on an empty line", () => {
      const buffer = new TextBuffer("");
      const ctx = createInsertContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["a"], ctx, buffer);
      expect(buffer.getContent()).toBe("a");
      expect(result.cursor.col).toBe(1);
    });

    it("can insert special characters (e.g. spaces)", () => {
      const buffer = new TextBuffer("helloworld");
      const ctx = createInsertContext({ line: 0, col: 5 });
      const { ctx: result } = pressKeys([" "], ctx, buffer);
      expect(buffer.getContent()).toBe("hello world");
      expect(result.cursor.col).toBe(6);
    });
  });

  // ---------------------------------------------------
  // Backspace
  // ---------------------------------------------------
  describe("Backspace", () => {
    it("deletes one character in the middle of a line", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createInsertContext({ line: 0, col: 3 });
      const { ctx: result } = pressKeys(["Backspace"], ctx, buffer);
      expect(buffer.getContent()).toBe("helo");
      expect(result.cursor.col).toBe(2);
    });

    it("joins with the previous line when pressing Backspace at the beginning of a line", () => {
      const buffer = new TextBuffer("hello\nworld");
      const ctx = createInsertContext({ line: 1, col: 0 });
      const { ctx: result } = pressKeys(["Backspace"], ctx, buffer);
      expect(buffer.getContent()).toBe("helloworld");
      expect(result.cursor).toEqual({ line: 0, col: 5 });
    });

    it("does nothing when pressing Backspace at the beginning of the file (line 0, col 0)", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createInsertContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["Backspace"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello");
      expect(result.cursor).toEqual({ line: 0, col: 0 });
    });

    it("deletes multiple characters with consecutive Backspaces", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createInsertContext({ line: 0, col: 5 });
      const { ctx: result } = pressKeys(["Backspace", "Backspace", "Backspace"], ctx, buffer);
      expect(buffer.getContent()).toBe("he");
      expect(result.cursor.col).toBe(2);
    });

    it("joins with the previous line when pressing Backspace at the beginning of an empty line", () => {
      const buffer = new TextBuffer("hello\n");
      const ctx = createInsertContext({ line: 1, col: 0 });
      const { ctx: result } = pressKeys(["Backspace"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello");
      expect(result.cursor).toEqual({ line: 0, col: 5 });
    });
  });

  // ---------------------------------------------------
  // Delete
  // ---------------------------------------------------
  describe("Delete", () => {
    it("deletes one character in the middle of a line", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createInsertContext({ line: 0, col: 2 });
      const { ctx: result } = pressKeys(["Delete"], ctx, buffer);
      expect(buffer.getContent()).toBe("helo");
      expect(result.cursor.col).toBe(2);
    });

    it("joins with the next line when pressing Delete at the end of a line", () => {
      const buffer = new TextBuffer("hello\nworld");
      const ctx = createInsertContext({ line: 0, col: 5 });
      const { ctx: result } = pressKeys(["Delete"], ctx, buffer);
      expect(buffer.getContent()).toBe("helloworld");
      expect(result.cursor).toEqual({ line: 0, col: 5 });
    });

    it("does nothing when pressing Delete at the end of the last line", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createInsertContext({ line: 0, col: 5 });
      const { ctx: result } = pressKeys(["Delete"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello");
      expect(result.cursor.col).toBe(5);
    });

    it("joins with the next line when pressing Delete on an empty line", () => {
      const buffer = new TextBuffer("\nhello");
      const ctx = createInsertContext({ line: 0, col: 0 });
      pressKeys(["Delete"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello");
    });
  });

  // ---------------------------------------------------
  // Enter (line split)
  // ---------------------------------------------------
  describe("Enter (line split)", () => {
    it("splits the line when pressing Enter in the middle of a line", () => {
      const buffer = new TextBuffer("helloworld");
      const ctx = createInsertContext({ line: 0, col: 5 });
      const { ctx: result } = pressKeys(["Enter"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello\nworld");
      expect(result.cursor).toEqual({ line: 1, col: 0 });
    });

    it("inserts an empty line above when pressing Enter at the beginning of a line", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createInsertContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["Enter"], ctx, buffer);
      expect(buffer.getContent()).toBe("\nhello");
      expect(result.cursor).toEqual({ line: 1, col: 0 });
    });

    it("inserts an empty line below when pressing Enter at the end of a line", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createInsertContext({ line: 0, col: 5 });
      const { ctx: result } = pressKeys(["Enter"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello\n");
      expect(result.cursor).toEqual({ line: 1, col: 0 });
    });

    it("inserts multiple lines with consecutive Enters", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createInsertContext({ line: 0, col: 5 });
      const { ctx: result } = pressKeys(["Enter", "Enter"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello\n\n");
      expect(result.cursor).toEqual({ line: 2, col: 0 });
    });

    it("preserves indentation on Enter", () => {
      const buffer = new TextBuffer("  hello");
      const ctx = createInsertContext({ line: 0, col: 7 });
      const { ctx: result } = pressKeys(["Enter"], ctx, buffer);
      expect(buffer.getContent()).toBe("  hello\n  ");
      expect(result.cursor).toEqual({ line: 1, col: 2 });
    });

    it("preserves indentation when splitting in the middle", () => {
      const buffer = new TextBuffer("    foobar");
      const ctx = createInsertContext({ line: 0, col: 7 });
      const { ctx: result } = pressKeys(["Enter"], ctx, buffer);
      expect(buffer.getContent()).toBe("    foo\n    bar");
      expect(result.cursor).toEqual({ line: 1, col: 4 });
    });
  });

  // ---------------------------------------------------
  // Ctrl-W (delete word backward)
  // ---------------------------------------------------
  describe("Ctrl-W (delete word backward)", () => {
    it("deletes the word before the cursor", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createInsertContext({ line: 0, col: 11 });
      const { ctx: result } = pressKeys([{ key: "w", ctrlKey: true }], ctx, buffer);
      expect(buffer.getContent()).toBe("hello ");
      expect(result.cursor).toEqual({ line: 0, col: 6 });
    });

    it("deletes word and trailing whitespace", () => {
      const buffer = new TextBuffer("foo   bar");
      const ctx = createInsertContext({ line: 0, col: 6 });
      const { ctx: result } = pressKeys([{ key: "w", ctrlKey: true }], ctx, buffer);
      expect(buffer.getContent()).toBe("bar");
      expect(result.cursor).toEqual({ line: 0, col: 0 });
    });

    it("does nothing at the beginning of a line", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createInsertContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys([{ key: "w", ctrlKey: true }], ctx, buffer);
      expect(buffer.getContent()).toBe("hello");
      expect(result.cursor).toEqual({ line: 0, col: 0 });
    });

    it("deletes punctuation as a separate word class", () => {
      const buffer = new TextBuffer("foo...bar");
      const ctx = createInsertContext({ line: 0, col: 6 });
      const { ctx: result } = pressKeys([{ key: "w", ctrlKey: true }], ctx, buffer);
      expect(buffer.getContent()).toBe("foobar");
      expect(result.cursor).toEqual({ line: 0, col: 3 });
    });
  });

  // ---------------------------------------------------
  // Tab (indentation)
  // ---------------------------------------------------
  describe("Tab (indentation)", () => {
    it("inserts two spaces with Tab", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createInsertContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["Tab"], ctx, buffer);
      expect(buffer.getContent()).toBe("  hello");
      expect(result.cursor.col).toBe(2);
    });

    it("inserts spaces when pressing Tab in the middle of a line", () => {
      const buffer = new TextBuffer("helloworld");
      const ctx = createInsertContext({ line: 0, col: 5 });
      const { ctx: result } = pressKeys(["Tab"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello  world");
      expect(result.cursor.col).toBe(7);
    });
  });

  // ---------------------------------------------------
  // Escape (return to normal mode)
  // ---------------------------------------------------
  describe("Escape (return to normal mode)", () => {
    it("returns to normal mode with Escape", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createInsertContext({ line: 0, col: 3 });
      const { ctx: result } = pressKeys(["Escape"], ctx, buffer);
      expect(result.mode).toBe("normal");
    });

    it("moves cursor one position left on Escape (Vim behavior)", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createInsertContext({ line: 0, col: 3 });
      const { ctx: result } = pressKeys(["Escape"], ctx, buffer);
      expect(result.cursor.col).toBe(2);
    });

    it("keeps cursor at column 0 when pressing Escape at column 0", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createInsertContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["Escape"], ctx, buffer);
      expect(result.cursor.col).toBe(0);
    });

    it("clears status message after Escape", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createInsertContext({ line: 0, col: 3 });
      const { ctx: result } = pressKeys(["Escape"], ctx, buffer);
      expect(result.statusMessage).toBe("");
    });
  });

  // ---------------------------------------------------
  // Tab with tab indentStyle (covers line 233 "\t" branch)
  // ---------------------------------------------------
  describe("Tab with tab indentStyle", () => {
    it("inserts a tab character when indentStyle is 'tab'", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createInsertContext(
        { line: 0, col: 0 },
        {
          indentStyle: "tab",
          indentWidth: 4,
        },
      );
      const { ctx: result } = pressKeys(["Tab"], ctx, buffer);
      expect(buffer.getContent()).toBe("\thello");
      expect(result.cursor.col).toBe(1);
    });

    it("inserts a tab character in the middle of a line when indentStyle is 'tab'", () => {
      const buffer = new TextBuffer("helloworld");
      const ctx = createInsertContext(
        { line: 0, col: 5 },
        {
          indentStyle: "tab",
          indentWidth: 4,
        },
      );
      const { ctx: result } = pressKeys(["Tab"], ctx, buffer);
      expect(buffer.getContent()).toBe("hello\tworld");
      expect(result.cursor.col).toBe(6);
    });
  });

  // ---------------------------------------------------
  // Ctrl-W with punctuation (covers line 268 branch)
  // ---------------------------------------------------
  describe("Ctrl-W with punctuation characters", () => {
    it("deletes backward through punctuation when cursor is after punctuation", () => {
      // Cursor right after "!!!", should delete the punctuation group
      const buffer = new TextBuffer("hello!!!world");
      const ctx = createInsertContext({ line: 0, col: 8 });
      const { ctx: result } = pressKeys([{ key: "w", ctrlKey: true }], ctx, buffer);
      expect(buffer.getContent()).toBe("helloworld");
      expect(result.cursor).toEqual({ line: 0, col: 5 });
    });

    it("deletes backward through mixed punctuation", () => {
      const buffer = new TextBuffer("foo@#$bar");
      const ctx = createInsertContext({ line: 0, col: 6 });
      const { ctx: result } = pressKeys([{ key: "w", ctrlKey: true }], ctx, buffer);
      expect(buffer.getContent()).toBe("foobar");
      expect(result.cursor).toEqual({ line: 0, col: 3 });
    });
  });

  // ---------------------------------------------------
  // Enter on empty line (covers line 291 getLineIndent match branch)
  // ---------------------------------------------------
  describe("Enter on empty line (getLineIndent empty match)", () => {
    it("pressing Enter on an empty line produces no indentation", () => {
      const buffer = new TextBuffer("");
      const ctx = createInsertContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["Enter"], ctx, buffer);
      expect(buffer.getContent()).toBe("\n");
      expect(result.cursor).toEqual({ line: 1, col: 0 });
    });
  });

  // ---------------------------------------------------
  // Ctrl key (ignored in insert mode)
  // ---------------------------------------------------
  describe("Ctrl key (ignored in insert mode)", () => {
    it("Ctrl+key is ignored", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createInsertContext({ line: 0, col: 2 });
      const result = processInsertMode("a", ctx, buffer, true);
      expect(buffer.getContent()).toBe("hello");
      expect(result.newCtx.cursor.col).toBe(2);
    });
  });

  // ---------------------------------------------------
  // Other special keys
  // ---------------------------------------------------
  describe("Other special keys", () => {
    it("special keys like arrow keys are ignored", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createInsertContext({ line: 0, col: 2 });
      const { ctx: result } = pressKeys(["ArrowLeft"], ctx, buffer);
      // ArrowLeft is ignored because its length > 1
      expect(buffer.getContent()).toBe("hello");
      expect(result.cursor.col).toBe(2);
    });
  });
});

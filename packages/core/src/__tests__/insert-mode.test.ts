/**
 * insert-mode.test.ts
 *
 * Tests for insert mode.
 * Verifies behavior of character input, Backspace, Delete, Enter, Tab, and Escape.
 */

import { describe, it, expect } from "vitest";
import { vim } from "@vimee/testkit";
import { processInsertMode } from "../insert-mode";
import { TextBuffer } from "../buffer";
import type { VimContext, CursorPosition } from "../types";

// Helper kept for tests that directly call processInsertMode
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

// =====================
// Tests
// =====================

describe("Insert mode", () => {
  // ---------------------------------------------------
  // Character input
  // ---------------------------------------------------
  describe("Character input", () => {
    it("inserts a single character", () => {
      const v = vim("hllo", { mode: "insert", cursor: [0, 1] });
      v.type("e");
      expect(v.content()).toBe("hello");
      expect(v.cursor().col).toBe(2);
    });

    it("inserts multiple characters consecutively", () => {
      const v = vim("", { mode: "insert", cursor: [0, 0] });
      v.type("hello");
      expect(v.content()).toBe("hello");
      expect(v.cursor().col).toBe(5);
    });

    it("inserts a character in the middle of a line", () => {
      const v = vim("helo", { mode: "insert", cursor: [0, 2] });
      v.type("l");
      expect(v.content()).toBe("hello");
      expect(v.cursor().col).toBe(3);
    });

    it("inserts a character at the end of a line", () => {
      const v = vim("hell", { mode: "insert", cursor: [0, 4] });
      v.type("o");
      expect(v.content()).toBe("hello");
      expect(v.cursor().col).toBe(5);
    });

    it("inserts a character on an empty line", () => {
      const v = vim("", { mode: "insert", cursor: [0, 0] });
      v.type("a");
      expect(v.content()).toBe("a");
      expect(v.cursor().col).toBe(1);
    });

    it("can insert special characters (e.g. spaces)", () => {
      const v = vim("helloworld", { mode: "insert", cursor: [0, 5] });
      v.type("<Space>");
      expect(v.content()).toBe("hello world");
      expect(v.cursor().col).toBe(6);
    });
  });

  // ---------------------------------------------------
  // Backspace
  // ---------------------------------------------------
  describe("Backspace", () => {
    it("deletes one character in the middle of a line", () => {
      const v = vim("hello", { mode: "insert", cursor: [0, 3] });
      v.type("<BS>");
      expect(v.content()).toBe("helo");
      expect(v.cursor().col).toBe(2);
    });

    it("joins with the previous line when pressing Backspace at the beginning of a line", () => {
      const v = vim("hello\nworld", { mode: "insert", cursor: [1, 0] });
      v.type("<BS>");
      expect(v.content()).toBe("helloworld");
      expect(v.cursor()).toEqual({ line: 0, col: 5 });
    });

    it("does nothing when pressing Backspace at the beginning of the file (line 0, col 0)", () => {
      const v = vim("hello", { mode: "insert", cursor: [0, 0] });
      v.type("<BS>");
      expect(v.content()).toBe("hello");
      expect(v.cursor()).toEqual({ line: 0, col: 0 });
    });

    it("deletes multiple characters with consecutive Backspaces", () => {
      const v = vim("hello", { mode: "insert", cursor: [0, 5] });
      v.type("<BS><BS><BS>");
      expect(v.content()).toBe("he");
      expect(v.cursor().col).toBe(2);
    });

    it("joins with the previous line when pressing Backspace at the beginning of an empty line", () => {
      const v = vim("hello\n", { mode: "insert", cursor: [1, 0] });
      v.type("<BS>");
      expect(v.content()).toBe("hello");
      expect(v.cursor()).toEqual({ line: 0, col: 5 });
    });
  });

  // ---------------------------------------------------
  // Delete
  // ---------------------------------------------------
  describe("Delete", () => {
    it("deletes one character in the middle of a line", () => {
      const v = vim("hello", { mode: "insert", cursor: [0, 2] });
      v.type("<Del>");
      expect(v.content()).toBe("helo");
      expect(v.cursor().col).toBe(2);
    });

    it("joins with the next line when pressing Delete at the end of a line", () => {
      const v = vim("hello\nworld", { mode: "insert", cursor: [0, 5] });
      v.type("<Del>");
      expect(v.content()).toBe("helloworld");
      expect(v.cursor()).toEqual({ line: 0, col: 5 });
    });

    it("does nothing when pressing Delete at the end of the last line", () => {
      const v = vim("hello", { mode: "insert", cursor: [0, 5] });
      v.type("<Del>");
      expect(v.content()).toBe("hello");
      expect(v.cursor().col).toBe(5);
    });

    it("joins with the next line when pressing Delete on an empty line", () => {
      const v = vim("\nhello", { mode: "insert", cursor: [0, 0] });
      v.type("<Del>");
      expect(v.content()).toBe("hello");
    });
  });

  // ---------------------------------------------------
  // Enter (line split)
  // ---------------------------------------------------
  describe("Enter (line split)", () => {
    it("splits the line when pressing Enter in the middle of a line", () => {
      const v = vim("helloworld", { mode: "insert", cursor: [0, 5] });
      v.type("<Enter>");
      expect(v.content()).toBe("hello\nworld");
      expect(v.cursor()).toEqual({ line: 1, col: 0 });
    });

    it("inserts an empty line above when pressing Enter at the beginning of a line", () => {
      const v = vim("hello", { mode: "insert", cursor: [0, 0] });
      v.type("<Enter>");
      expect(v.content()).toBe("\nhello");
      expect(v.cursor()).toEqual({ line: 1, col: 0 });
    });

    it("inserts an empty line below when pressing Enter at the end of a line", () => {
      const v = vim("hello", { mode: "insert", cursor: [0, 5] });
      v.type("<Enter>");
      expect(v.content()).toBe("hello\n");
      expect(v.cursor()).toEqual({ line: 1, col: 0 });
    });

    it("inserts multiple lines with consecutive Enters", () => {
      const v = vim("hello", { mode: "insert", cursor: [0, 5] });
      v.type("<Enter><Enter>");
      expect(v.content()).toBe("hello\n\n");
      expect(v.cursor()).toEqual({ line: 2, col: 0 });
    });

    it("preserves indentation on Enter", () => {
      const v = vim("  hello", { mode: "insert", cursor: [0, 7] });
      v.type("<Enter>");
      expect(v.content()).toBe("  hello\n  ");
      expect(v.cursor()).toEqual({ line: 1, col: 2 });
    });

    it("preserves indentation when splitting in the middle", () => {
      const v = vim("    foobar", { mode: "insert", cursor: [0, 7] });
      v.type("<Enter>");
      expect(v.content()).toBe("    foo\n    bar");
      expect(v.cursor()).toEqual({ line: 1, col: 4 });
    });
  });

  // ---------------------------------------------------
  // Ctrl-W (delete word backward)
  // ---------------------------------------------------
  describe("Ctrl-W (delete word backward)", () => {
    it("deletes the word before the cursor", () => {
      const v = vim("hello world", { mode: "insert", cursor: [0, 11] });
      v.type("<C-w>");
      expect(v.content()).toBe("hello ");
      expect(v.cursor()).toEqual({ line: 0, col: 6 });
    });

    it("deletes word and trailing whitespace", () => {
      const v = vim("foo   bar", { mode: "insert", cursor: [0, 6] });
      v.type("<C-w>");
      expect(v.content()).toBe("bar");
      expect(v.cursor()).toEqual({ line: 0, col: 0 });
    });

    it("does nothing at the beginning of a line", () => {
      const v = vim("hello", { mode: "insert", cursor: [0, 0] });
      v.type("<C-w>");
      expect(v.content()).toBe("hello");
      expect(v.cursor()).toEqual({ line: 0, col: 0 });
    });

    it("deletes punctuation as a separate word class", () => {
      const v = vim("foo...bar", { mode: "insert", cursor: [0, 6] });
      v.type("<C-w>");
      expect(v.content()).toBe("foobar");
      expect(v.cursor()).toEqual({ line: 0, col: 3 });
    });
  });

  // ---------------------------------------------------
  // Tab (indentation)
  // ---------------------------------------------------
  describe("Tab (indentation)", () => {
    it("inserts two spaces with Tab", () => {
      const v = vim("hello", { mode: "insert", cursor: [0, 0] });
      v.type("<Tab>");
      expect(v.content()).toBe("  hello");
      expect(v.cursor().col).toBe(2);
    });

    it("inserts spaces when pressing Tab in the middle of a line", () => {
      const v = vim("helloworld", { mode: "insert", cursor: [0, 5] });
      v.type("<Tab>");
      expect(v.content()).toBe("hello  world");
      expect(v.cursor().col).toBe(7);
    });
  });

  // ---------------------------------------------------
  // Escape (return to normal mode)
  // ---------------------------------------------------
  describe("Escape (return to normal mode)", () => {
    it("returns to normal mode with Escape", () => {
      const v = vim("hello", { mode: "insert", cursor: [0, 3] });
      v.type("<Esc>");
      expect(v.mode()).toBe("normal");
    });

    it("moves cursor one position left on Escape (Vim behavior)", () => {
      const v = vim("hello", { mode: "insert", cursor: [0, 3] });
      v.type("<Esc>");
      expect(v.cursor().col).toBe(2);
    });

    it("keeps cursor at column 0 when pressing Escape at column 0", () => {
      const v = vim("hello", { mode: "insert", cursor: [0, 0] });
      v.type("<Esc>");
      expect(v.cursor().col).toBe(0);
    });

    it("clears status message after Escape", () => {
      const v = vim("hello", { mode: "insert", cursor: [0, 3] });
      v.type("<Esc>");
      expect(v.statusMessage()).toBe("");
    });
  });

  // ---------------------------------------------------
  // Tab with tab indentStyle (covers line 233 "\t" branch)
  // ---------------------------------------------------
  describe("Tab with tab indentStyle", () => {
    it("inserts a tab character when indentStyle is 'tab'", () => {
      const v = vim("hello", {
        mode: "insert",
        cursor: [0, 0],
        indentStyle: "tab",
        indentWidth: 4,
      });
      v.type("<Tab>");
      expect(v.content()).toBe("\thello");
      expect(v.cursor().col).toBe(1);
    });

    it("inserts a tab character in the middle of a line when indentStyle is 'tab'", () => {
      const v = vim("helloworld", {
        mode: "insert",
        cursor: [0, 5],
        indentStyle: "tab",
        indentWidth: 4,
      });
      v.type("<Tab>");
      expect(v.content()).toBe("hello\tworld");
      expect(v.cursor().col).toBe(6);
    });
  });

  // ---------------------------------------------------
  // Ctrl-W with punctuation (covers line 268 branch)
  // ---------------------------------------------------
  describe("Ctrl-W with punctuation characters", () => {
    it("deletes backward through punctuation when cursor is after punctuation", () => {
      // Cursor right after "!!!", should delete the punctuation group
      const v = vim("hello!!!world", { mode: "insert", cursor: [0, 8] });
      v.type("<C-w>");
      expect(v.content()).toBe("helloworld");
      expect(v.cursor()).toEqual({ line: 0, col: 5 });
    });

    it("deletes backward through mixed punctuation", () => {
      const v = vim("foo@#$bar", { mode: "insert", cursor: [0, 6] });
      v.type("<C-w>");
      expect(v.content()).toBe("foobar");
      expect(v.cursor()).toEqual({ line: 0, col: 3 });
    });
  });

  // ---------------------------------------------------
  // Enter on empty line (covers line 291 getLineIndent match branch)
  // ---------------------------------------------------
  describe("Enter on empty line (getLineIndent empty match)", () => {
    it("pressing Enter on an empty line produces no indentation", () => {
      const v = vim("", { mode: "insert", cursor: [0, 0] });
      v.type("<Enter>");
      expect(v.content()).toBe("\n");
      expect(v.cursor()).toEqual({ line: 1, col: 0 });
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
      const key = "ArrowLeft";
      const result = processInsertMode(key, ctx, buffer, false);
      // ArrowLeft is ignored because its length > 1
      expect(buffer.getContent()).toBe("hello");
      expect(result.newCtx.cursor.col).toBe(2);
    });
  });
});

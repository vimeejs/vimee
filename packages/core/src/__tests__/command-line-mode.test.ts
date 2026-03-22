/**
 * command-line-mode.test.ts
 *
 * Integration tests for command-line mode.
 * Verifies : commands, / forward search, ? backward search, Backspace, and Escape.
 */

import { describe, it, expect } from "vitest";
import type { VimContext } from "../types";
import { createInitialContext } from "../vim-state";
import { processCommandLineMode } from "../command-line-mode";
import { TextBuffer } from "../buffer";
import { vim } from "@vimee/testkit";

// =====================
// Tests
// =====================

describe("Command-line mode", () => {
  // ---------------------------------------------------
  // :w (save)
  // ---------------------------------------------------
  describe(":w command (save)", () => {
    it("issues a save action with :w", () => {
      const v = vim("hello world");
      v.type(":w<Enter>");
      expect(v.mode()).toBe("normal");
      expect(v.allActions()).toContainEqual({
        type: "save",
        content: "hello world",
      });
    });

    it("clears the command buffer after :w", () => {
      const v = vim("hello");
      v.type(":w<Enter>");
      const { ctx } = v.raw();
      expect(ctx.commandBuffer).toBe("");
      expect(ctx.commandType).toBeNull();
    });
  });

  // ---------------------------------------------------
  // /pattern (forward search)
  // ---------------------------------------------------
  describe("/pattern (forward search)", () => {
    it("searches forward for 'foo' and moves the cursor to the match position with /foo", () => {
      const v = vim("hello foo world");
      v.type("/foo<Enter>");
      expect(v.mode()).toBe("normal");
      expect(v.cursor()).toEqual({ line: 0, col: 6 });
      expect(v.raw().ctx.lastSearch).toBe("foo");
    });

    it("displays a status message when there is no match", () => {
      const v = vim("hello world");
      v.type("/xyz<Enter>");
      expect(v.mode()).toBe("normal");
      expect(v.statusMessage()).toBe("Pattern not found: xyz");
      expect(v.raw().ctx.lastSearch).toBe("xyz");
      expect(v.allActions()).toContainEqual({
        type: "status-message",
        message: "Pattern not found: xyz",
      });
    });

    it("just exits command-line mode when pressing Enter with an empty pattern", () => {
      const v = vim("hello");
      v.type("/<Enter>");
      expect(v.mode()).toBe("normal");
    });
  });

  // ---------------------------------------------------
  // ?pattern (backward search)
  // ---------------------------------------------------
  describe("?pattern (backward search)", () => {
    it("searches backward for 'foo' with ?foo", () => {
      const v = vim("foo hello foo", { cursor: [0, 10] });
      v.type("?foo<Enter>");
      expect(v.mode()).toBe("normal");
      expect(v.cursor()).toEqual({ line: 0, col: 0 });
      expect(v.raw().ctx.searchDirection).toBe("backward");
    });

    it("displays a message when backward search finds no match", () => {
      const v = vim("hello world", { cursor: [0, 5] });
      v.type("?zzz<Enter>");
      expect(v.statusMessage()).toBe("Pattern not found: zzz");
    });
  });

  // ---------------------------------------------------
  // Backspace (command buffer editing)
  // ---------------------------------------------------
  describe("Backspace (command buffer editing)", () => {
    it("deletes the last character from the command buffer with Backspace", () => {
      const v = vim("hello");
      v.type(":wq<BS>");
      const { ctx } = v.raw();
      expect(ctx.commandBuffer).toBe("w");
      expect(ctx.statusMessage).toBe(":w");
    });

    it("exits command-line mode when pressing Backspace with an empty command buffer", () => {
      const v = vim("hello");
      v.type(":<BS>");
      const { ctx } = v.raw();
      expect(ctx.mode).toBe("normal");
      expect(ctx.commandType).toBeNull();
    });
  });

  // ---------------------------------------------------
  // Escape (exit command-line mode)
  // ---------------------------------------------------
  describe("Escape (exit command-line mode)", () => {
    it("exits command-line mode and returns to normal mode with Escape", () => {
      const v = vim("hello");
      v.type(":some<Esc>");
      expect(v.mode()).toBe("normal");
      const { ctx } = v.raw();
      expect(ctx.commandBuffer).toBe("");
      expect(ctx.commandType).toBeNull();
    });

    it("can exit search mode with Escape as well", () => {
      const v = vim("hello");
      v.type("/pattern<Esc>");
      expect(v.mode()).toBe("normal");
    });
  });

  // ---------------------------------------------------
  // :{number} (line jump)
  // ---------------------------------------------------
  describe(":{number} (line jump)", () => {
    it("jumps to line 3 (0-based line 2) with :3", () => {
      const v = vim("line1\nline2\nline3\nline4");
      v.type(":3<Enter>");
      expect(v.mode()).toBe("normal");
      expect(v.cursor()).toEqual({ line: 2, col: 0 });
      expect(v.allActions()).toContainEqual({
        type: "cursor-move",
        position: { line: 2, col: 0 },
      });
    });

    it("jumps to line 1 with :1", () => {
      const v = vim("line1\nline2\nline3", { cursor: [2, 3] });
      v.type(":1<Enter>");
      expect(v.cursor()).toEqual({ line: 0, col: 0 });
    });

    it("clamps when the number exceeds the buffer line count", () => {
      const v = vim("line1\nline2\nline3");
      v.type(":999<Enter>");
      expect(v.cursor().line).toBe(2); // last line
    });

    it("clamps :0 to line 1", () => {
      const v = vim("line1\nline2", { cursor: [1, 0] });
      v.type(":0<Enter>");
      expect(v.cursor().line).toBe(0);
    });
  });

  // ---------------------------------------------------
  // Character input
  // ---------------------------------------------------
  describe("Character input", () => {
    it("appends characters to the command buffer", () => {
      const v = vim("hello");
      v.type(":help");
      const { ctx } = v.raw();
      expect(ctx.commandBuffer).toBe("help");
      expect(ctx.statusMessage).toBe(":help");
    });

    it("ignores special keys (long key names)", () => {
      const v = vim("hello");
      v.type(":test");
      v.type("<Left>");
      const { ctx } = v.raw();
      expect(ctx.commandBuffer).toBe("test");
    });
  });

  // ---------------------------------------------------
  // :set number / :set nonumber
  // ---------------------------------------------------
  describe(":set number / :set nonumber", () => {
    it("emits set-option number=true with :set number", () => {
      const v = vim("hello");
      v.type(":set number<Enter>");
      expect(v.mode()).toBe("normal");
      expect(v.allActions()).toContainEqual({
        type: "set-option",
        option: "number",
        value: true,
      });
    });

    it("emits set-option number=false with :set nonumber", () => {
      const v = vim("hello");
      v.type(":set nonumber<Enter>");
      expect(v.mode()).toBe("normal");
      expect(v.allActions()).toContainEqual({
        type: "set-option",
        option: "number",
        value: false,
      });
    });

    it("emits set-option with short form :set nu / :set nonu", () => {
      const v1 = vim("hello");
      v1.type(":set nu<Enter>");
      expect(v1.allActions()).toContainEqual({ type: "set-option", option: "number", value: true });

      const v2 = vim("hello");
      v2.type(":set nonu<Enter>");
      expect(v2.allActions()).toContainEqual({
        type: "set-option",
        option: "number",
        value: false,
      });
    });
  });

  // ---------------------------------------------------
  // Unknown command (E492)
  // ---------------------------------------------------
  describe("Unknown command (E492)", () => {
    it("shows E492 error for unknown command", () => {
      const v = vim("hello");
      v.type(":aaa<Enter>");
      expect(v.mode()).toBe("normal");
      expect(v.statusMessage()).toBe("E492: Not an editor command: aaa");
      expect(v.raw().ctx.statusError).toBe(true);
      expect(v.allActions()).toContainEqual({
        type: "status-message",
        message: "E492: Not an editor command: aaa",
      });
    });

    it("clears error status on next command-line entry", () => {
      const v = vim("hello");
      v.type(":aaa<Enter>");
      // Now enter command-line mode again and escape
      v.type(":<Esc>");
      expect(v.raw().ctx.statusError).toBe(false);
      expect(v.statusMessage()).toBe("");
    });
  });

  // ---------------------------------------------------
  // Integration test: search from normal mode and return
  // ---------------------------------------------------
  describe("Integration tests", () => {
    it("searches by typing /hello from normal mode end-to-end", () => {
      const v = vim("foo\nbar\nhello\nworld");
      v.type("/hello<Enter>");
      expect(v.mode()).toBe("normal");
      expect(v.cursor()).toEqual({ line: 2, col: 0 });
      expect(v.raw().ctx.lastSearch).toBe("hello");
    });

    it("jumps to line 5 by typing :5 from normal mode", () => {
      const lines = Array.from({ length: 10 }, (_, i) => `line${i + 1}`).join("\n");
      const v = vim(lines);
      v.type(":5<Enter>");
      expect(v.mode()).toBe("normal");
      expect(v.cursor()).toEqual({ line: 4, col: 0 });
    });
  });

  // ---------------------------------------------------
  // :s substitute
  // ---------------------------------------------------
  describe(":s substitute", () => {
    it(":s/old/new/ replaces first match on current line", () => {
      const v = vim("foo bar foo");
      v.type(":s/foo/baz/<Enter>");
      expect(v.content()).toBe("baz bar foo");
      expect(v.mode()).toBe("normal");
      expect(v.statusMessage()).toContain("1 substitution");
    });

    it(":s/old/new/g replaces all matches on current line", () => {
      const v = vim("foo bar foo baz foo");
      v.type(":s/foo/x/g<Enter>");
      expect(v.content()).toBe("x bar x baz x");
    });

    it(":%s/old/new/g replaces all matches in entire file", () => {
      const v = vim("foo\nbar\nfoo\nbaz");
      v.type(":%s/foo/replaced/g<Enter>");
      expect(v.content()).toBe("replaced\nbar\nreplaced\nbaz");
      expect(v.statusMessage()).toContain("2 substitutions on 2 lines");
    });

    it(":1,3s/x/y/g replaces in line range", () => {
      const v = vim("x\nx\nx\nx");
      v.type(":1,3s/x/y/g<Enter>");
      expect(v.content()).toBe("y\ny\ny\nx");
    });

    it(":.,$s/a/b/g replaces from current line to end", () => {
      const v = vim("aaa\naaa\naaa\naaa", { cursor: [1, 0] });
      v.type(":.,");
      v.type("$");
      v.type("s/a/b/g<Enter>");
      expect(v.content()).toBe("aaa\nbbb\nbbb\nbbb");
    });

    it(":s with no match shows error", () => {
      const v = vim("hello world");
      v.type(":s/xyz/abc/<Enter>");
      expect(v.content()).toBe("hello world");
      expect(v.statusMessage()).toContain("Pattern not found");
    });

    it(":s can be undone", () => {
      const v = vim("foo bar");
      v.type(":s/foo/baz/<Enter>");
      expect(v.content()).toBe("baz bar");
      v.type("u");
      expect(v.content()).toBe("foo bar");
    });

    it(":s/old/new/i does case-insensitive match", () => {
      const v = vim("Hello hello HELLO");
      v.type(":s/hello/x/gi<Enter>");
      expect(v.content()).toBe("x x x");
    });

    it(":%s with alternate delimiter works", () => {
      const v = vim("/usr/bin/sh");
      v.type(":%s#/usr/bin#/usr/local/bin#g<Enter>");
      expect(v.content()).toBe("/usr/local/bin/sh");
    });

    it(":s/old/new works without trailing delimiter", () => {
      const v = vim("foo bar foo");
      v.type(":s/foo/baz<Enter>");
      expect(v.content()).toBe("baz bar foo");
    });

    it(":%s/old/new works without trailing delimiter", () => {
      const v = vim("foo\nfoo");
      v.type(":%s/foo/bar<Enter>");
      expect(v.content()).toBe("bar\nbar");
    });

    it(":s with invalid regex pattern shows error", () => {
      const v = vim("hello world");
      v.type(":s/[invalid/replacement/<Enter>");
      expect(v.content()).toBe("hello world");
      expect(v.mode()).toBe("normal");
      expect(v.statusMessage()).toContain("Invalid pattern");
    });
  });

  // ---------------------------------------------------
  // executeCommand with null commandType (defensive)
  // ---------------------------------------------------
  describe("executeCommand with null commandType", () => {
    it("exits command-line mode when commandType is null and Enter is pressed", () => {
      const buffer = new TextBuffer("hello");
      // Manually construct a context where mode is "command-line" but commandType is null
      const ctx: VimContext = {
        ...createInitialContext({ line: 0, col: 0 }),
        mode: "command-line",
        commandType: null,
        commandBuffer: "test",
      };
      const result = processCommandLineMode("Enter", ctx, buffer);
      expect(result.newCtx.mode).toBe("normal");
      expect(result.newCtx.commandBuffer).toBe("");
      expect(result.newCtx.commandType).toBeNull();
    });
  });

  // ---------------------------------------------------
  // Branch coverage: line 265 branch 1
  // :substitute with only a start range (rangeEnd is undefined) → endLine = startLine
  // ---------------------------------------------------
  describe("Substitute with single line range", () => {
    it(":2s/foo/bar/ substitutes only on line 2 (rangeEnd undefined → endLine = startLine)", () => {
      const buffer = new TextBuffer("foo\nfoo\nfoo");
      const ctx: VimContext = {
        ...createInitialContext({ line: 0, col: 0 }),
        mode: "command-line",
        commandType: ":",
        commandBuffer: "",
        statusMessage: ":",
      };
      // Type "2s/foo/bar/" and press Enter
      const keys = [..."2s/foo/bar/", "Enter"];
      let current: VimContext = ctx;
      for (const key of keys) {
        const result = processCommandLineMode(key, current, buffer);
        current = result.newCtx;
      }
      // Only line 2 (index 1) should be changed
      expect(buffer.getLine(0)).toBe("foo");
      expect(buffer.getLine(1)).toBe("bar");
      expect(buffer.getLine(2)).toBe("foo");
    });
  });

  // ---------------------------------------------------
  // Branch coverage: line 309 branch 1
  // :s with /g flag where individual match count returns null from .match()
  // This is hard to trigger directly since replaced !== original implies a match exists.
  // We cover the normal global replacement path which exercises the matches branch.
  // ---------------------------------------------------
  describe("Substitute with global flag exercises match counting", () => {
    it(":%s/o/0/g replaces all occurrences globally", () => {
      const buffer = new TextBuffer("foo boo");
      const ctx: VimContext = {
        ...createInitialContext({ line: 0, col: 0 }),
        mode: "command-line",
        commandType: ":",
        commandBuffer: "",
        statusMessage: ":",
      };
      const keys = [..."%s/o/0/g", "Enter"];
      let current: VimContext = ctx;
      for (const key of keys) {
        const result = processCommandLineMode(key, current, buffer);
        current = result.newCtx;
      }
      expect(buffer.getLine(0)).toBe("f00 b00");
      expect(current.statusMessage).toContain("4");
    });
  });

  // ---------------------------------------------------
  // Branch coverage: lines 364 branch 1, 379 branch 1
  // handleBackspace and appendChar when commandType is null → (ctx.commandType ?? "") uses fallback
  // ---------------------------------------------------
  describe("Backspace and append with null commandType", () => {
    it("Backspace with null commandType uses empty prefix in statusMessage", () => {
      const buffer = new TextBuffer("hello");
      const ctx: VimContext = {
        ...createInitialContext({ line: 0, col: 0 }),
        mode: "command-line",
        commandType: null,
        commandBuffer: "abc",
      };
      const result = processCommandLineMode("Backspace", ctx, buffer);
      // commandType is null → statusMessage = "" + "ab" = "ab"
      expect(result.newCtx.commandBuffer).toBe("ab");
      expect(result.newCtx.statusMessage).toBe("ab");
    });

    it("appendChar with null commandType uses empty prefix in statusMessage", () => {
      const buffer = new TextBuffer("hello");
      const ctx: VimContext = {
        ...createInitialContext({ line: 0, col: 0 }),
        mode: "command-line",
        commandType: null,
        commandBuffer: "ab",
      };
      const result = processCommandLineMode("c", ctx, buffer);
      // commandType is null → statusMessage = "" + "abc" = "abc"
      expect(result.newCtx.commandBuffer).toBe("abc");
      expect(result.newCtx.statusMessage).toBe("abc");
    });
  });
});

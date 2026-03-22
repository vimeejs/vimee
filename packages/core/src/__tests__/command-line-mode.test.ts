/**
 * command-line-mode.test.ts
 *
 * Integration tests for command-line mode.
 * Verifies : commands, / forward search, ? backward search, Backspace, and Escape.
 */

import { describe, it, expect } from "vitest";
import type { VimContext, CursorPosition } from "../types";
import { processKeystroke, createInitialContext } from "../vim-state";
import { processCommandLineMode } from "../command-line-mode";
import { TextBuffer } from "../buffer";

// =====================
// Helper functions
// =====================

/** Create a VimContext in command-line mode for testing */
function createCommandLineContext(
  cursor: CursorPosition,
  commandType: ":" | "/" | "?",
  overrides?: Partial<VimContext>,
): VimContext {
  return {
    ...createInitialContext(cursor),
    mode: "command-line",
    commandType,
    commandBuffer: "",
    statusMessage: commandType,
    ...(commandType === "/" ? { searchDirection: "forward" as const } : {}),
    ...(commandType === "?" ? { searchDirection: "backward" as const } : {}),
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

describe("Command-line mode", () => {
  // ---------------------------------------------------
  // :w (save)
  // ---------------------------------------------------
  describe(":w command (save)", () => {
    it("issues a save action with :w", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createCommandLineContext({ line: 0, col: 0 }, ":");
      const { ctx: result, allActions } = pressKeys(
        ["w", "Enter"],
        ctx,
        buffer,
      );
      expect(result.mode).toBe("normal");
      expect(allActions).toContainEqual({
        type: "save",
        content: "hello world",
      });
    });

    it("clears the command buffer after :w", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createCommandLineContext({ line: 0, col: 0 }, ":");
      const { ctx: result } = pressKeys(["w", "Enter"], ctx, buffer);
      expect(result.commandBuffer).toBe("");
      expect(result.commandType).toBeNull();
    });
  });

  // ---------------------------------------------------
  // /pattern (forward search)
  // ---------------------------------------------------
  describe("/pattern (forward search)", () => {
    it("searches forward for 'foo' and moves the cursor to the match position with /foo", () => {
      const buffer = new TextBuffer("hello foo world");
      const ctx = createCommandLineContext({ line: 0, col: 0 }, "/");
      const { ctx: result } = pressKeys(
        ["f", "o", "o", "Enter"],
        ctx,
        buffer,
      );
      expect(result.mode).toBe("normal");
      expect(result.cursor).toEqual({ line: 0, col: 6 });
      expect(result.lastSearch).toBe("foo");
    });

    it("displays a status message when there is no match", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createCommandLineContext({ line: 0, col: 0 }, "/");
      const { ctx: result, allActions } = pressKeys(
        ["x", "y", "z", "Enter"],
        ctx,
        buffer,
      );
      expect(result.mode).toBe("normal");
      expect(result.statusMessage).toBe("Pattern not found: xyz");
      expect(result.lastSearch).toBe("xyz");
      expect(allActions).toContainEqual({
        type: "status-message",
        message: "Pattern not found: xyz",
      });
    });

    it("just exits command-line mode when pressing Enter with an empty pattern", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createCommandLineContext({ line: 0, col: 0 }, "/");
      const { ctx: result } = pressKeys(["Enter"], ctx, buffer);
      expect(result.mode).toBe("normal");
    });
  });

  // ---------------------------------------------------
  // ?pattern (backward search)
  // ---------------------------------------------------
  describe("?pattern (backward search)", () => {
    it("searches backward for 'foo' with ?foo", () => {
      const buffer = new TextBuffer("foo hello foo");
      const ctx = createCommandLineContext({ line: 0, col: 10 }, "?");
      const { ctx: result } = pressKeys(
        ["f", "o", "o", "Enter"],
        ctx,
        buffer,
      );
      expect(result.mode).toBe("normal");
      expect(result.cursor).toEqual({ line: 0, col: 0 });
      expect(result.searchDirection).toBe("backward");
    });

    it("displays a message when backward search finds no match", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createCommandLineContext({ line: 0, col: 5 }, "?");
      const { ctx: result } = pressKeys(
        ["z", "z", "z", "Enter"],
        ctx,
        buffer,
      );
      expect(result.statusMessage).toBe("Pattern not found: zzz");
    });
  });

  // ---------------------------------------------------
  // Backspace (command buffer editing)
  // ---------------------------------------------------
  describe("Backspace (command buffer editing)", () => {
    it("deletes the last character from the command buffer with Backspace", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createCommandLineContext({ line: 0, col: 0 }, ":", {
        commandBuffer: "wq",
        statusMessage: ":wq",
      });
      const { ctx: result } = pressKeys(["Backspace"], ctx, buffer);
      expect(result.commandBuffer).toBe("w");
      expect(result.statusMessage).toBe(":w");
    });

    it("exits command-line mode when pressing Backspace with an empty command buffer", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createCommandLineContext({ line: 0, col: 0 }, ":", {
        commandBuffer: "",
      });
      const { ctx: result } = pressKeys(["Backspace"], ctx, buffer);
      expect(result.mode).toBe("normal");
      expect(result.commandType).toBeNull();
    });
  });

  // ---------------------------------------------------
  // Escape (exit command-line mode)
  // ---------------------------------------------------
  describe("Escape (exit command-line mode)", () => {
    it("exits command-line mode and returns to normal mode with Escape", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createCommandLineContext({ line: 0, col: 0 }, ":", {
        commandBuffer: "some",
      });
      const { ctx: result } = pressKeys(["Escape"], ctx, buffer);
      expect(result.mode).toBe("normal");
      expect(result.commandBuffer).toBe("");
      expect(result.commandType).toBeNull();
    });

    it("can exit search mode with Escape as well", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createCommandLineContext({ line: 0, col: 0 }, "/", {
        commandBuffer: "pattern",
      });
      const { ctx: result } = pressKeys(["Escape"], ctx, buffer);
      expect(result.mode).toBe("normal");
    });
  });

  // ---------------------------------------------------
  // :{number} (line jump)
  // ---------------------------------------------------
  describe(":{number} (line jump)", () => {
    it("jumps to line 3 (0-based line 2) with :3", () => {
      const buffer = new TextBuffer("line1\nline2\nline3\nline4");
      const ctx = createCommandLineContext({ line: 0, col: 0 }, ":");
      const { ctx: result, allActions } = pressKeys(
        ["3", "Enter"],
        ctx,
        buffer,
      );
      expect(result.mode).toBe("normal");
      expect(result.cursor).toEqual({ line: 2, col: 0 });
      expect(allActions).toContainEqual({
        type: "cursor-move",
        position: { line: 2, col: 0 },
      });
    });

    it("jumps to line 1 with :1", () => {
      const buffer = new TextBuffer("line1\nline2\nline3");
      const ctx = createCommandLineContext({ line: 2, col: 3 }, ":");
      const { ctx: result } = pressKeys(["1", "Enter"], ctx, buffer);
      expect(result.cursor).toEqual({ line: 0, col: 0 });
    });

    it("clamps when the number exceeds the buffer line count", () => {
      const buffer = new TextBuffer("line1\nline2\nline3");
      const ctx = createCommandLineContext({ line: 0, col: 0 }, ":");
      const { ctx: result } = pressKeys(
        ["9", "9", "9", "Enter"],
        ctx,
        buffer,
      );
      expect(result.cursor.line).toBe(2); // last line
    });

    it("clamps :0 to line 1", () => {
      const buffer = new TextBuffer("line1\nline2");
      const ctx = createCommandLineContext({ line: 1, col: 0 }, ":");
      const { ctx: result } = pressKeys(["0", "Enter"], ctx, buffer);
      expect(result.cursor.line).toBe(0);
    });
  });

  // ---------------------------------------------------
  // Character input
  // ---------------------------------------------------
  describe("Character input", () => {
    it("appends characters to the command buffer", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createCommandLineContext({ line: 0, col: 0 }, ":");
      const { ctx: result } = pressKeys(["h", "e", "l", "p"], ctx, buffer);
      expect(result.commandBuffer).toBe("help");
      expect(result.statusMessage).toBe(":help");
    });

    it("ignores special keys (long key names)", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createCommandLineContext({ line: 0, col: 0 }, ":", {
        commandBuffer: "test",
      });
      const { ctx: result } = pressKeys(["ArrowLeft"], ctx, buffer);
      expect(result.commandBuffer).toBe("test");
    });
  });

  // ---------------------------------------------------
  // :set number / :set nonumber
  // ---------------------------------------------------
  describe(":set number / :set nonumber", () => {
    it("emits set-option number=true with :set number", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createCommandLineContext({ line: 0, col: 0 }, ":");
      const { ctx: result, allActions } = pressKeys(
        [..."set number", "Enter"],
        ctx,
        buffer,
      );
      expect(result.mode).toBe("normal");
      expect(allActions).toContainEqual({
        type: "set-option",
        option: "number",
        value: true,
      });
    });

    it("emits set-option number=false with :set nonumber", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createCommandLineContext({ line: 0, col: 0 }, ":");
      const { ctx: result, allActions } = pressKeys(
        [..."set nonumber", "Enter"],
        ctx,
        buffer,
      );
      expect(result.mode).toBe("normal");
      expect(allActions).toContainEqual({
        type: "set-option",
        option: "number",
        value: false,
      });
    });

    it("emits set-option with short form :set nu / :set nonu", () => {
      const buffer = new TextBuffer("hello");
      const ctx1 = createCommandLineContext({ line: 0, col: 0 }, ":");
      const { allActions: a1 } = pressKeys([..."set nu", "Enter"], ctx1, buffer);
      expect(a1).toContainEqual({ type: "set-option", option: "number", value: true });

      const ctx2 = createCommandLineContext({ line: 0, col: 0 }, ":");
      const { allActions: a2 } = pressKeys([..."set nonu", "Enter"], ctx2, buffer);
      expect(a2).toContainEqual({ type: "set-option", option: "number", value: false });
    });
  });

  // ---------------------------------------------------
  // Unknown command (E492)
  // ---------------------------------------------------
  describe("Unknown command (E492)", () => {
    it("shows E492 error for unknown command", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createCommandLineContext({ line: 0, col: 0 }, ":");
      const { ctx: result, allActions } = pressKeys(
        [..."aaa", "Enter"],
        ctx,
        buffer,
      );
      expect(result.mode).toBe("normal");
      expect(result.statusMessage).toBe("E492: Not an editor command: aaa");
      expect(result.statusError).toBe(true);
      expect(allActions).toContainEqual({
        type: "status-message",
        message: "E492: Not an editor command: aaa",
      });
    });

    it("clears error status on next command-line entry", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createCommandLineContext({ line: 0, col: 0 }, ":", {
        statusError: true,
        statusMessage: "E492: Not an editor command: foo",
      });
      const { ctx: result } = pressKeys(["Escape"], ctx, buffer);
      expect(result.statusError).toBe(false);
      expect(result.statusMessage).toBe("");
    });
  });

  // ---------------------------------------------------
  // Integration test: search from normal mode and return
  // ---------------------------------------------------
  describe("Integration tests", () => {
    it("searches by typing /hello from normal mode end-to-end", () => {
      const buffer = new TextBuffer("foo\nbar\nhello\nworld");
      const ctx = createInitialContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(
        ["/", "h", "e", "l", "l", "o", "Enter"],
        ctx,
        buffer,
      );
      expect(result.mode).toBe("normal");
      expect(result.cursor).toEqual({ line: 2, col: 0 });
      expect(result.lastSearch).toBe("hello");
    });

    it("jumps to line 5 by typing :5 from normal mode", () => {
      const lines = Array.from({ length: 10 }, (_, i) => `line${i + 1}`).join(
        "\n",
      );
      const buffer = new TextBuffer(lines);
      const ctx = createInitialContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys([":", "5", "Enter"], ctx, buffer);
      expect(result.mode).toBe("normal");
      expect(result.cursor).toEqual({ line: 4, col: 0 });
    });
  });

  // ---------------------------------------------------
  // :s substitute
  // ---------------------------------------------------
  describe(":s substitute", () => {
    it(":s/old/new/ replaces first match on current line", () => {
      const buffer = new TextBuffer("foo bar foo");
      const ctx = createInitialContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(
        [...":", ..."s/foo/baz/", "Enter"],
        ctx,
        buffer,
      );
      expect(buffer.getContent()).toBe("baz bar foo");
      expect(result.mode).toBe("normal");
      expect(result.statusMessage).toContain("1 substitution");
    });

    it(":s/old/new/g replaces all matches on current line", () => {
      const buffer = new TextBuffer("foo bar foo baz foo");
      const ctx = createInitialContext({ line: 0, col: 0 });
      pressKeys([...":", ..."s/foo/x/g", "Enter"], ctx, buffer);
      expect(buffer.getContent()).toBe("x bar x baz x");
    });

    it(":%s/old/new/g replaces all matches in entire file", () => {
      const buffer = new TextBuffer("foo\nbar\nfoo\nbaz");
      const ctx = createInitialContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(
        [...":", ..."%s/foo/replaced/g", "Enter"],
        ctx,
        buffer,
      );
      expect(buffer.getContent()).toBe("replaced\nbar\nreplaced\nbaz");
      expect(result.statusMessage).toContain("2 substitutions on 2 lines");
    });

    it(":1,3s/x/y/g replaces in line range", () => {
      const buffer = new TextBuffer("x\nx\nx\nx");
      const ctx = createInitialContext({ line: 0, col: 0 });
      pressKeys([...":", ..."1,3s/x/y/g", "Enter"], ctx, buffer);
      expect(buffer.getContent()).toBe("y\ny\ny\nx");
    });

    it(":.,$s/a/b/g replaces from current line to end", () => {
      const buffer = new TextBuffer("aaa\naaa\naaa\naaa");
      const ctx = createInitialContext({ line: 1, col: 0 });
      pressKeys([...":", ...".,", "$", ..."s/a/b/g", "Enter"], ctx, buffer);
      expect(buffer.getContent()).toBe("aaa\nbbb\nbbb\nbbb");
    });

    it(":s with no match shows error", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createInitialContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(
        [...":", ..."s/xyz/abc/", "Enter"],
        ctx,
        buffer,
      );
      expect(buffer.getContent()).toBe("hello world");
      expect(result.statusMessage).toContain("Pattern not found");
    });

    it(":s can be undone", () => {
      const buffer = new TextBuffer("foo bar");
      const ctx = createInitialContext({ line: 0, col: 0 });
      const { ctx: afterSub } = pressKeys(
        [...":", ..."s/foo/baz/", "Enter"],
        ctx,
        buffer,
      );
      expect(buffer.getContent()).toBe("baz bar");
      pressKeys(["u"], afterSub, buffer);
      expect(buffer.getContent()).toBe("foo bar");
    });

    it(":s/old/new/i does case-insensitive match", () => {
      const buffer = new TextBuffer("Hello hello HELLO");
      const ctx = createInitialContext({ line: 0, col: 0 });
      pressKeys([...":", ..."s/hello/x/gi", "Enter"], ctx, buffer);
      expect(buffer.getContent()).toBe("x x x");
    });

    it(":%s with alternate delimiter works", () => {
      const buffer = new TextBuffer("/usr/bin/sh");
      const ctx = createInitialContext({ line: 0, col: 0 });
      pressKeys([...":", ..."%s#/usr/bin#/usr/local/bin#g", "Enter"], ctx, buffer);
      expect(buffer.getContent()).toBe("/usr/local/bin/sh");
    });

    it(":s/old/new works without trailing delimiter", () => {
      const buffer = new TextBuffer("foo bar foo");
      const ctx = createInitialContext({ line: 0, col: 0 });
      pressKeys([...":", ..."s/foo/baz", "Enter"], ctx, buffer);
      expect(buffer.getContent()).toBe("baz bar foo");
    });

    it(":%s/old/new works without trailing delimiter", () => {
      const buffer = new TextBuffer("foo\nfoo");
      const ctx = createInitialContext({ line: 0, col: 0 });
      pressKeys([...":", ..."%s/foo/bar", "Enter"], ctx, buffer);
      expect(buffer.getContent()).toBe("bar\nbar");
    });

    it(":s with invalid regex pattern shows error", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createInitialContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(
        [...":", ..."s/[invalid/replacement/", "Enter"],
        ctx,
        buffer,
      );
      expect(buffer.getContent()).toBe("hello world");
      expect(result.mode).toBe("normal");
      expect(result.statusMessage).toContain("Invalid pattern");
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
      const ctx = createCommandLineContext({ line: 0, col: 0 }, ":");
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
      const ctx = createCommandLineContext({ line: 0, col: 0 }, ":");
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

/**
 * normal-mode-modes.test.ts
 *
 * Tests for mode transitions and special state handling in normal mode.
 * Covers insert/visual mode transitions, Ctrl key combinations, readOnly mode,
 * modifier key handling, macro recording/playback, marks, text object pending,
 * and various edge cases.
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

describe("Normal mode — modes", () => {
  // ---------------------------------------------------
  // Transition to insert mode
  // ---------------------------------------------------
  describe("Transition to insert mode", () => {
    it("enters insert mode with i (cursor stays in place)", () => {
      const v = vim("hello", { cursor: [0, 2] });
      v.type("i");
      expect(v.mode()).toBe("insert");
      expect(v.cursor().col).toBe(2);
    });

    it("moves cursor one position right and enters insert mode with a", () => {
      const v = vim("hello", { cursor: [0, 2] });
      v.type("a");
      expect(v.mode()).toBe("insert");
      expect(v.cursor().col).toBe(3);
    });

    it("moves to the first non-whitespace character and enters insert mode with I", () => {
      const v = vim("  hello", { cursor: [0, 5] });
      v.type("I");
      expect(v.mode()).toBe("insert");
      expect(v.cursor().col).toBe(2);
    });

    it("moves to end of line and enters insert mode with A", () => {
      const v = vim("hello");
      v.type("A");
      expect(v.mode()).toBe("insert");
      expect(v.cursor().col).toBe(5);
    });

    it("inserts a blank line below and enters insert mode with o", () => {
      const v = vim("line1\nline2");
      v.type("o");
      expect(v.mode()).toBe("insert");
      expect(v.cursor()).toEqual({ line: 1, col: 0 });
      expect(v.content()).toBe("line1\n\nline2");
    });

    it("inserts a blank line above and enters insert mode with O", () => {
      const v = vim("line1\nline2", { cursor: [1, 0] });
      v.type("O");
      expect(v.mode()).toBe("insert");
      expect(v.cursor()).toEqual({ line: 1, col: 0 });
      expect(v.content()).toBe("line1\n\nline2");
    });

    it("o preserves indentation from current line", () => {
      const v = vim("  indented", { cursor: [0, 2] });
      v.type("o");
      expect(v.mode()).toBe("insert");
      expect(v.cursor()).toEqual({ line: 1, col: 2 });
      expect(v.line(1)).toBe("  ");
    });

    it("O preserves indentation from current line", () => {
      const v = vim("  indented", { cursor: [0, 2] });
      v.type("O");
      expect(v.mode()).toBe("insert");
      expect(v.cursor()).toEqual({ line: 0, col: 2 });
      expect(v.line(0)).toBe("  ");
    });
  });

  // ---------------------------------------------------
  // v / V (transition to visual mode)
  // ---------------------------------------------------
  describe("Transition to visual mode", () => {
    it("enters visual mode with v", () => {
      const v = vim("hello", { cursor: [0, 2] });
      v.type("v");
      expect(v.mode()).toBe("visual");
      expect(v.raw().ctx.visualAnchor).toEqual({ line: 0, col: 2 });
    });

    it("enters visual-line mode with V", () => {
      const v = vim("hello\nworld");
      v.type("V");
      expect(v.mode()).toBe("visual-line");
      expect(v.raw().ctx.visualAnchor).toEqual({ line: 0, col: 0 });
    });
  });

  // ---------------------------------------------------
  // Ctrl key combinations
  // ---------------------------------------------------
  describe("Ctrl key combinations", () => {
    it("redoes with Ctrl-R", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });
      // dd -> undo -> redo
      const { ctx: afterDd } = pressKeys(["d", "d"], ctx, buffer);
      const { ctx: afterUndo } = pressKeys(["u"], afterDd, buffer);
      expect(buffer.getContent()).toBe("hello");
      const result = processKeystroke("r", afterUndo, buffer, true);
      expect(buffer.getContent()).toBe("");
    });

    it("displays a message when Ctrl-R redo stack is empty", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });
      const result = processKeystroke("r", ctx, buffer, true);
      expect(result.newCtx.statusMessage).toBe("Already at newest change");
    });
  });

  // ---------------------------------------------------
  // readOnly mode
  // ---------------------------------------------------
  describe("readOnly mode", () => {
    /** Helper to process multiple keys in readOnly mode */
    function pressKeysReadOnly(keys: string[], ctx: VimContext, buffer: TextBuffer) {
      let current = ctx;
      const allActions: import("../types").VimAction[] = [];
      for (const key of keys) {
        const result = processKeystroke(key, current, buffer, false, true);
        current = result.newCtx;
        allActions.push(...result.actions);
      }
      return { ctx: current, allActions };
    }

    it("cannot enter insert mode with i, a, o, I, A, O", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });

      for (const key of ["i", "a", "o", "I", "A", "O"]) {
        const result = processKeystroke(key, ctx, buffer, false, true);
        expect(result.newCtx.mode).toBe("normal");
      }
    });

    it("blocks d, c operators", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext({ line: 0, col: 0 });

      const { ctx: afterD } = pressKeysReadOnly(["d"], ctx, buffer);
      expect(afterD.phase).toBe("idle");
      expect(afterD.operator).toBeNull();
      expect(buffer.getContent()).toBe("hello world");

      const { ctx: afterC } = pressKeysReadOnly(["c"], ctx, buffer);
      expect(afterC.phase).toBe("idle");
      expect(afterC.operator).toBeNull();
      expect(buffer.getContent()).toBe("hello world");
    });

    it("allows y operator", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext({ line: 0, col: 0 });

      const { ctx: result, allActions } = pressKeysReadOnly(["y", "w"], ctx, buffer);
      expect(result.register).toBe("hello ");
      expect(allActions.some((a) => a.type === "yank")).toBe(true);
      expect(buffer.getContent()).toBe("hello world");
    });

    it("blocks x, p, P", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 }, { register: "test" });

      for (const key of ["x", "p", "P"]) {
        const result = processKeystroke(key, ctx, buffer, false, true);
        expect(result.newCtx.mode).toBe("normal");
        expect(buffer.getContent()).toBe("hello");
      }
    });

    it("blocks J (join lines)", () => {
      const buffer = new TextBuffer("hello\nworld");
      const ctx = createTestContext({ line: 0, col: 0 });

      const result = processKeystroke("J", ctx, buffer, false, true);
      expect(buffer.getContent()).toBe("hello\nworld");
      expect(result.newCtx.mode).toBe("normal");
    });

    it("blocks u (undo)", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });

      const result = processKeystroke("u", ctx, buffer, false, true);
      expect(result.newCtx.mode).toBe("normal");
    });

    it("blocks r (replace)", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });

      const result = processKeystroke("r", ctx, buffer, false, true);
      expect(buffer.getContent()).toBe("hello");
    });

    it("blocks Ctrl-R (redo)", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });

      const result = processKeystroke("r", ctx, buffer, true, true);
      expect(result.newCtx.mode).toBe("normal");
    });

    it("blocks : (ex command)", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });

      const result = processKeystroke(":", ctx, buffer, false, true);
      expect(result.newCtx.mode).toBe("normal");
    });

    it("allows motions (h, j, k, l, w, e, b)", () => {
      const buffer = new TextBuffer("hello world\nsecond line");
      const ctx = createTestContext({ line: 0, col: 0 });

      // w: next word
      const r1 = processKeystroke("w", ctx, buffer, false, true);
      expect(r1.newCtx.cursor.col).toBe(6);

      // j: next line
      const r2 = processKeystroke("j", ctx, buffer, false, true);
      expect(r2.newCtx.cursor.line).toBe(1);
    });

    it("allows / (search)", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });

      const result = processKeystroke("/", ctx, buffer, false, true);
      expect(result.newCtx.mode).toBe("command-line");
      expect(result.newCtx.commandType).toBe("/");
    });

    it("allows v, V (visual mode)", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 });

      const r1 = processKeystroke("v", ctx, buffer, false, true);
      expect(r1.newCtx.mode).toBe("visual");

      const r2 = processKeystroke("V", ctx, buffer, false, true);
      expect(r2.newCtx.mode).toBe("visual-line");
    });

    it("blocks d, x, c in visual mode", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext(
        { line: 0, col: 0 },
        { mode: "visual", visualAnchor: { line: 0, col: 0 } },
      );

      // Move cursor to create a selection
      const { ctx: afterMotion } = pressKeysReadOnly(["w"], ctx, buffer);

      for (const key of ["d", "x", "c"]) {
        const result = processKeystroke(key, afterMotion, buffer, false, true);
        expect(buffer.getContent()).toBe("hello world");
      }
    });

    it("allows y in visual mode", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createTestContext(
        { line: 0, col: 0 },
        { mode: "visual", visualAnchor: { line: 0, col: 0 } },
      );

      const { ctx: afterMotion } = pressKeysReadOnly(["e"], ctx, buffer);
      const result = processKeystroke("y", afterMotion, buffer, false, true);
      expect(result.newCtx.register).toBeTruthy();
      expect(buffer.getContent()).toBe("hello world");
    });

    it("forces back to normal mode when in insert mode", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext(
        { line: 0, col: 2 },
        { mode: "insert", statusMessage: "-- INSERT --" },
      );

      const result = processKeystroke("a", ctx, buffer, false, true);
      expect(result.newCtx.mode).toBe("normal");
    });
  });

  // ---------------------------------------------------
  // Modifier keys (Shift, Control, Alt, Meta)
  // ---------------------------------------------------
  describe("Modifier key handling", () => {
    it("Shift key does not reset count (10G goes to line 10)", () => {
      const lines = Array.from({ length: 100 }, (_, i) => `line${i + 1}`).join("\n");
      const buffer = new TextBuffer(lines);
      const ctx = createTestContext({ line: 0, col: 0 });
      // Simulate: 1, 0, Shift (keydown), G (keydown)
      const { ctx: result } = pressKeys(["1", "0", "Shift", "G"], ctx, buffer);
      expect(result.cursor.line).toBe(9); // line 10 (0-indexed)
    });

    it("Shift key does not reset count during operator-pending (5Shift+G = 5G)", () => {
      const lines = Array.from({ length: 100 }, (_, i) => `line${i + 1}`).join("\n");
      const buffer = new TextBuffer(lines);
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["5", "Shift", "G"], ctx, buffer);
      expect(result.cursor.line).toBe(4); // line 5 (0-indexed)
    });

    it("Shift key does not reset operator-pending state (d + Shift + G)", () => {
      const lines = Array.from({ length: 20 }, (_, i) => `line${i + 1}`).join("\n");
      const buffer = new TextBuffer(lines);
      const ctx = createTestContext({ line: 5, col: 0 });
      pressKeys(["d", "Shift", "G"], ctx, buffer);
      // dG from line 5 deletes line6..line20
      expect(buffer.getLineCount()).toBe(5);
    });

    it("Control/Alt/Meta keys do not reset count", () => {
      const lines = Array.from({ length: 50 }, (_, i) => `line${i + 1}`).join("\n");
      const buffer = new TextBuffer(lines);
      const ctx = createTestContext({ line: 0, col: 0 });
      const { ctx: result } = pressKeys(["2", "0", "Control", "Alt", "Meta", "j"], ctx, buffer);
      expect(result.cursor.line).toBe(20);
    });
  });

  // ---------------------------------------------------
  // Macro recording & playback
  // ---------------------------------------------------
  describe("Macro recording & playback", () => {
    it("qa starts recording, q stops, @a replays", () => {
      const v = vim("aaa\nbbb\nccc");
      // qa -> start recording into a
      v.type("qa");
      expect(v.raw().ctx.macroRecording).toBe("a");
      expect(v.statusMessage()).toBe("recording @a");
      // dd -> delete line (recorded)
      v.type("dd");
      expect(v.content()).toBe("bbb\nccc");
      expect(v.statusMessage()).toBe("recording @a");
      // q -> stop recording
      v.type("q");
      expect(v.raw().ctx.macroRecording).toBeNull();
      expect(v.statusMessage()).toBe("");
      expect(v.raw().ctx.macros.a).toEqual(["d", "d"]);
      // @a -> replay (deletes another line)
      v.type("@a");
      expect(v.content()).toBe("ccc");
    });

    it("@@ replays the last executed macro", () => {
      const v = vim("aaa\nbbb\nccc\nddd");
      // Record macro: dd
      v.type("qaddq");
      expect(v.content()).toBe("bbb\nccc\nddd");
      // @a -> replay
      v.type("@a");
      expect(v.content()).toBe("ccc\nddd");
      expect(v.raw().ctx.lastMacro).toBe("a");
      // @@ -> replay last
      v.type("@@");
      expect(v.content()).toBe("ddd");
    });

    it("macro with insert mode: qaihello<Esc>q then @a", () => {
      const buffer = new TextBuffer("world\nworld");
      const ctx = createTestContext({ line: 0, col: 0 });
      // Record: ihello<Esc>
      const { ctx: afterRecord } = pressKeys(["q", "a", "i", "h", "i", "Escape", "q"], ctx, buffer);
      expect(buffer.getContent()).toBe("hiworld\nworld");
      // Move to next line and replay
      const { ctx: onLine1 } = pressKeys(["j", "0"], afterRecord, buffer);
      pressKeys(["@", "a"], onLine1, buffer);
      expect(buffer.getContent()).toBe("hiworld\nhiworld");
    });

    it("@a does nothing when macro is empty/unrecorded", () => {
      const v = vim("hello");
      v.type("@a");
      expect(v.content()).toBe("hello");
    });

    it("@@ does nothing when no macro was executed before", () => {
      const v = vim("hello");
      v.type("@@");
      expect(v.content()).toBe("hello");
    });
  });

  // ---------------------------------------------------
  // Marks (m, `, ')
  // ---------------------------------------------------
  describe("Marks (m, `, ')", () => {
    it("ma sets mark a at current position, `a jumps to it", () => {
      const v = vim("line1\nline2\nline3\nline4\nline5", { cursor: [1, 3] });
      // Set mark a
      v.type("ma");
      expect(v.raw().ctx.marks.a).toEqual({ line: 1, col: 3 });
      // Move away
      v.type("G");
      expect(v.cursor().line).toBe(4);
      // Jump back to mark a
      v.type("`a");
      expect(v.cursor()).toEqual({ line: 1, col: 3 });
    });

    it("'a also jumps to mark a", () => {
      const v = vim("line1\nline2\nline3", { cursor: [2, 0] });
      v.type("mb");
      v.type("gg");
      v.type("'b");
      expect(v.cursor().line).toBe(2);
    });

    it("multiple marks work independently", () => {
      const v = vim("aaa\nbbb\nccc\nddd");
      v.type("ma");
      v.type("jj");
      v.type("mb");
      expect(v.raw().ctx.marks.a).toEqual({ line: 0, col: 0 });
      expect(v.raw().ctx.marks.b).toEqual({ line: 2, col: 0 });
      // Jump to a
      v.type("`a");
      expect(v.cursor().line).toBe(0);
      // Jump to b
      v.type("`b");
      expect(v.cursor().line).toBe(2);
    });

    it("shows error when mark is not set", () => {
      const v = vim("hello");
      v.type("`z");
      expect(v.statusMessage()).toBe("Mark 'z' not set");
    });

    it("clamps to buffer bounds if lines were deleted", () => {
      const v = vim("line1\nline2\nline3", { cursor: [2, 0] });
      v.type("ma");
      // Delete last line
      v.type("dd");
      expect(v.raw().buffer.getLineCount()).toBe(2);
      // Jump to mark a (line 2 no longer exists, clamp to line 1)
      v.type("`a");
      expect(v.cursor().line).toBe(1);
    });
  });

  // ---------------------------------------------------
  // Unknown key
  // ---------------------------------------------------
  describe("Unknown key", () => {
    it("resets context on unrecognized key", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createTestContext({ line: 0, col: 0 }, { count: 5 });
      const { ctx: result } = pressKeys(["z"], ctx, buffer);
      expect(result.count).toBe(0);
      expect(result.phase).toBe("idle");
    });
  });

  // ---------------------------------------------------
  // handleTextObjectPending with invalid text object
  // ---------------------------------------------------
  describe("handleTextObjectPending with invalid text object", () => {
    it("resets when resolveTextObject returns null (e.g., diQ)", () => {
      const v = vim("hello world");
      // d -> operator-pending, i -> text-object-pending, Q -> invalid text object
      v.type("diQ");
      expect(v.raw().ctx.phase).toBe("idle");
      expect(v.raw().ctx.operator).toBeNull();
      expect(v.content()).toBe("hello world"); // no change
    });
  });

  // ---------------------------------------------------
  // handleTextObjectPending without operator
  // ---------------------------------------------------
  describe("handleTextObjectPending without operator", () => {
    it("resets gracefully when text-object-pending state has no operator", () => {
      const buffer = new TextBuffer("hello world");
      // Manually construct a context in text-object-pending state without an operator
      const ctx = createTestContext(
        { line: 0, col: 0 },
        {
          phase: "text-object-pending" as const,
          textObjectModifier: "i",
          operator: null,
        },
      );
      // Press 'w' to trigger the text-object-pending handler with a valid text object but no operator
      const result = processKeystroke("w", ctx, buffer);
      expect(result.newCtx.phase).toBe("idle");
      expect(result.newCtx.operator).toBeNull();
      expect(buffer.getContent()).toBe("hello world"); // no change
    });
  });

  // ---------------------------------------------------
  // ciw enters insert mode via text object
  // ---------------------------------------------------
  describe("ciw enters insert mode via text object", () => {
    it("ciw changes inner word and enters insert mode", () => {
      const v = vim("hello world");
      v.type("ciw");
      expect(v.mode()).toBe("insert");
      expect(v.statusMessage()).toBe("-- INSERT --");
      expect(v.allActions().some((a) => a.type === "mode-change" && a.mode === "insert")).toBe(
        true,
      );
    });
  });

  // ---------------------------------------------------
  // cgg enters insert mode
  // ---------------------------------------------------
  describe("cgg enters insert mode", () => {
    it("cgg changes from cursor to beginning of file and enters insert mode", () => {
      const v = vim("line1\nline2\nline3", { cursor: [2, 0] });
      v.type("cgg");
      expect(v.mode()).toBe("insert");
      // mode-change action is emitted because opResult.newMode (insert) !== ctx.mode (normal)
      expect(v.allActions().some((a) => a.type === "mode-change" && a.mode === "insert")).toBe(
        true,
      );
    });
  });

  // ---------------------------------------------------
  // I on an all-whitespace line
  // ---------------------------------------------------
  describe("I on an all-whitespace line", () => {
    it("I moves to column 0 on an all-whitespace line", () => {
      const v = vim("   ", { cursor: [0, 2] });
      v.type("I");
      expect(v.mode()).toBe("insert");
      expect(v.cursor().col).toBe(0);
    });
  });

  // ---------------------------------------------------
  // Invalid mark key
  // ---------------------------------------------------
  describe("Invalid mark key", () => {
    it("m1 resets (1 is not a valid mark key)", () => {
      const v = vim("hello world");
      v.type("m1");
      expect(v.raw().ctx.phase).toBe("idle");
      // No mark should be set
      expect(v.raw().ctx.marks["1"]).toBeUndefined();
    });

    it("mM resets (uppercase M is not a valid mark key)", () => {
      const v = vim("hello world");
      v.type("mM");
      expect(v.raw().ctx.phase).toBe("idle");
      expect(v.raw().ctx.marks["M"]).toBeUndefined();
    });

    it("m! resets (special character is not a valid mark key)", () => {
      const v = vim("hello world");
      v.type("m!");
      expect(v.raw().ctx.phase).toBe("idle");
    });
  });

  // ---------------------------------------------------
  // Invalid jump mark key
  // ---------------------------------------------------
  describe("Invalid jump mark key", () => {
    it("`1 resets (1 is not a valid jump mark key)", () => {
      const v = vim("hello world");
      v.type("`1");
      expect(v.raw().ctx.phase).toBe("idle");
      // Cursor should not change
      expect(v.cursor()).toEqual({ line: 0, col: 0 });
    });

    it("`M resets (uppercase M is not a valid jump mark key)", () => {
      const v = vim("hello world");
      v.type("`M");
      expect(v.raw().ctx.phase).toBe("idle");
    });

    it("'1 resets (1 is not a valid jump mark key via ')", () => {
      const v = vim("hello world");
      v.type("'1");
      expect(v.raw().ctx.phase).toBe("idle");
    });
  });

  // ---------------------------------------------------
  // o on an empty line exercises getLeadingWhitespace
  // ---------------------------------------------------
  describe("o on an empty line exercises getLeadingWhitespace", () => {
    it("o on an empty line opens a new line with no indent", () => {
      const v = vim("");
      v.type("o");
      expect(v.mode()).toBe("insert");
      expect(v.cursor()).toEqual({ line: 1, col: 0 });
      expect(v.content()).toBe("\n");
    });
  });
});

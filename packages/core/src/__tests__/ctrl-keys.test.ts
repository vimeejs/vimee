/**
 * ctrl-keys.test.ts
 *
 * Tests for Ctrl key combination commands via processKeystroke.
 * Covers Ctrl-R (redo), Ctrl-B/F/U/D (scroll), Ctrl-V (visual-block).
 */

import { describe, it, expect } from "vitest";
import type { VimContext } from "../types";
import { processKeystroke, createInitialContext } from "../vim-state";
import { TextBuffer } from "../buffer";

/** Process multiple keys in sequence */
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

describe("Ctrl key combinations", () => {
  // ---------------------------------------------------
  // Ctrl-R (redo)
  // ---------------------------------------------------
  describe("Ctrl-R (redo)", () => {
    it("redoes after undo", () => {
      const buffer = new TextBuffer("hello world");
      const ctx = createInitialContext({ line: 0, col: 0 });
      // dd -> undo -> redo
      const { ctx: afterDd } = pressKeys(["d", "d"], ctx, buffer);
      expect(buffer.getContent()).toBe("");
      const { ctx: afterUndo } = pressKeys(["u"], afterDd, buffer);
      expect(buffer.getContent()).toBe("hello world");
      const result = processKeystroke("r", afterUndo, buffer, true);
      expect(buffer.getContent()).toBe("");
    });

    it("shows 'Already at newest change' when nothing to redo", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createInitialContext({ line: 0, col: 0 });
      const result = processKeystroke("r", ctx, buffer, true);
      expect(result.newCtx.statusMessage).toBe("Already at newest change");
      expect(result.actions).toContainEqual({
        type: "status-message",
        message: "Already at newest change",
      });
    });

    it("shows 'N more lines' when redo adds multiple lines", () => {
      const buffer = new TextBuffer("line1\nline2\nline3\nline4\nline5");
      const ctx = createInitialContext({ line: 0, col: 0 });
      // Yank 3 lines, paste (adds 3 lines), undo, redo
      const { ctx: afterYank } = pressKeys(["3", "y", "y"], ctx, buffer);
      const { ctx: afterPaste } = pressKeys(["p"], afterYank, buffer);
      expect(buffer.getLineCount()).toBe(8);
      const { ctx: afterUndo } = pressKeys(["u"], afterPaste, buffer);
      expect(buffer.getLineCount()).toBe(5);
      const result = processKeystroke("r", afterUndo, buffer, true);
      expect(buffer.getLineCount()).toBe(8);
      expect(result.newCtx.statusMessage).toBe("3 more lines");
    });

    it("shows 'N fewer lines' when redo removes multiple lines", () => {
      const buffer = new TextBuffer("line1\nline2\nline3\nline4\nline5");
      const ctx = createInitialContext({ line: 0, col: 0 });
      // 3dd (delete 3 lines), undo (restore 3), redo (delete 3 again)
      const { ctx: afterDd } = pressKeys(["3", "d", "d"], ctx, buffer);
      expect(buffer.getLineCount()).toBe(2);
      const { ctx: afterUndo } = pressKeys(["u"], afterDd, buffer);
      expect(buffer.getLineCount()).toBe(5);
      const result = processKeystroke("r", afterUndo, buffer, true);
      expect(buffer.getLineCount()).toBe(2);
      expect(result.newCtx.statusMessage).toBe("3 fewer lines");
    });

    it("is blocked in readOnly mode", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createInitialContext({ line: 0, col: 0 });
      const result = processKeystroke("r", ctx, buffer, true, true);
      expect(result.newCtx.mode).toBe("normal");
    });
  });

  // ---------------------------------------------------
  // Ctrl-B (scroll full page up)
  // ---------------------------------------------------
  describe("Ctrl-B (scroll full page up)", () => {
    it("emits scroll up action with amount 1.0", () => {
      const buffer = new TextBuffer("hello\nworld");
      const ctx = createInitialContext({ line: 0, col: 0 });
      const result = processKeystroke("b", ctx, buffer, true);
      expect(result.actions).toContainEqual({
        type: "scroll",
        direction: "up",
        amount: 1.0,
      });
      expect(result.newCtx.count).toBe(0);
    });
  });

  // ---------------------------------------------------
  // Ctrl-F (scroll full page down)
  // ---------------------------------------------------
  describe("Ctrl-F (scroll full page down)", () => {
    it("emits scroll down action with amount 1.0", () => {
      const buffer = new TextBuffer("hello\nworld");
      const ctx = createInitialContext({ line: 0, col: 0 });
      const result = processKeystroke("f", ctx, buffer, true);
      expect(result.actions).toContainEqual({
        type: "scroll",
        direction: "down",
        amount: 1.0,
      });
    });
  });

  // ---------------------------------------------------
  // Ctrl-U (scroll half page up)
  // ---------------------------------------------------
  describe("Ctrl-U (scroll half page up)", () => {
    it("emits scroll up action with amount 0.5", () => {
      const buffer = new TextBuffer("hello\nworld");
      const ctx = createInitialContext({ line: 0, col: 0 });
      const result = processKeystroke("u", ctx, buffer, true);
      expect(result.actions).toContainEqual({
        type: "scroll",
        direction: "up",
        amount: 0.5,
      });
    });
  });

  // ---------------------------------------------------
  // Ctrl-D (scroll half page down)
  // ---------------------------------------------------
  describe("Ctrl-D (scroll half page down)", () => {
    it("emits scroll down action with amount 0.5", () => {
      const buffer = new TextBuffer("hello\nworld");
      const ctx = createInitialContext({ line: 0, col: 0 });
      const result = processKeystroke("d", ctx, buffer, true);
      expect(result.actions).toContainEqual({
        type: "scroll",
        direction: "down",
        amount: 0.5,
      });
    });
  });

  // ---------------------------------------------------
  // Ctrl-V (visual-block mode)
  // ---------------------------------------------------
  describe("Ctrl-V (visual-block mode)", () => {
    it("enters visual-block mode from normal mode", () => {
      const buffer = new TextBuffer("hello\nworld");
      const ctx = createInitialContext({ line: 0, col: 0 });
      const result = processKeystroke("v", ctx, buffer, true);
      expect(result.newCtx.mode).toBe("visual-block");
      expect(result.newCtx.statusMessage).toBe("-- VISUAL BLOCK --");
      expect(result.newCtx.visualAnchor).toEqual({ line: 0, col: 0 });
    });

    it("toggles off visual-block when already in visual-block", () => {
      const buffer = new TextBuffer("hello\nworld");
      const ctx: VimContext = {
        ...createInitialContext({ line: 0, col: 0 }),
        mode: "visual-block",
        visualAnchor: { line: 0, col: 0 },
      };
      const result = processKeystroke("v", ctx, buffer, true);
      expect(result.newCtx.mode).toBe("normal");
      expect(result.newCtx.visualAnchor).toBeNull();
    });

    it("enters visual-block from visual mode, preserving anchor", () => {
      const buffer = new TextBuffer("hello\nworld");
      const ctx: VimContext = {
        ...createInitialContext({ line: 0, col: 3 }),
        mode: "visual",
        visualAnchor: { line: 0, col: 0 },
      };
      const result = processKeystroke("v", ctx, buffer, true);
      expect(result.newCtx.mode).toBe("visual-block");
      expect(result.newCtx.visualAnchor).toEqual({ line: 0, col: 0 });
    });

    it("enters visual-block from visual-line mode", () => {
      const buffer = new TextBuffer("hello\nworld");
      const ctx: VimContext = {
        ...createInitialContext({ line: 0, col: 0 }),
        mode: "visual-line",
        visualAnchor: { line: 0, col: 0 },
      };
      const result = processKeystroke("v", ctx, buffer, true);
      expect(result.newCtx.mode).toBe("visual-block");
    });
  });

  // ---------------------------------------------------
  // Unknown Ctrl key
  // ---------------------------------------------------
  describe("Unknown Ctrl key", () => {
    it("does nothing for unknown Ctrl combinations", () => {
      const buffer = new TextBuffer("hello");
      const ctx = createInitialContext({ line: 0, col: 0 });
      const result = processKeystroke("z", ctx, buffer, true);
      // Should not crash, just returns unchanged ctx
      expect(result.newCtx.mode).toBe("normal");
    });
  });
});

/**
 * ctrl-keys.test.ts
 *
 * Tests for Ctrl key combination commands via processKeystroke.
 * Covers Ctrl-R (redo), Ctrl-B/F/U/D (scroll), Ctrl-V (visual-block).
 */

import { describe, it, expect } from "vitest";
import { vim } from "@vimee/testkit";
import { processKeystroke, createInitialContext } from "../vim-state";
import { TextBuffer } from "../buffer";

describe("Ctrl key combinations", () => {
  // ---------------------------------------------------
  // Ctrl-R (redo)
  // ---------------------------------------------------
  describe("Ctrl-R (redo)", () => {
    it("redoes after undo", () => {
      const v = vim("hello world");
      // dd -> undo -> redo
      v.type("dd");
      expect(v.content()).toBe("");
      v.type("u");
      expect(v.content()).toBe("hello world");
      v.type("<C-r>");
      expect(v.content()).toBe("");
    });

    it("shows 'Already at newest change' when nothing to redo", () => {
      const v = vim("hello");
      v.type("<C-r>");
      expect(v.statusMessage()).toBe("Already at newest change");
      expect(v.actions()).toContainEqual({
        type: "status-message",
        message: "Already at newest change",
      });
    });

    it("shows 'N more lines' when redo adds multiple lines", () => {
      const v = vim("line1\nline2\nline3\nline4\nline5");
      // Yank 3 lines, paste (adds 3 lines), undo, redo
      v.type("3yy");
      v.type("p");
      expect(v.lines().length).toBe(8);
      v.type("u");
      expect(v.lines().length).toBe(5);
      v.type("<C-r>");
      expect(v.lines().length).toBe(8);
      expect(v.statusMessage()).toBe("3 more lines");
    });

    it("shows 'N fewer lines' when redo removes multiple lines", () => {
      const v = vim("line1\nline2\nline3\nline4\nline5");
      // 3dd (delete 3 lines), undo (restore 3), redo (delete 3 again)
      v.type("3dd");
      expect(v.lines().length).toBe(2);
      v.type("u");
      expect(v.lines().length).toBe(5);
      v.type("<C-r>");
      expect(v.lines().length).toBe(2);
      expect(v.statusMessage()).toBe("3 fewer lines");
    });

    it("is blocked in readOnly mode", () => {
      // Testkit doesn't support readOnly, so use the old pattern
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
      const v = vim("hello\nworld");
      v.type("<C-b>");
      expect(v.actions()).toContainEqual({
        type: "scroll",
        direction: "up",
        amount: 1.0,
      });
    });
  });

  // ---------------------------------------------------
  // Ctrl-F (scroll full page down)
  // ---------------------------------------------------
  describe("Ctrl-F (scroll full page down)", () => {
    it("emits scroll down action with amount 1.0", () => {
      const v = vim("hello\nworld");
      v.type("<C-f>");
      expect(v.actions()).toContainEqual({
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
      const v = vim("hello\nworld");
      v.type("<C-u>");
      expect(v.actions()).toContainEqual({
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
      const v = vim("hello\nworld");
      v.type("<C-d>");
      expect(v.actions()).toContainEqual({
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
      const v = vim("hello\nworld");
      v.type("<C-v>");
      expect(v.mode()).toBe("visual-block");
      expect(v.statusMessage()).toBe("-- VISUAL BLOCK --");
      expect(v.raw().ctx.visualAnchor).toEqual({ line: 0, col: 0 });
    });

    it("toggles off visual-block when already in visual-block", () => {
      const v = vim("hello\nworld", { mode: "visual-block", anchor: [0, 0] });
      v.type("<C-v>");
      expect(v.mode()).toBe("normal");
      expect(v.raw().ctx.visualAnchor).toBeNull();
    });

    it("enters visual-block from visual mode, preserving anchor", () => {
      const v = vim("hello\nworld", { mode: "visual", cursor: [0, 3], anchor: [0, 0] });
      v.type("<C-v>");
      expect(v.mode()).toBe("visual-block");
      expect(v.raw().ctx.visualAnchor).toEqual({ line: 0, col: 0 });
    });

    it("enters visual-block from visual-line mode", () => {
      const v = vim("hello\nworld", { mode: "visual-line", anchor: [0, 0] });
      v.type("<C-v>");
      expect(v.mode()).toBe("visual-block");
    });

    it("creates a new anchor from cursor when entering visual-block from normal mode (visualAnchor is null)", () => {
      const v = vim("hello\nworld\nfoo", { cursor: [1, 3] });
      // In normal mode, visualAnchor is null
      expect(v.raw().ctx.visualAnchor).toBeNull();
      v.type("<C-v>");
      expect(v.mode()).toBe("visual-block");
      // The anchor should be a copy of the cursor, not null
      expect(v.raw().ctx.visualAnchor).toEqual({ line: 1, col: 3 });
    });

    it("uses cursor as fallback anchor when visual mode has null visualAnchor", () => {
      // Simulate visual mode with null visualAnchor (edge case for ?? operator)
      const v = vim("hello\nworld", { mode: "visual", cursor: [0, 2] });
      // Testkit sets mode to "visual" without anchor → visualAnchor stays null
      v.type("<C-v>");
      expect(v.mode()).toBe("visual-block");
      // When visualAnchor is null in visual mode, the ?? fallback creates anchor from cursor
      expect(v.raw().ctx.visualAnchor).toEqual({ line: 0, col: 2 });
    });
  });

  // ---------------------------------------------------
  // Unknown Ctrl key
  // ---------------------------------------------------
  describe("Unknown Ctrl key", () => {
    it("does nothing for unknown Ctrl combinations", () => {
      const v = vim("hello");
      v.type("<C-z>");
      // Should not crash, just returns unchanged ctx
      expect(v.mode()).toBe("normal");
    });
  });
});

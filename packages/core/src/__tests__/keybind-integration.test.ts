/**
 * keybind-integration.test.ts
 *
 * Integration tests for custom keybindings with processKeystroke.
 * Tests real-world usage patterns:
 * - Single-key callback keybinds
 * - Multi-key sequences (leader-style)
 * - Remap keybinds (Y -> y$)
 * - Mode-specific keybinds
 * - Override built-in keybinds
 * - Insert mode escape shortcuts (jj, jk)
 * - Keybind with actions (cursor move, mode change, status message, register, mark)
 * - Escape to cancel pending keybind
 * - Empty action array (external-only hooks)
 */

import { describe, it, expect, vi } from "vitest";
import type { VimContext, VimAction } from "../types";
import { processKeystroke, createInitialContext } from "../vim-state";
import { TextBuffer } from "../buffer";
import { createKeybindMap } from "../keybind";
import { actions } from "../actions";

// =====================
// Helpers
// =====================

function createTestContext(overrides?: Partial<VimContext>): VimContext {
  return {
    ...createInitialContext({ line: 0, col: 0 }),
    ...overrides,
  };
}

function pressKeys(
  keys: string[],
  ctx: VimContext,
  buffer: TextBuffer,
  keybinds?: ReturnType<typeof createKeybindMap>,
  ctrlKeys?: boolean[],
): { ctx: VimContext; allActions: VimAction[] } {
  let current = ctx;
  const allActions: VimAction[] = [];
  for (let i = 0; i < keys.length; i++) {
    const result = processKeystroke(
      keys[i],
      current,
      buffer,
      ctrlKeys?.[i] ?? false,
      false,
      keybinds,
    );
    current = result.newCtx;
    allActions.push(...result.actions);
  }
  return { ctx: current, allActions };
}

// =====================
// Tests
// =====================

describe("keybind integration with processKeystroke", () => {
  // --- Single-key callback ---

  it("executes a single-key callback keybind in normal mode", () => {
    const map = createKeybindMap();
    const executeFn = vi.fn(() => [actions.statusMessage("hello")]);
    map.addKeybind("normal", "Z", { execute: executeFn });

    const ctx = createTestContext();
    const buffer = new TextBuffer("test");

    const { ctx: newCtx, allActions } = pressKeys(["Z"], ctx, buffer, map);

    expect(executeFn).toHaveBeenCalledOnce();
    expect(newCtx.statusMessage).toBe("hello");
    expect(allActions).toContainEqual({ type: "status-message", message: "hello" });
  });

  // --- Multi-key sequence (leader-style) ---

  it("resolves a two-key leader-style keybind", () => {
    const map = createKeybindMap();
    const executeFn = vi.fn(() => [actions.statusMessage("type info shown")]);
    map.addKeybind("normal", "\\i", { execute: executeFn });

    const ctx = createTestContext();
    const buffer = new TextBuffer("const x = 1;");

    // First key: pending (shows partial input)
    const r1 = processKeystroke("\\", ctx, buffer, false, false, map);
    expect(r1.newCtx.statusMessage).toBe("\\");
    expect(r1.actions).toEqual([]);

    // Second key: matched
    const r2 = processKeystroke("i", r1.newCtx, buffer, false, false, map);
    expect(executeFn).toHaveBeenCalledOnce();
    expect(r2.newCtx.statusMessage).toBe("type info shown");
  });

  // --- Empty actions (external hook only) ---

  it("supports empty action array for external-only hooks", () => {
    const map = createKeybindMap();
    const externalCallback = vi.fn();
    map.addKeybind("normal", "\\h", {
      execute: () => {
        externalCallback("show hover");
        return [];
      },
    });

    const ctx = createTestContext();
    const buffer = new TextBuffer("test");

    const { allActions } = pressKeys(["\\", "h"], ctx, buffer, map);
    expect(externalCallback).toHaveBeenCalledWith("show hover");
    expect(allActions).toEqual([]);
  });

  // --- Cursor movement via actions ---

  it("moves cursor via cursor-move action", () => {
    const map = createKeybindMap();
    map.addKeybind("normal", "\\d", {
      execute: (ctx) => [actions.cursorRelative(ctx, 5)],
    });

    const ctx = createTestContext({ cursor: { line: 2, col: 3 } });
    const buffer = new TextBuffer("a\nb\nc\nd\ne\nf\ng\nh\ni\nj");

    const { ctx: newCtx } = pressKeys(["\\", "d"], ctx, buffer, map);
    expect(newCtx.cursor).toEqual({ line: 7, col: 3 });
  });

  // --- Mode change ---

  it("changes mode via mode-change action", () => {
    const map = createKeybindMap();
    map.addKeybind("normal", "\\e", {
      execute: () => [actions.modeChange("insert"), actions.statusMessage("-- EDIT --")],
    });

    const ctx = createTestContext();
    const buffer = new TextBuffer("test");

    const { ctx: newCtx } = pressKeys(["\\", "e"], ctx, buffer, map);
    expect(newCtx.mode).toBe("insert");
    // mode-change resets phase
    expect(newCtx.phase).toBe("idle");
  });

  // --- Register write ---

  it("writes to a register via register-write action", () => {
    const map = createKeybindMap();
    map.addKeybind("normal", "\\c", {
      execute: () => [actions.registerWrite("a", "clipboard content")],
    });

    const ctx = createTestContext();
    const buffer = new TextBuffer("test");

    const { ctx: newCtx } = pressKeys(["\\", "c"], ctx, buffer, map);
    expect(newCtx.registers.a).toBe("clipboard content");
  });

  // --- Mark set ---

  it("sets a mark via mark-set action", () => {
    const map = createKeybindMap();
    map.addKeybind("normal", "\\m", {
      execute: (ctx) => [actions.markSet("z", ctx.cursor)],
    });

    const ctx = createTestContext({ cursor: { line: 5, col: 10 } });
    const buffer = new TextBuffer("test");

    const { ctx: newCtx } = pressKeys(["\\", "m"], ctx, buffer, map);
    expect(newCtx.marks.z).toEqual({ line: 5, col: 10 });
  });

  // --- Content change ---

  it("changes content via content-change action", () => {
    const map = createKeybindMap();
    map.addKeybind("normal", "\\f", {
      execute: () => [actions.contentChange("formatted\ncontent")],
    });

    const ctx = createTestContext();
    const buffer = new TextBuffer("unformatted");

    const { allActions } = pressKeys(["\\", "f"], ctx, buffer, map);
    expect(buffer.getContent()).toBe("formatted\ncontent");
    expect(allActions).toContainEqual({ type: "content-change", content: "formatted\ncontent" });
  });

  // --- Escape cancels pending ---

  it("cancels pending keybind on Escape", () => {
    const map = createKeybindMap();
    map.addKeybind("normal", "\\i", { execute: () => [actions.noop()] });

    const ctx = createTestContext();
    const buffer = new TextBuffer("test");

    // Enter pending state
    const r1 = processKeystroke("\\", ctx, buffer, false, false, map);
    expect(map.isPending()).toBe(true);

    // Escape cancels
    const r2 = processKeystroke("Escape", r1.newCtx, buffer, false, false, map);
    expect(map.isPending()).toBe(false);
    expect(r2.actions).toEqual([]);
  });

  // --- Non-matching second key falls through to normal processing ---

  it("falls through to normal mode when second key doesn't match", () => {
    const map = createKeybindMap();
    map.addKeybind("normal", "\\i", { execute: () => [actions.noop()] });

    const ctx = createTestContext();
    const buffer = new TextBuffer("hello");

    // "\" -> pending
    const r1 = processKeystroke("\\", ctx, buffer, false, false, map);

    // "x" doesn't match any keybind -> falls through
    // "x" in normal mode deletes a character
    const r2 = processKeystroke("x", r1.newCtx, buffer, false, false, map);
    expect(r2.actions.some((a) => a.type === "content-change")).toBe(true);
    expect(buffer.getContent()).toBe("ello");
  });

  // --- Insert mode: jj to escape (common use case) ---

  it("supports jj in insert mode to return to normal mode", () => {
    const map = createKeybindMap();
    map.addKeybind("insert", "jj", {
      execute: () => [actions.modeChange("normal")],
    });

    const ctx = createTestContext({ mode: "insert" });
    const buffer = new TextBuffer("test");

    // j -> pending
    const r1 = processKeystroke("j", ctx, buffer, false, false, map);
    expect(map.isPending()).toBe(true);

    // j -> matched, returns to normal
    const r2 = processKeystroke("j", r1.newCtx, buffer, false, false, map);
    expect(r2.newCtx.mode).toBe("normal");
  });

  it("supports jk in insert mode to return to normal mode", () => {
    const map = createKeybindMap();
    map.addKeybind("insert", "jk", {
      execute: () => [actions.modeChange("normal")],
    });

    const ctx = createTestContext({ mode: "insert" });
    const buffer = new TextBuffer("test");

    const { ctx: newCtx } = pressKeys(["j", "k"], ctx, buffer, map);
    expect(newCtx.mode).toBe("normal");
  });

  // --- Override built-in keybind ---

  it("overrides built-in x command with custom keybind", () => {
    const map = createKeybindMap();
    const customAction = vi.fn(() => [actions.statusMessage("custom x!")]);
    map.addKeybind("normal", "x", { execute: customAction });

    const ctx = createTestContext();
    const buffer = new TextBuffer("hello");

    const { ctx: newCtx } = pressKeys(["x"], ctx, buffer, map);

    // Custom keybind takes priority — original "x" (delete char) does NOT run
    expect(customAction).toHaveBeenCalledOnce();
    expect(newCtx.statusMessage).toBe("custom x!");
    expect(buffer.getContent()).toBe("hello"); // NOT deleted
  });

  // --- Remap: Y -> y$ ---

  it("remaps Y to y$ (yank to end of line)", () => {
    const map = createKeybindMap();
    map.addKeybind("normal", "Y", { keys: "y$" });

    const ctx = createTestContext({ cursor: { line: 0, col: 2 } });
    const buffer = new TextBuffer("hello world");

    const { allActions } = pressKeys(["Y"], ctx, buffer, map);

    // Should yank from cursor to end of line
    const yankAction = allActions.find((a) => a.type === "yank");
    expect(yankAction).toBeDefined();
    if (yankAction && yankAction.type === "yank") {
      expect(yankAction.text).toBe("llo world");
    }
  });

  // --- Ctrl key keybinds ---

  it("resolves Ctrl+s keybind", () => {
    const map = createKeybindMap();
    const saveFn = vi.fn(() => [actions.statusMessage("saved")]);
    map.addKeybind("normal", "<C-s>", { execute: saveFn });

    const ctx = createTestContext();
    const buffer = new TextBuffer("test");

    const result = processKeystroke("s", ctx, buffer, true, false, map);
    expect(saveFn).toHaveBeenCalledOnce();
    expect(result.newCtx.statusMessage).toBe("saved");
  });

  // --- Without keybinds parameter, everything works as before ---

  it("works normally without keybinds parameter", () => {
    const ctx = createTestContext();
    const buffer = new TextBuffer("hello");

    // "x" should delete character (normal behavior)
    const result = processKeystroke("x", ctx, buffer);
    expect(result.actions.some((a) => a.type === "content-change")).toBe(true);
    expect(buffer.getContent()).toBe("ello");
  });

  // --- Multiple actions from one keybind ---

  it("handles multiple actions from a single keybind", () => {
    const map = createKeybindMap();
    map.addKeybind("normal", "\\a", {
      execute: (ctx) => [
        actions.cursorMove({ line: 0, col: 0 }),
        actions.registerWrite("z", "bookmark"),
        actions.markSet("b", ctx.cursor),
        actions.statusMessage("all done"),
      ],
    });

    const ctx = createTestContext({ cursor: { line: 5, col: 3 } });
    const buffer = new TextBuffer("test");

    const { ctx: newCtx, allActions } = pressKeys(["\\", "a"], ctx, buffer, map);

    expect(newCtx.cursor).toEqual({ line: 0, col: 0 });
    expect(newCtx.registers.z).toBe("bookmark");
    expect(newCtx.marks.b).toEqual({ line: 5, col: 3 });
    expect(newCtx.statusMessage).toBe("all done");
    expect(allActions).toHaveLength(4);
  });

  // --- Keybind does not interfere with existing operations when no keybinds match ---

  it("does not interfere with macros", () => {
    const map = createKeybindMap();
    map.addKeybind("normal", "\\i", { execute: () => [actions.noop()] });

    const ctx = createTestContext();
    const buffer = new TextBuffer("hello");

    // q should still start macro recording
    const r1 = processKeystroke("q", ctx, buffer, false, false, map);
    expect(r1.newCtx.phase).toBe("macro-register-pending");

    // a should record into register a
    const r2 = processKeystroke("a", r1.newCtx, buffer, false, false, map);
    expect(r2.newCtx.macroRecording).toBe("a");
  });

  // --- Remap with special keys ---

  it("remaps with Escape key in remap target", () => {
    const map = createKeybindMap();
    // Remap jk in insert mode to Escape (return to normal)
    map.addKeybind("insert", "jk", { keys: "<Esc>" });

    const ctx = createTestContext({ mode: "insert" });
    const buffer = new TextBuffer("test");

    const { ctx: newCtx } = pressKeys(["j", "k"], ctx, buffer, map);
    expect(newCtx.mode).toBe("normal");
  });

  it("remaps with Ctrl key in remap target", () => {
    const map = createKeybindMap();
    // Remap \\r to Ctrl-R (redo)
    map.addKeybind("normal", "\\r", { keys: "<C-r>" });

    const ctx = createTestContext();
    const buffer = new TextBuffer("hello");

    // Make a change first, then undo, then use our remap to redo
    // Delete 'h', undo, then redo via remap
    const r1 = processKeystroke("x", ctx, buffer); // delete 'h'
    const r2 = processKeystroke("u", r1.newCtx, buffer); // undo
    expect(buffer.getContent()).toBe("hello");

    pressKeys(["\\", "r"], r2.newCtx, buffer, map);
    expect(buffer.getContent()).toBe("ello"); // redo worked
  });

  // --- Visual mode keybind ---

  it("supports keybinds in visual mode", () => {
    const map = createKeybindMap();
    const executeFn = vi.fn(() => [actions.statusMessage("visual keybind")]);
    map.addKeybind("visual", "\\s", { execute: executeFn });

    const ctx = createTestContext({
      mode: "visual",
      visualAnchor: { line: 0, col: 0 },
    });
    const buffer = new TextBuffer("test");

    const { ctx: newCtx } = pressKeys(["\\", "s"], ctx, buffer, map);
    expect(executeFn).toHaveBeenCalledOnce();
    expect(newCtx.statusMessage).toBe("visual keybind");
  });
});

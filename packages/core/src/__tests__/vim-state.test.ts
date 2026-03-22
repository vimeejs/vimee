/**
 * vim-state.test.ts
 *
 * Tests for vim-state.ts utility functions and defensive code paths:
 * - parseCursorPosition: parsing "line:col" strings into CursorPosition
 * - processKeystrokeInner default case: unknown mode handling
 * - startMacroRecording: invalid register key cancellation
 */

import { describe, it, expect } from "vitest";
import type { VimContext, CursorPosition } from "../types";
import { processKeystroke, createInitialContext, parseCursorPosition } from "../vim-state";
import { TextBuffer } from "../buffer";

// =====================
// Helper functions
// =====================

/** Create a VimContext for testing */
function createTestContext(
  cursor: CursorPosition,
  overrides?: Partial<VimContext>,
): VimContext {
  return {
    ...createInitialContext(cursor),
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

describe("parseCursorPosition", () => {
  it("parses a valid '1:1' string to 0-based { line: 0, col: 0 }", () => {
    const pos = parseCursorPosition("1:1");
    expect(pos).toEqual({ line: 0, col: 0 });
  });

  it("parses '3:5' to { line: 2, col: 4 }", () => {
    const pos = parseCursorPosition("3:5");
    expect(pos).toEqual({ line: 2, col: 4 });
  });

  it("parses '10:20' to { line: 9, col: 19 }", () => {
    const pos = parseCursorPosition("10:20");
    expect(pos).toEqual({ line: 9, col: 19 });
  });

  it("defaults line to 0 when the line part is missing", () => {
    const pos = parseCursorPosition(":5");
    // parseInt(":5".split(":")[0], 10) => NaN => || 1 => 1 - 1 = 0
    expect(pos.line).toBe(0);
    expect(pos.col).toBe(4);
  });

  it("defaults col to 0 when the col part is missing", () => {
    const pos = parseCursorPosition("3:");
    // parseInt("", 10) => NaN => || 1 => 1 - 1 = 0
    expect(pos.line).toBe(2);
    expect(pos.col).toBe(0);
  });

  it("defaults both to 0 when given an empty string", () => {
    const pos = parseCursorPosition("");
    expect(pos).toEqual({ line: 0, col: 0 });
  });

  it("defaults col to 0 when no colon is present", () => {
    const pos = parseCursorPosition("5");
    // parts[1] is undefined => parseInt(undefined, 10) => NaN => || 1 => 0
    expect(pos.line).toBe(4);
    expect(pos.col).toBe(0);
  });

  it("clamps negative values to 0 (e.g., '0:0')", () => {
    // 0 - 1 = -1, clamped to 0 by Math.max(0, ...)
    const pos = parseCursorPosition("0:0");
    expect(pos).toEqual({ line: 0, col: 0 });
  });

  it("clamps negative values to 0 for negative inputs like '-1:-1'", () => {
    // parseInt("-1", 10) => -1, -1 - 1 = -2, clamped to 0
    const pos = parseCursorPosition("-1:-1");
    expect(pos).toEqual({ line: 0, col: 0 });
  });

  it("handles non-numeric strings by defaulting to 0", () => {
    const pos = parseCursorPosition("abc:def");
    // parseInt("abc", 10) => NaN => || 1 => 1 - 1 = 0
    expect(pos).toEqual({ line: 0, col: 0 });
  });
});

describe("processKeystroke default mode fallback", () => {
  it("returns the context unchanged when mode is unknown", () => {
    const buffer = new TextBuffer("hello");
    // Force an invalid mode by casting
    const ctx = createTestContext({ line: 0, col: 0 }, {
      mode: "nonexistent-mode" as VimContext["mode"],
    });
    const result = processKeystroke("j", ctx, buffer);
    // The default case returns { newCtx: ctx, actions: [] }
    expect(result.actions).toEqual([]);
    expect(result.newCtx.mode).toBe("nonexistent-mode");
    expect(result.newCtx.cursor).toEqual({ line: 0, col: 0 });
  });

  it("does not crash and returns no actions for any key with unknown mode", () => {
    const buffer = new TextBuffer("hello\nworld");
    const ctx = createTestContext({ line: 0, col: 0 }, {
      mode: "unknown" as VimContext["mode"],
    });
    const result = processKeystroke("x", ctx, buffer);
    expect(result.actions).toEqual([]);
    expect(result.newCtx.cursor).toEqual({ line: 0, col: 0 });
  });
});

describe("Macro recording with invalid register", () => {
  it("cancels macro recording when pressing q followed by a digit", () => {
    const buffer = new TextBuffer("hello world");
    const ctx = createTestContext({ line: 0, col: 0 });

    // Press q to enter macro-register-pending phase
    const r1 = processKeystroke("q", ctx, buffer);
    expect(r1.newCtx.phase).toBe("macro-register-pending");
    expect(r1.newCtx.macroRecording).toBeNull();

    // Press '1' (not a lowercase letter) - should cancel
    const r2 = processKeystroke("1", r1.newCtx, buffer);
    expect(r2.newCtx.phase).toBe("idle");
    expect(r2.newCtx.macroRecording).toBeNull();
    expect(r2.actions).toEqual([]);
  });

  it("cancels macro recording when pressing q followed by an uppercase letter", () => {
    const buffer = new TextBuffer("hello world");
    const ctx = createTestContext({ line: 0, col: 0 });

    // Press q to enter macro-register-pending phase
    const r1 = processKeystroke("q", ctx, buffer);
    expect(r1.newCtx.phase).toBe("macro-register-pending");

    // Press 'Q' (uppercase, not lowercase) - should cancel
    const r2 = processKeystroke("Q", r1.newCtx, buffer);
    expect(r2.newCtx.phase).toBe("idle");
    expect(r2.newCtx.macroRecording).toBeNull();
    expect(r2.actions).toEqual([]);
  });

  it("cancels macro recording when pressing q followed by a special character", () => {
    const buffer = new TextBuffer("hello world");
    const ctx = createTestContext({ line: 0, col: 0 });

    const r1 = processKeystroke("q", ctx, buffer);
    expect(r1.newCtx.phase).toBe("macro-register-pending");

    // Press '!' - should cancel
    const r2 = processKeystroke("!", r1.newCtx, buffer);
    expect(r2.newCtx.phase).toBe("idle");
    expect(r2.newCtx.macroRecording).toBeNull();
    expect(r2.actions).toEqual([]);
  });

  it("starts macro recording when pressing q followed by a valid lowercase letter", () => {
    const buffer = new TextBuffer("hello world");
    const ctx = createTestContext({ line: 0, col: 0 });

    // Press q to enter macro-register-pending phase
    const r1 = processKeystroke("q", ctx, buffer);
    expect(r1.newCtx.phase).toBe("macro-register-pending");

    // Press 'a' (valid lowercase letter) - should start recording
    const r2 = processKeystroke("a", r1.newCtx, buffer);
    expect(r2.newCtx.phase).toBe("idle");
    expect(r2.newCtx.macroRecording).toBe("a");
    expect(r2.newCtx.statusMessage).toBe("recording @a");
  });
});

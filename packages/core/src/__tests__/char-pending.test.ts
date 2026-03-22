/**
 * char-pending.test.ts
 *
 * Tests for character-pending command handling (f, F, t, T, r).
 * Includes tests for defensive code paths (lines 50, 156) where
 * resolveCharMotion returns null via the default switch case.
 */

import { describe, it, expect } from "vitest";
import { handleCharPending } from "../char-pending";
import { createInitialContext } from "../vim-state";
import { TextBuffer } from "../buffer";
import type { VimContext } from "../types";

// Helper: create a context in char-pending phase with a given charCommand
function createCharPendingCtx(charCommand: string, cursor = { line: 0, col: 0 }): VimContext {
  return {
    ...createInitialContext(cursor),
    phase: "char-pending",
    charCommand: charCommand as VimContext["charCommand"],
  };
}

describe("handleCharPending", () => {
  // ---------------------------------------------------
  // Lines 50 and 156: resolveCharMotion default case returns null
  //
  // The charCommand type is "f"|"F"|"t"|"T"|"r", and "r" is handled
  // before resolveCharMotion is called. So the default case (line 156)
  // returning null, and the !motion branch (line 50), are unreachable
  // through normal typed code paths.
  //
  // We force these paths by casting an invalid charCommand value.
  // ---------------------------------------------------
  it("returns reset context with no actions when charCommand is unrecognized (lines 50, 156)", () => {
    const buffer = new TextBuffer("hello world");
    // Cast an invalid charCommand to force the default branch in resolveCharMotion
    const ctx = createCharPendingCtx("x" as never, { line: 0, col: 0 });
    const result = handleCharPending("a", ctx, buffer);
    expect(result.newCtx.phase).toBe("idle");
    expect(result.newCtx.charCommand).toBeNull();
    expect(result.actions).toEqual([]);
  });

  it("f{char} moves cursor to the character on the line", () => {
    const buffer = new TextBuffer("hello world");
    const ctx = createCharPendingCtx("f", { line: 0, col: 0 });
    const result = handleCharPending("w", ctx, buffer);
    expect(result.newCtx.cursor).toEqual({ line: 0, col: 6 });
    expect(result.newCtx.lastCharSearch).toEqual({ command: "f", char: "w" });
  });

  it("F{char} moves cursor backward to the character on the line", () => {
    const buffer = new TextBuffer("hello world");
    const ctx = createCharPendingCtx("F", { line: 0, col: 10 });
    const result = handleCharPending("o", ctx, buffer);
    expect(result.newCtx.cursor).toEqual({ line: 0, col: 7 });
    expect(result.newCtx.lastCharSearch).toEqual({ command: "F", char: "o" });
  });

  it("t{char} moves cursor to just before the character", () => {
    const buffer = new TextBuffer("hello world");
    const ctx = createCharPendingCtx("t", { line: 0, col: 0 });
    const result = handleCharPending("w", ctx, buffer);
    expect(result.newCtx.cursor).toEqual({ line: 0, col: 5 });
  });

  it("T{char} moves cursor to just after the character backward", () => {
    const buffer = new TextBuffer("hello world");
    const ctx = createCharPendingCtx("T", { line: 0, col: 10 });
    const result = handleCharPending("o", ctx, buffer);
    expect(result.newCtx.cursor).toEqual({ line: 0, col: 8 });
  });

  // ---------------------------------------------------
  // Branch coverage: lines 80 branch 0, 87 branch 0
  // change operator + char motion → enters insert mode
  // cfa: change forward to 'a' (operator = "c", charCommand = "f")
  // ---------------------------------------------------
  it("cfa changes forward to 'a' and enters insert mode (lines 80, 87)", () => {
    const buffer = new TextBuffer("hello a world");
    const ctx: VimContext = {
      ...createCharPendingCtx("f", { line: 0, col: 0 }),
      operator: "c",
    };
    const result = handleCharPending("a", ctx, buffer);
    expect(result.newCtx.mode).toBe("insert");
    expect(result.newCtx.statusMessage).toBe("-- INSERT --");
    // mode-change action should be emitted since mode changed from normal to insert
    expect(result.actions.some((a: { type: string }) => a.type === "mode-change")).toBe(true);
  });
});

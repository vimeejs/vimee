/**
 * actions.test.ts
 *
 * Tests for VimAction helper functions.
 */

import { describe, it, expect } from "vitest";
import { actions } from "../actions";
import type { VimContext } from "../types";
import { createInitialContext } from "../vim-state";

function createCtx(line: number, col: number): VimContext {
  return createInitialContext({ line, col });
}

describe("actions helpers", () => {
  it("cursorMove creates a cursor-move action", () => {
    const action = actions.cursorMove({ line: 5, col: 3 });
    expect(action).toEqual({ type: "cursor-move", position: { line: 5, col: 3 } });
  });

  it("cursorRelative creates a relative cursor-move action", () => {
    const ctx = createCtx(10, 5);
    const action = actions.cursorRelative(ctx, -3, 2);
    expect(action).toEqual({ type: "cursor-move", position: { line: 7, col: 7 } });
  });

  it("cursorRelative clamps to 0", () => {
    const ctx = createCtx(1, 1);
    const action = actions.cursorRelative(ctx, -5, -5);
    expect(action).toEqual({ type: "cursor-move", position: { line: 0, col: 0 } });
  });

  it("cursorRelative defaults deltaCol to 0", () => {
    const ctx = createCtx(5, 3);
    const action = actions.cursorRelative(ctx, 2);
    expect(action).toEqual({ type: "cursor-move", position: { line: 7, col: 3 } });
  });

  it("modeChange creates a mode-change action", () => {
    expect(actions.modeChange("insert")).toEqual({ type: "mode-change", mode: "insert" });
    expect(actions.modeChange("normal")).toEqual({ type: "mode-change", mode: "normal" });
    expect(actions.modeChange("visual")).toEqual({ type: "mode-change", mode: "visual" });
  });

  it("contentChange creates a content-change action", () => {
    expect(actions.contentChange("hello\nworld")).toEqual({
      type: "content-change",
      content: "hello\nworld",
    });
  });

  it("statusMessage creates a status-message action", () => {
    expect(actions.statusMessage("saved")).toEqual({
      type: "status-message",
      message: "saved",
    });
  });

  it("registerWrite creates a register-write action", () => {
    expect(actions.registerWrite("a", "text")).toEqual({
      type: "register-write",
      register: "a",
      text: "text",
    });
  });

  it("markSet creates a mark-set action", () => {
    expect(actions.markSet("a", { line: 3, col: 0 })).toEqual({
      type: "mark-set",
      name: "a",
      position: { line: 3, col: 0 },
    });
  });

  it("yank creates a yank action", () => {
    expect(actions.yank("copied text")).toEqual({
      type: "yank",
      text: "copied text",
    });
  });

  it("noop creates a noop action", () => {
    expect(actions.noop()).toEqual({ type: "noop" });
  });
});

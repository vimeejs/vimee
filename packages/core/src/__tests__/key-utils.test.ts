import { describe, it, expect } from "vitest";
import type { VimContext } from "../types";
import {
  isCountKey,
  isOperator,
  isCharCommand,
  getEffectiveCount,
  isCountExplicit,
  modeChange,
  getModeStatusMessage,
  accumulateCount,
  resetContext,
} from "../key-utils";

function createCtx(overrides: Partial<VimContext> = {}): VimContext {
  return {
    mode: "normal",
    phase: "idle",
    count: 0,
    operator: null,
    cursor: { line: 0, col: 0 },
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
    statusMessage: "",
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
    viewportHeight: 50,
    ...overrides,
  };
}

// ---------- isCountKey ----------

describe("isCountKey", () => {
  it("returns true for digits 1-9 when count is 0", () => {
    const ctx = createCtx({ count: 0 });
    for (const digit of ["1", "2", "3", "4", "5", "6", "7", "8", "9"]) {
      expect(isCountKey(digit, ctx)).toBe(true);
    }
  });

  it("returns true for digits 1-9 when count is already positive", () => {
    const ctx = createCtx({ count: 3 });
    for (const digit of ["1", "2", "3", "4", "5", "6", "7", "8", "9"]) {
      expect(isCountKey(digit, ctx)).toBe(true);
    }
  });

  it("returns false for 0 when count is 0 (0 is a motion, not a count digit)", () => {
    const ctx = createCtx({ count: 0 });
    expect(isCountKey("0", ctx)).toBe(false);
  });

  it("returns true for 0 when count is already positive", () => {
    const ctx = createCtx({ count: 1 });
    expect(isCountKey("0", ctx)).toBe(true);
  });

  it("returns true for 0 when count is a large number", () => {
    const ctx = createCtx({ count: 99 });
    expect(isCountKey("0", ctx)).toBe(true);
  });

  it("returns false for non-digit keys", () => {
    const ctx = createCtx({ count: 0 });
    for (const key of ["a", "z", "d", "w", " ", "Enter", "Escape", ".", "-"]) {
      expect(isCountKey(key, ctx)).toBe(false);
    }
  });

  it("returns false for non-digit keys even when count is positive", () => {
    const ctx = createCtx({ count: 5 });
    for (const key of ["a", "w", "d", "Escape"]) {
      expect(isCountKey(key, ctx)).toBe(false);
    }
  });
});

// ---------- isOperator ----------

describe("isOperator", () => {
  it("returns true for d (delete)", () => {
    expect(isOperator("d")).toBe(true);
  });

  it("returns true for y (yank)", () => {
    expect(isOperator("y")).toBe(true);
  });

  it("returns true for c (change)", () => {
    expect(isOperator("c")).toBe(true);
  });

  it("returns true for > (indent)", () => {
    expect(isOperator(">")).toBe(true);
  });

  it("returns true for < (outdent)", () => {
    expect(isOperator("<")).toBe(true);
  });

  it("returns false for non-operator keys", () => {
    for (const key of [
      "a", "b", "e", "f", "g", "h", "i", "j", "k", "l",
      "m", "n", "o", "p", "q", "r", "s", "t", "u", "v",
      "w", "x", "z", "D", "Y", "C", "1", "0", " ", "Enter",
    ]) {
      expect(isOperator(key)).toBe(false);
    }
  });
});

// ---------- isCharCommand ----------

describe("isCharCommand", () => {
  it("returns true for f (forward char search)", () => {
    expect(isCharCommand("f")).toBe(true);
  });

  it("returns true for F (backward char search)", () => {
    expect(isCharCommand("F")).toBe(true);
  });

  it("returns true for t (forward char search, stop before)", () => {
    expect(isCharCommand("t")).toBe(true);
  });

  it("returns true for T (backward char search, stop after)", () => {
    expect(isCharCommand("T")).toBe(true);
  });

  it("returns true for r (single char replace)", () => {
    expect(isCharCommand("r")).toBe(true);
  });

  it("returns false for non-char-command keys", () => {
    for (const key of [
      "a", "b", "c", "d", "e", "g", "h", "i", "j", "k", "l",
      "m", "n", "o", "p", "q", "s", "u", "v", "w", "x", "y", "z",
      "G", "R", "1", " ", "Enter",
    ]) {
      expect(isCharCommand(key)).toBe(false);
    }
  });
});

// ---------- getEffectiveCount ----------

describe("getEffectiveCount", () => {
  it("returns 1 when count is 0 (no explicit count)", () => {
    const ctx = createCtx({ count: 0 });
    expect(getEffectiveCount(ctx)).toBe(1);
  });

  it("returns the count itself when count is 1", () => {
    const ctx = createCtx({ count: 1 });
    expect(getEffectiveCount(ctx)).toBe(1);
  });

  it("returns the count itself when count is 5", () => {
    const ctx = createCtx({ count: 5 });
    expect(getEffectiveCount(ctx)).toBe(5);
  });

  it("returns the count itself for a large count", () => {
    const ctx = createCtx({ count: 100 });
    expect(getEffectiveCount(ctx)).toBe(100);
  });
});

// ---------- isCountExplicit ----------

describe("isCountExplicit", () => {
  it("returns false when count is 0", () => {
    const ctx = createCtx({ count: 0 });
    expect(isCountExplicit(ctx)).toBe(false);
  });

  it("returns true when count is 1", () => {
    const ctx = createCtx({ count: 1 });
    expect(isCountExplicit(ctx)).toBe(true);
  });

  it("returns true when count is greater than 1", () => {
    const ctx = createCtx({ count: 10 });
    expect(isCountExplicit(ctx)).toBe(true);
  });
});

// ---------- modeChange ----------

describe("modeChange", () => {
  it("transitions to insert mode with correct status message", () => {
    const ctx = createCtx();
    const result = modeChange(ctx, "insert");
    expect(result.newCtx.mode).toBe("insert");
    expect(result.newCtx.statusMessage).toBe("-- INSERT --");
    expect(result.newCtx.phase).toBe("idle");
    expect(result.newCtx.count).toBe(0);
    expect(result.newCtx.operator).toBeNull();
  });

  it("transitions to visual mode with correct status message", () => {
    const ctx = createCtx();
    const result = modeChange(ctx, "visual");
    expect(result.newCtx.mode).toBe("visual");
    expect(result.newCtx.statusMessage).toBe("-- VISUAL --");
  });

  it("transitions to visual-line mode with correct status message", () => {
    const ctx = createCtx();
    const result = modeChange(ctx, "visual-line");
    expect(result.newCtx.mode).toBe("visual-line");
    expect(result.newCtx.statusMessage).toBe("-- VISUAL LINE --");
  });

  it("transitions to visual-block mode with correct status message", () => {
    const ctx = createCtx();
    const result = modeChange(ctx, "visual-block");
    expect(result.newCtx.mode).toBe("visual-block");
    expect(result.newCtx.statusMessage).toBe("-- VISUAL BLOCK --");
  });

  it("transitions to normal mode with empty status message", () => {
    const ctx = createCtx({ mode: "insert", statusMessage: "-- INSERT --" });
    const result = modeChange(ctx, "normal");
    expect(result.newCtx.mode).toBe("normal");
    expect(result.newCtx.statusMessage).toBe("");
  });

  it("emits a mode-change action", () => {
    const ctx = createCtx();
    const result = modeChange(ctx, "insert");
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]).toEqual({ type: "mode-change", mode: "insert" });
  });

  it("resets count and operator on mode change", () => {
    const ctx = createCtx({ count: 5, operator: "d", phase: "operator-pending" });
    const result = modeChange(ctx, "insert");
    expect(result.newCtx.count).toBe(0);
    expect(result.newCtx.operator).toBeNull();
    expect(result.newCtx.phase).toBe("idle");
  });

  it("preserves other context fields not affected by mode change", () => {
    const ctx = createCtx({
      cursor: { line: 3, col: 5 },
      register: "hello",
      lastSearch: "pattern",
    });
    const result = modeChange(ctx, "visual");
    expect(result.newCtx.cursor).toEqual({ line: 3, col: 5 });
    expect(result.newCtx.register).toBe("hello");
    expect(result.newCtx.lastSearch).toBe("pattern");
  });

  it("transitions to command-line mode with empty status message", () => {
    const ctx = createCtx();
    const result = modeChange(ctx, "command-line");
    expect(result.newCtx.mode).toBe("command-line");
    expect(result.newCtx.statusMessage).toBe("");
  });
});

// ---------- getModeStatusMessage ----------

describe("getModeStatusMessage", () => {
  it("returns '-- INSERT --' for insert mode", () => {
    expect(getModeStatusMessage("insert")).toBe("-- INSERT --");
  });

  it("returns '-- VISUAL --' for visual mode", () => {
    expect(getModeStatusMessage("visual")).toBe("-- VISUAL --");
  });

  it("returns '-- VISUAL LINE --' for visual-line mode", () => {
    expect(getModeStatusMessage("visual-line")).toBe("-- VISUAL LINE --");
  });

  it("returns '-- VISUAL BLOCK --' for visual-block mode", () => {
    expect(getModeStatusMessage("visual-block")).toBe("-- VISUAL BLOCK --");
  });

  it("returns empty string for normal mode", () => {
    expect(getModeStatusMessage("normal")).toBe("");
  });

  it("returns empty string for command-line mode", () => {
    expect(getModeStatusMessage("command-line")).toBe("");
  });
});

// ---------- accumulateCount ----------

describe("accumulateCount", () => {
  it("sets count to the digit when count was 0", () => {
    const ctx = createCtx({ count: 0 });
    const result = accumulateCount("5", ctx);
    expect(result.newCtx.count).toBe(5);
  });

  it("appends a digit to an existing count (count=3, key=2 -> 32)", () => {
    const ctx = createCtx({ count: 3 });
    const result = accumulateCount("2", ctx);
    expect(result.newCtx.count).toBe(32);
  });

  it("builds a multi-digit count (1 -> 12 -> 123)", () => {
    let ctx = createCtx({ count: 0 });
    let result = accumulateCount("1", ctx);
    expect(result.newCtx.count).toBe(1);

    result = accumulateCount("2", result.newCtx);
    expect(result.newCtx.count).toBe(12);

    result = accumulateCount("3", result.newCtx);
    expect(result.newCtx.count).toBe(123);
  });

  it("appending 0 to an existing count multiplies by 10", () => {
    const ctx = createCtx({ count: 5 });
    const result = accumulateCount("0", ctx);
    expect(result.newCtx.count).toBe(50);
  });

  it("returns empty actions array", () => {
    const ctx = createCtx({ count: 0 });
    const result = accumulateCount("7", ctx);
    expect(result.actions).toEqual([]);
  });

  it("preserves other context fields", () => {
    const ctx = createCtx({
      count: 1,
      mode: "visual",
      operator: "d",
      cursor: { line: 2, col: 3 },
    });
    const result = accumulateCount("5", ctx);
    expect(result.newCtx.mode).toBe("visual");
    expect(result.newCtx.operator).toBe("d");
    expect(result.newCtx.cursor).toEqual({ line: 2, col: 3 });
  });
});

// ---------- resetContext ----------

describe("resetContext", () => {
  it("resets phase to idle", () => {
    const ctx = createCtx({ phase: "operator-pending" });
    const result = resetContext(ctx);
    expect(result.phase).toBe("idle");
  });

  it("resets count to 0", () => {
    const ctx = createCtx({ count: 42 });
    const result = resetContext(ctx);
    expect(result.count).toBe(0);
  });

  it("resets operator to null", () => {
    const ctx = createCtx({ operator: "d" });
    const result = resetContext(ctx);
    expect(result.operator).toBeNull();
  });

  it("resets charCommand to null", () => {
    const ctx = createCtx({ charCommand: "f" });
    const result = resetContext(ctx);
    expect(result.charCommand).toBeNull();
  });

  it("resets textObjectModifier to null", () => {
    const ctx = createCtx({ textObjectModifier: "i" });
    const result = resetContext(ctx);
    expect(result.textObjectModifier).toBeNull();
  });

  it("resets selectedRegister to null", () => {
    const ctx = createCtx({ selectedRegister: "a" });
    const result = resetContext(ctx);
    expect(result.selectedRegister).toBeNull();
  });

  it("resets statusMessage to empty string", () => {
    const ctx = createCtx({ statusMessage: "-- INSERT --" });
    const result = resetContext(ctx);
    expect(result.statusMessage).toBe("");
  });

  it("preserves mode", () => {
    const ctx = createCtx({ mode: "visual" });
    const result = resetContext(ctx);
    expect(result.mode).toBe("visual");
  });

  it("preserves cursor position", () => {
    const ctx = createCtx({ cursor: { line: 5, col: 10 } });
    const result = resetContext(ctx);
    expect(result.cursor).toEqual({ line: 5, col: 10 });
  });

  it("preserves register contents", () => {
    const ctx = createCtx({ register: "yanked text", registers: { a: "reg a" } });
    const result = resetContext(ctx);
    expect(result.register).toBe("yanked text");
    expect(result.registers).toEqual({ a: "reg a" });
  });

  it("preserves lastSearch and searchDirection", () => {
    const ctx = createCtx({ lastSearch: "foo", searchDirection: "backward" });
    const result = resetContext(ctx);
    expect(result.lastSearch).toBe("foo");
    expect(result.searchDirection).toBe("backward");
  });

  it("preserves lastCharSearch", () => {
    const ctx = createCtx({ lastCharSearch: { command: "f", char: "x" } });
    const result = resetContext(ctx);
    expect(result.lastCharSearch).toEqual({ command: "f", char: "x" });
  });

  it("resets all fields at once when multiple are set", () => {
    const ctx = createCtx({
      phase: "char-pending",
      count: 10,
      operator: "c",
      charCommand: "t",
      textObjectModifier: "a",
      selectedRegister: "b",
      statusMessage: "some message",
    });
    const result = resetContext(ctx);
    expect(result.phase).toBe("idle");
    expect(result.count).toBe(0);
    expect(result.operator).toBeNull();
    expect(result.charCommand).toBeNull();
    expect(result.textObjectModifier).toBeNull();
    expect(result.selectedRegister).toBeNull();
    expect(result.statusMessage).toBe("");
  });
});

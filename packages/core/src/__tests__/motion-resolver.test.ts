import { describe, it, expect } from "vitest";
import { TextBuffer } from "../buffer";
import { resolveMotion } from "../motion-resolver";
import type { VimContext } from "../types";

// Helper: create a TextBuffer from an array of lines
function buf(lines: string[]): TextBuffer {
  return new TextBuffer(lines.join("\n"));
}

// Helper: concisely create a cursor position
function cur(line: number, col: number) {
  return { line, col };
}

// Helper: create a minimal VimContext for viewport-dependent motions
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

// ---------- Basic movement: h / ArrowLeft ----------

describe("resolveMotion: h and ArrowLeft", () => {
  it("h moves cursor left by count", () => {
    const b = buf(["hello"]);
    const result = resolveMotion("h", cur(0, 3), b, 1, false);
    expect(result).not.toBeNull();
    expect(result!.cursor).toEqual(cur(0, 2));
  });

  it("h moves left by count=2", () => {
    const b = buf(["hello"]);
    const result = resolveMotion("h", cur(0, 4), b, 2, false);
    expect(result!.cursor).toEqual(cur(0, 2));
  });

  it("h clamps at column 0", () => {
    const b = buf(["hello"]);
    const result = resolveMotion("h", cur(0, 1), b, 10, false);
    expect(result!.cursor).toEqual(cur(0, 0));
  });

  it("ArrowLeft behaves the same as h", () => {
    const b = buf(["hello"]);
    const result = resolveMotion("ArrowLeft", cur(0, 3), b, 1, false);
    expect(result).not.toBeNull();
    expect(result!.cursor).toEqual(cur(0, 2));
  });

  it("ArrowLeft clamps at column 0", () => {
    const b = buf(["hello"]);
    const result = resolveMotion("ArrowLeft", cur(0, 0), b, 1, false);
    expect(result!.cursor).toEqual(cur(0, 0));
  });
});

// ---------- Basic movement: j / ArrowDown ----------

describe("resolveMotion: j and ArrowDown", () => {
  it("j moves cursor down by count", () => {
    const b = buf(["hello", "world"]);
    const result = resolveMotion("j", cur(0, 2), b, 1, false);
    expect(result).not.toBeNull();
    expect(result!.cursor).toEqual(cur(1, 2));
  });

  it("j clamps at last line", () => {
    const b = buf(["hello", "world"]);
    const result = resolveMotion("j", cur(0, 0), b, 10, false);
    expect(result!.cursor.line).toBe(1);
  });

  it("j clamps col when target line is shorter", () => {
    const b = buf(["hello world", "hi"]);
    const result = resolveMotion("j", cur(0, 8), b, 1, false);
    expect(result!.cursor).toEqual(cur(1, 1));
  });

  it("j returns linewise range", () => {
    const b = buf(["hello", "world"]);
    const result = resolveMotion("j", cur(0, 0), b, 1, false);
    expect(result!.range.linewise).toBe(true);
  });

  it("ArrowDown behaves the same as j", () => {
    const b = buf(["hello", "world"]);
    const result = resolveMotion("ArrowDown", cur(0, 2), b, 1, false);
    expect(result).not.toBeNull();
    expect(result!.cursor).toEqual(cur(1, 2));
  });
});

// ---------- Basic movement: k / ArrowUp ----------

describe("resolveMotion: k and ArrowUp", () => {
  it("k moves cursor up by count", () => {
    const b = buf(["hello", "world"]);
    const result = resolveMotion("k", cur(1, 2), b, 1, false);
    expect(result).not.toBeNull();
    expect(result!.cursor).toEqual(cur(0, 2));
  });

  it("k clamps at first line", () => {
    const b = buf(["hello", "world"]);
    const result = resolveMotion("k", cur(1, 0), b, 10, false);
    expect(result!.cursor.line).toBe(0);
  });

  it("k clamps col when target line is shorter", () => {
    const b = buf(["hi", "hello world"]);
    const result = resolveMotion("k", cur(1, 8), b, 1, false);
    expect(result!.cursor).toEqual(cur(0, 1));
  });

  it("k returns linewise range", () => {
    const b = buf(["hello", "world"]);
    const result = resolveMotion("k", cur(1, 0), b, 1, false);
    expect(result!.range.linewise).toBe(true);
  });

  it("ArrowUp behaves the same as k", () => {
    const b = buf(["hello", "world"]);
    const result = resolveMotion("ArrowUp", cur(1, 2), b, 1, false);
    expect(result).not.toBeNull();
    expect(result!.cursor).toEqual(cur(0, 2));
  });
});

// ---------- Basic movement: l / ArrowRight ----------

describe("resolveMotion: l and ArrowRight", () => {
  it("l moves cursor right by count", () => {
    const b = buf(["hello"]);
    const result = resolveMotion("l", cur(0, 0), b, 1, false);
    expect(result).not.toBeNull();
    expect(result!.cursor).toEqual(cur(0, 1));
  });

  it("l clamps at end of line", () => {
    const b = buf(["hello"]);
    const result = resolveMotion("l", cur(0, 3), b, 10, false);
    expect(result!.cursor).toEqual(cur(0, 4));
  });

  it("l does not move on empty line", () => {
    const b = buf([""]);
    const result = resolveMotion("l", cur(0, 0), b, 1, false);
    expect(result!.cursor).toEqual(cur(0, 0));
  });

  it("ArrowRight behaves the same as l", () => {
    const b = buf(["hello"]);
    const result = resolveMotion("ArrowRight", cur(0, 0), b, 1, false);
    expect(result).not.toBeNull();
    expect(result!.cursor).toEqual(cur(0, 1));
  });

  it("ArrowRight clamps at end of line", () => {
    const b = buf(["hi"]);
    const result = resolveMotion("ArrowRight", cur(0, 1), b, 1, false);
    expect(result!.cursor).toEqual(cur(0, 1));
  });
});

// ---------- Word motions: w ----------

describe("resolveMotion: w (word forward)", () => {
  it("moves to the beginning of the next word", () => {
    const b = buf(["hello world"]);
    const result = resolveMotion("w", cur(0, 0), b, 1, false);
    expect(result).not.toBeNull();
    expect(result!.cursor).toEqual(cur(0, 6));
  });

  it("treats punctuation as a separate word", () => {
    const b = buf(["foo.bar"]);
    const result = resolveMotion("w", cur(0, 0), b, 1, false);
    expect(result!.cursor).toEqual(cur(0, 3));
  });

  it("moves across lines", () => {
    const b = buf(["hello", "world"]);
    const result = resolveMotion("w", cur(0, 0), b, 2, false);
    expect(result!.cursor).toEqual(cur(1, 0));
  });

  it("returns non-linewise, non-inclusive range", () => {
    const b = buf(["hello world"]);
    const result = resolveMotion("w", cur(0, 0), b, 1, false);
    expect(result!.range.linewise).toBe(false);
    expect(result!.range.inclusive).toBe(false);
  });
});

// ---------- Word motions: e ----------

describe("resolveMotion: e (word end)", () => {
  it("moves to the end of the current word", () => {
    const b = buf(["hello world"]);
    const result = resolveMotion("e", cur(0, 0), b, 1, false);
    expect(result).not.toBeNull();
    expect(result!.cursor).toEqual(cur(0, 4));
  });

  it("moves to the end of the next word when at word end", () => {
    const b = buf(["hello world"]);
    const result = resolveMotion("e", cur(0, 4), b, 1, false);
    expect(result!.cursor).toEqual(cur(0, 10));
  });

  it("moves across lines", () => {
    const b = buf(["hello", "world"]);
    const result = resolveMotion("e", cur(0, 4), b, 1, false);
    expect(result!.cursor).toEqual(cur(1, 4));
  });

  it("returns inclusive range", () => {
    const b = buf(["hello world"]);
    const result = resolveMotion("e", cur(0, 0), b, 1, false);
    expect(result!.range.inclusive).toBe(true);
  });
});

// ---------- Word motions: b ----------

describe("resolveMotion: b (word backward)", () => {
  it("moves to the beginning of the previous word", () => {
    const b = buf(["hello world"]);
    const result = resolveMotion("b", cur(0, 8), b, 1, false);
    expect(result).not.toBeNull();
    expect(result!.cursor).toEqual(cur(0, 6));
  });

  it("moves backward across lines", () => {
    const b = buf(["hello", "world"]);
    const result = resolveMotion("b", cur(1, 0), b, 1, false);
    expect(result!.cursor).toEqual(cur(0, 0));
  });

  it("does not go past the beginning", () => {
    const b = buf(["hello"]);
    const result = resolveMotion("b", cur(0, 0), b, 1, false);
    expect(result!.cursor).toEqual(cur(0, 0));
  });
});

// ---------- Word motions: W (WORD forward) ----------

describe("resolveMotion: W (WORD forward)", () => {
  it("treats punctuation as part of the WORD", () => {
    const b = buf(["foo.bar baz"]);
    const result = resolveMotion("W", cur(0, 0), b, 1, false);
    expect(result).not.toBeNull();
    expect(result!.cursor).toEqual(cur(0, 8));
  });

  it("moves across lines", () => {
    const b = buf(["hello", "world"]);
    const result = resolveMotion("W", cur(0, 0), b, 1, false);
    expect(result!.cursor).toEqual(cur(1, 0));
  });

  it("stays at end of file when no more WORDs", () => {
    const b = buf(["hello"]);
    const result = resolveMotion("W", cur(0, 0), b, 1, false);
    expect(result!.cursor).toEqual(cur(0, 0));
  });
});

// ---------- Word motions: B (WORD backward) ----------

describe("resolveMotion: B (WORD backward)", () => {
  it("treats punctuation as part of the WORD backwards", () => {
    const b = buf(["foo.bar baz"]);
    const result = resolveMotion("B", cur(0, 8), b, 1, false);
    expect(result).not.toBeNull();
    expect(result!.cursor).toEqual(cur(0, 0));
  });

  it("moves backward across lines", () => {
    const b = buf(["hello", "world"]);
    const result = resolveMotion("B", cur(1, 0), b, 1, false);
    expect(result!.cursor).toEqual(cur(0, 0));
  });

  it("stays at beginning of file", () => {
    const b = buf(["hello"]);
    const result = resolveMotion("B", cur(0, 0), b, 1, false);
    expect(result!.cursor).toEqual(cur(0, 0));
  });
});

// ---------- Line motions: 0 ----------

describe("resolveMotion: 0 (beginning of line)", () => {
  it("moves to column 0", () => {
    const b = buf(["  hello"]);
    const result = resolveMotion("0", cur(0, 5), b, 1, false);
    expect(result).not.toBeNull();
    expect(result!.cursor).toEqual(cur(0, 0));
  });

  it("does nothing when already at column 0", () => {
    const b = buf(["hello"]);
    const result = resolveMotion("0", cur(0, 0), b, 1, false);
    expect(result!.cursor).toEqual(cur(0, 0));
  });

  it("range is non-linewise, non-inclusive", () => {
    const b = buf(["hello"]);
    const result = resolveMotion("0", cur(0, 3), b, 1, false);
    expect(result!.range.linewise).toBe(false);
    expect(result!.range.inclusive).toBe(false);
  });
});

// ---------- Line motions: ^ ----------

describe("resolveMotion: ^ (first non-blank)", () => {
  it("moves to the first non-whitespace character", () => {
    const b = buf(["  hello"]);
    const result = resolveMotion("^", cur(0, 5), b, 1, false);
    expect(result).not.toBeNull();
    expect(result!.cursor).toEqual(cur(0, 2));
  });

  it("moves to column 0 when line has no leading whitespace", () => {
    const b = buf(["hello"]);
    const result = resolveMotion("^", cur(0, 3), b, 1, false);
    expect(result!.cursor).toEqual(cur(0, 0));
  });

  it("moves to column 0 on an empty line", () => {
    const b = buf([""]);
    const result = resolveMotion("^", cur(0, 0), b, 1, false);
    expect(result!.cursor).toEqual(cur(0, 0));
  });

  it("range is inclusive", () => {
    const b = buf(["  hello"]);
    const result = resolveMotion("^", cur(0, 5), b, 1, false);
    expect(result!.range.inclusive).toBe(true);
  });
});

// ---------- Line motions: $ ----------

describe("resolveMotion: $ (end of line)", () => {
  it("moves to the last character of the line", () => {
    const b = buf(["hello"]);
    const result = resolveMotion("$", cur(0, 0), b, 1, false);
    expect(result).not.toBeNull();
    expect(result!.cursor).toEqual(cur(0, 4));
  });

  it("stays at col=0 on an empty line", () => {
    const b = buf([""]);
    const result = resolveMotion("$", cur(0, 0), b, 1, false);
    expect(result!.cursor).toEqual(cur(0, 0));
  });

  it("does nothing when already at end of line", () => {
    const b = buf(["hello"]);
    const result = resolveMotion("$", cur(0, 4), b, 1, false);
    expect(result!.cursor).toEqual(cur(0, 4));
  });

  it("range is inclusive", () => {
    const b = buf(["hello"]);
    const result = resolveMotion("$", cur(0, 0), b, 1, false);
    expect(result!.range.inclusive).toBe(true);
  });

  it("range end is at lineLength (exclusive end for operators)", () => {
    const b = buf(["hello"]);
    const result = resolveMotion("$", cur(0, 1), b, 1, false);
    expect(result!.range.end).toEqual(cur(0, 5));
  });
});

// ---------- File motions: G ----------

describe("resolveMotion: G (go to line / end of file)", () => {
  it("moves to the last line when countExplicit is false", () => {
    const b = buf(["first", "second", "  third"]);
    const result = resolveMotion("G", cur(0, 0), b, 1, false);
    expect(result).not.toBeNull();
    expect(result!.cursor.line).toBe(2);
  });

  it("moves to firstNonBlank on the last line", () => {
    const b = buf(["first", "  last"]);
    const result = resolveMotion("G", cur(0, 0), b, 1, false);
    expect(result!.cursor).toEqual(cur(1, 2));
  });

  it("moves to a specific line when countExplicit is true", () => {
    const b = buf(["line1", "line2", "line3"]);
    const result = resolveMotion("G", cur(2, 0), b, 1, true);
    expect(result!.cursor.line).toBe(0);
  });

  it("moves to line 2 (1-based) when count=2 and countExplicit is true", () => {
    const b = buf(["line1", "  line2", "line3"]);
    const result = resolveMotion("G", cur(0, 0), b, 2, true);
    expect(result!.cursor).toEqual(cur(1, 2));
  });

  it("clamps when count exceeds line count", () => {
    const b = buf(["a", "b"]);
    const result = resolveMotion("G", cur(0, 0), b, 100, true);
    expect(result!.cursor.line).toBe(1);
  });

  it("returns linewise range", () => {
    const b = buf(["a", "b", "c"]);
    const result = resolveMotion("G", cur(0, 0), b, 1, false);
    expect(result!.range.linewise).toBe(true);
    expect(result!.range.inclusive).toBe(true);
  });

  it("range is correct when moving downward", () => {
    const b = buf(["a", "b", "c"]);
    const result = resolveMotion("G", cur(0, 0), b, 1, false);
    expect(result!.range.start.line).toBe(0);
    expect(result!.range.end.line).toBe(2);
  });

  it("range is correct when moving upward with explicit count", () => {
    const b = buf(["a", "b", "c"]);
    const result = resolveMotion("G", cur(2, 0), b, 1, true);
    expect(result!.range.start.line).toBe(0);
    expect(result!.range.end.line).toBe(2);
  });
});

// ---------- Screen motions: H ----------

describe("resolveMotion: H (top of viewport)", () => {
  it("moves to the top of the viewport with default ctx", () => {
    const b = buf(Array.from({ length: 100 }, (_, i) => `line ${i}`));
    const ctx = createCtx({ viewportTopLine: 10, viewportHeight: 50 });
    const result = resolveMotion("H", cur(30, 0), b, 1, false, ctx);
    expect(result).not.toBeNull();
    expect(result!.cursor.line).toBe(10);
  });

  it("with count, moves to Nth line from top of viewport", () => {
    const b = buf(Array.from({ length: 100 }, (_, i) => `line ${i}`));
    const ctx = createCtx({ viewportTopLine: 10, viewportHeight: 50 });
    const result = resolveMotion("H", cur(30, 0), b, 3, false, ctx);
    // count=3 -> viewportTopLine + (3-1) = 12
    expect(result!.cursor.line).toBe(12);
  });

  it("uses default viewportTopLine=0 when ctx is not provided", () => {
    const b = buf(["  first", "second", "third"]);
    const result = resolveMotion("H", cur(2, 0), b, 1, false);
    expect(result!.cursor.line).toBe(0);
    expect(result!.cursor.col).toBe(2); // firstNonBlank of "  first"
  });

  it("returns linewise range", () => {
    const b = buf(["first", "second", "third"]);
    const ctx = createCtx({ viewportTopLine: 0, viewportHeight: 3 });
    const result = resolveMotion("H", cur(2, 0), b, 1, false, ctx);
    expect(result!.range.linewise).toBe(true);
  });

  it("clamps to buffer size when viewport extends beyond buffer", () => {
    const b = buf(["only"]);
    const ctx = createCtx({ viewportTopLine: 0, viewportHeight: 50 });
    const result = resolveMotion("H", cur(0, 0), b, 5, false, ctx);
    // viewportTopLine + (5-1) = 4, but buffer only has line 0
    expect(result!.cursor.line).toBe(0);
  });
});

// ---------- Screen motions: M ----------

describe("resolveMotion: M (middle of viewport)", () => {
  it("moves to the middle of the viewport", () => {
    const b = buf(Array.from({ length: 100 }, (_, i) => `line ${i}`));
    const ctx = createCtx({ viewportTopLine: 10, viewportHeight: 20 });
    const result = resolveMotion("M", cur(0, 0), b, 1, false, ctx);
    expect(result).not.toBeNull();
    // viewportTopLine + floor(20/2) = 10 + 10 = 20
    expect(result!.cursor.line).toBe(20);
  });

  it("uses default viewport when ctx is not provided", () => {
    const b = buf(Array.from({ length: 100 }, (_, i) => `line ${i}`));
    const result = resolveMotion("M", cur(0, 0), b, 1, false);
    // default: viewportTopLine=0, viewportHeight=50, so middle = 0 + floor(50/2) = 25
    expect(result!.cursor.line).toBe(25);
  });

  it("clamps to buffer size when viewport middle exceeds buffer", () => {
    const b = buf(["a", "b", "c"]);
    const ctx = createCtx({ viewportTopLine: 0, viewportHeight: 50 });
    const result = resolveMotion("M", cur(0, 0), b, 1, false, ctx);
    // floor(50/2) = 25, clamped to line 2
    expect(result!.cursor.line).toBe(2);
  });

  it("returns linewise range", () => {
    const b = buf(Array.from({ length: 100 }, (_, i) => `line ${i}`));
    const ctx = createCtx({ viewportTopLine: 0, viewportHeight: 50 });
    const result = resolveMotion("M", cur(0, 0), b, 1, false, ctx);
    expect(result!.range.linewise).toBe(true);
  });

  it("moves cursor to firstNonBlank on target line", () => {
    const lines = Array.from({ length: 100 }, () => "  indented");
    const b = buf(lines);
    const ctx = createCtx({ viewportTopLine: 0, viewportHeight: 20 });
    const result = resolveMotion("M", cur(0, 0), b, 1, false, ctx);
    // firstNonBlank of "  indented" is 2
    expect(result!.cursor.col).toBe(2);
  });
});

// ---------- Screen motions: L ----------

describe("resolveMotion: L (bottom of viewport)", () => {
  it("moves to the bottom of the viewport", () => {
    const b = buf(Array.from({ length: 100 }, (_, i) => `line ${i}`));
    const ctx = createCtx({ viewportTopLine: 10, viewportHeight: 20 });
    const result = resolveMotion("L", cur(0, 0), b, 1, false, ctx);
    expect(result).not.toBeNull();
    // bottomLine = 10 + 20 - 1 = 29, count=1 -> 29 - 0 = 29
    expect(result!.cursor.line).toBe(29);
  });

  it("with count, moves to Nth line from bottom of viewport", () => {
    const b = buf(Array.from({ length: 100 }, (_, i) => `line ${i}`));
    const ctx = createCtx({ viewportTopLine: 10, viewportHeight: 20 });
    const result = resolveMotion("L", cur(0, 0), b, 3, false, ctx);
    // bottomLine = 29, count=3 -> 29 - 2 = 27
    expect(result!.cursor.line).toBe(27);
  });

  it("uses default viewport when ctx is not provided", () => {
    const b = buf(Array.from({ length: 100 }, (_, i) => `line ${i}`));
    const result = resolveMotion("L", cur(0, 0), b, 1, false);
    // default: viewportTopLine=0, viewportHeight=50, bottomLine = 49
    expect(result!.cursor.line).toBe(49);
  });

  it("clamps to buffer size when viewport bottom exceeds buffer", () => {
    const b = buf(["a", "b", "c"]);
    const ctx = createCtx({ viewportTopLine: 0, viewportHeight: 50 });
    const result = resolveMotion("L", cur(0, 0), b, 1, false, ctx);
    // bottomLine = 49, clamped to line 2
    expect(result!.cursor.line).toBe(2);
  });

  it("returns linewise range", () => {
    const b = buf(Array.from({ length: 100 }, (_, i) => `line ${i}`));
    const ctx = createCtx({ viewportTopLine: 0, viewportHeight: 50 });
    const result = resolveMotion("L", cur(0, 0), b, 1, false, ctx);
    expect(result!.range.linewise).toBe(true);
  });
});

// ---------- Bracket matching: % ----------

describe("resolveMotion: % (bracket matching)", () => {
  it("matches opening parenthesis to closing", () => {
    const b = buf(["(hello)"]);
    const result = resolveMotion("%", cur(0, 0), b, 1, false);
    expect(result).not.toBeNull();
    expect(result!.cursor).toEqual(cur(0, 6));
  });

  it("matches closing parenthesis to opening", () => {
    const b = buf(["(hello)"]);
    const result = resolveMotion("%", cur(0, 6), b, 1, false);
    expect(result!.cursor).toEqual(cur(0, 0));
  });

  it("matches curly braces", () => {
    const b = buf(["{hello}"]);
    const result = resolveMotion("%", cur(0, 0), b, 1, false);
    expect(result!.cursor).toEqual(cur(0, 6));
  });

  it("matches square brackets", () => {
    const b = buf(["[hello]"]);
    const result = resolveMotion("%", cur(0, 0), b, 1, false);
    expect(result!.cursor).toEqual(cur(0, 6));
  });

  it("matches nested brackets", () => {
    const b = buf(["((inner))"]);
    const result = resolveMotion("%", cur(0, 0), b, 1, false);
    expect(result!.cursor).toEqual(cur(0, 8));
  });

  it("matches brackets across lines", () => {
    const b = buf(["function {", "  body", "}"]);
    const result = resolveMotion("%", cur(0, 9), b, 1, false);
    expect(result!.cursor).toEqual(cur(2, 0));
  });

  it("searches for first bracket on line when cursor is not on one", () => {
    const b = buf(["hello (world)"]);
    const result = resolveMotion("%", cur(0, 0), b, 1, false);
    expect(result!.cursor).toEqual(cur(0, 12));
  });

  it("does not move when line has no brackets", () => {
    const b = buf(["hello world"]);
    const result = resolveMotion("%", cur(0, 0), b, 1, false);
    expect(result!.cursor).toEqual(cur(0, 0));
  });

  it("does not move when there is no matching bracket", () => {
    const b = buf(["(hello"]);
    const result = resolveMotion("%", cur(0, 0), b, 1, false);
    expect(result!.cursor).toEqual(cur(0, 0));
  });

  it("returns inclusive, non-linewise range", () => {
    const b = buf(["(hello)"]);
    const result = resolveMotion("%", cur(0, 0), b, 1, false);
    expect(result!.range.inclusive).toBe(true);
    expect(result!.range.linewise).toBe(false);
  });
});

// ---------- Unknown key ----------

describe("resolveMotion: unknown key", () => {
  it("returns null for an unrecognized key", () => {
    const b = buf(["hello"]);
    expect(resolveMotion("z", cur(0, 0), b, 1, false)).toBeNull();
  });

  it("returns null for Enter", () => {
    const b = buf(["hello"]);
    expect(resolveMotion("Enter", cur(0, 0), b, 1, false)).toBeNull();
  });

  it("returns null for Escape", () => {
    const b = buf(["hello"]);
    expect(resolveMotion("Escape", cur(0, 0), b, 1, false)).toBeNull();
  });

  it("returns null for a", () => {
    const b = buf(["hello"]);
    expect(resolveMotion("a", cur(0, 0), b, 1, false)).toBeNull();
  });

  it("returns null for i", () => {
    const b = buf(["hello"]);
    expect(resolveMotion("i", cur(0, 0), b, 1, false)).toBeNull();
  });

  it("returns null for empty string", () => {
    const b = buf(["hello"]);
    expect(resolveMotion("", cur(0, 0), b, 1, false)).toBeNull();
  });
});

// ---------- Edge cases ----------

describe("resolveMotion: edge cases", () => {
  it("h on empty line does not move", () => {
    const b = buf([""]);
    const result = resolveMotion("h", cur(0, 0), b, 1, false);
    expect(result!.cursor).toEqual(cur(0, 0));
  });

  it("j on single-line buffer does not move", () => {
    const b = buf(["only"]);
    const result = resolveMotion("j", cur(0, 0), b, 1, false);
    expect(result!.cursor).toEqual(cur(0, 0));
  });

  it("k on single-line buffer does not move", () => {
    const b = buf(["only"]);
    const result = resolveMotion("k", cur(0, 0), b, 1, false);
    expect(result!.cursor).toEqual(cur(0, 0));
  });

  it("w on last word of last line stays in place", () => {
    const b = buf(["hello"]);
    const result = resolveMotion("w", cur(0, 0), b, 5, false);
    expect(result!.cursor.line).toBe(0);
  });

  it("b at beginning of file stays in place", () => {
    const b = buf(["hello"]);
    const result = resolveMotion("b", cur(0, 0), b, 5, false);
    expect(result!.cursor).toEqual(cur(0, 0));
  });

  it("G without ctx still works with default viewport values", () => {
    const b = buf(["a", "b", "c"]);
    const result = resolveMotion("G", cur(0, 0), b, 1, false);
    expect(result!.cursor.line).toBe(2);
  });

  it("$ on single character line", () => {
    const b = buf(["a"]);
    const result = resolveMotion("$", cur(0, 0), b, 1, false);
    expect(result!.cursor).toEqual(cur(0, 0));
  });

  it("0 on empty line", () => {
    const b = buf([""]);
    const result = resolveMotion("0", cur(0, 0), b, 1, false);
    expect(result!.cursor).toEqual(cur(0, 0));
  });

  it("^ on whitespace-only line returns col 0", () => {
    const b = buf(["   "]);
    const result = resolveMotion("^", cur(0, 2), b, 1, false);
    expect(result!.cursor).toEqual(cur(0, 0));
  });

  it("% on empty line does not move", () => {
    const b = buf([""]);
    const result = resolveMotion("%", cur(0, 0), b, 1, false);
    expect(result!.cursor).toEqual(cur(0, 0));
  });

  it("H with ctx where viewportTopLine is beyond cursor", () => {
    const b = buf(Array.from({ length: 20 }, (_, i) => `line ${i}`));
    const ctx = createCtx({ viewportTopLine: 5, viewportHeight: 10 });
    const result = resolveMotion("H", cur(0, 0), b, 1, false, ctx);
    expect(result!.cursor.line).toBe(5);
  });

  it("L with large count brings line closer to middle from bottom", () => {
    const b = buf(Array.from({ length: 100 }, (_, i) => `line ${i}`));
    const ctx = createCtx({ viewportTopLine: 0, viewportHeight: 20 });
    const result = resolveMotion("L", cur(0, 0), b, 10, false, ctx);
    // bottomLine = 19, 19 - 9 = 10
    expect(result!.cursor.line).toBe(10);
  });
});

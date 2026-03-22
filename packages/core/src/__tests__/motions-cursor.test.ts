import { describe, it, expect } from "vitest";
import { TextBuffer } from "../buffer";
import {
  motionH,
  motionL,
  motionJ,
  motionK,
  motionZero,
  motionCaret,
  motionDollar,
} from "../motions";

// Helper: create a TextBuffer from an array of lines
function buf(lines: string[]): TextBuffer {
  return new TextBuffer(lines.join("\n"));
}

// Helper: concisely create a cursor position
function cur(line: number, col: number) {
  return { line, col };
}

// ---------- motionH ----------

describe("motionH: move left", () => {
  it("moves cursor left by count", () => {
    const b = buf(["hello"]);
    const result = motionH(cur(0, 3), b, 1);
    expect(result.cursor).toEqual(cur(0, 2));
  });

  it("moves 2 characters left with count=2", () => {
    const b = buf(["hello"]);
    const result = motionH(cur(0, 4), b, 2);
    expect(result.cursor).toEqual(cur(0, 2));
  });

  it("clamps at column 0", () => {
    const b = buf(["hello"]);
    const result = motionH(cur(0, 1), b, 5);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  it("does not move when already at column 0", () => {
    const b = buf(["hello"]);
    const result = motionH(cur(0, 0), b, 1);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  it("sets range correctly (linewise=false, inclusive=false)", () => {
    const b = buf(["hello"]);
    const result = motionH(cur(0, 3), b, 1);
    expect(result.range.start).toEqual(cur(0, 2));
    expect(result.range.end).toEqual(cur(0, 3));
    expect(result.range.linewise).toBe(false);
    expect(result.range.inclusive).toBe(false);
  });
});

// ---------- motionL ----------

describe("motionL: move right", () => {
  it("moves cursor right by count", () => {
    const b = buf(["hello"]);
    const result = motionL(cur(0, 0), b, 1);
    expect(result.cursor).toEqual(cur(0, 1));
  });

  it("moves 3 characters right with count=3", () => {
    const b = buf(["hello"]);
    const result = motionL(cur(0, 0), b, 3);
    expect(result.cursor).toEqual(cur(0, 3));
  });

  it("clamps at end of line", () => {
    const b = buf(["hello"]);
    // "hello" has length 5, max col=4
    const result = motionL(cur(0, 3), b, 10);
    expect(result.cursor).toEqual(cur(0, 4));
  });

  it("does not move when already at end of line", () => {
    const b = buf(["hi"]);
    const result = motionL(cur(0, 1), b, 1);
    expect(result.cursor).toEqual(cur(0, 1));
  });

  it("sets range correctly (linewise=false, inclusive=true)", () => {
    const b = buf(["hello"]);
    const result = motionL(cur(0, 1), b, 2);
    expect(result.range.start).toEqual(cur(0, 1));
    expect(result.range.end).toEqual(cur(0, 3));
    expect(result.range.linewise).toBe(false);
    expect(result.range.inclusive).toBe(true);
  });

  it("clamps to col=0 on an empty line", () => {
    const b = buf([""]);
    const result = motionL(cur(0, 0), b, 1);
    expect(result.cursor).toEqual(cur(0, 0));
  });
});

// ---------- motionJ ----------

describe("motionJ: move down", () => {
  it("moves 1 line down", () => {
    const b = buf(["hello", "world"]);
    const result = motionJ(cur(0, 2), b, 1);
    expect(result.cursor).toEqual(cur(1, 2));
  });

  it("clamps col when moving to a shorter line", () => {
    const b = buf(["hello world", "hi"]);
    const result = motionJ(cur(0, 8), b, 1);
    expect(result.cursor).toEqual(cur(1, 1));
  });

  it("does not exceed the last line", () => {
    const b = buf(["aaa", "bbb"]);
    const result = motionJ(cur(0, 0), b, 10);
    expect(result.cursor.line).toBe(1);
  });

  it("returns range with linewise=true", () => {
    const b = buf(["aaa", "bbb"]);
    const result = motionJ(cur(0, 0), b, 1);
    expect(result.range.linewise).toBe(true);
    expect(result.range.inclusive).toBe(true);
  });

  it("sets col to 0 when moving to an empty line", () => {
    const b = buf(["hello", ""]);
    const result = motionJ(cur(0, 3), b, 1);
    expect(result.cursor).toEqual(cur(1, 0));
  });
});

// ---------- motionK ----------

describe("motionK: move up", () => {
  it("moves 1 line up", () => {
    const b = buf(["hello", "world"]);
    const result = motionK(cur(1, 2), b, 1);
    expect(result.cursor).toEqual(cur(0, 2));
  });

  it("clamps col when moving to a shorter line", () => {
    const b = buf(["hi", "hello world"]);
    const result = motionK(cur(1, 8), b, 1);
    expect(result.cursor).toEqual(cur(0, 1));
  });

  it("does not exceed the first line", () => {
    const b = buf(["aaa", "bbb"]);
    const result = motionK(cur(1, 0), b, 10);
    expect(result.cursor.line).toBe(0);
  });

  it("returns range with linewise=true", () => {
    const b = buf(["aaa", "bbb"]);
    const result = motionK(cur(1, 0), b, 1);
    expect(result.range.linewise).toBe(true);
    expect(result.range.inclusive).toBe(true);
    expect(result.range.start).toEqual(cur(0, 0));
    expect(result.range.end).toEqual(cur(1, 0));
  });

  it("does not move when already on the first line", () => {
    const b = buf(["hello"]);
    const result = motionK(cur(0, 2), b, 1);
    expect(result.cursor).toEqual(cur(0, 2));
  });
});

// ---------- motionZero ----------

describe("motionZero: move to beginning of line (0)", () => {
  it("moves to column 0", () => {
    const b = buf(["  hello"]);
    const result = motionZero(cur(0, 5), b, 1);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  it("does not change when already at column 0", () => {
    const b = buf(["hello"]);
    const result = motionZero(cur(0, 0), b, 1);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  it("sets range correctly", () => {
    const b = buf(["hello"]);
    const result = motionZero(cur(0, 3), b, 1);
    expect(result.range.start).toEqual(cur(0, 0));
    expect(result.range.end).toEqual(cur(0, 3));
    expect(result.range.linewise).toBe(false);
    expect(result.range.inclusive).toBe(false);
  });
});

// ---------- motionCaret ----------

describe("motionCaret: move to first non-whitespace character (^)", () => {
  it("moves to the first non-whitespace character", () => {
    const b = buf(["  hello"]);
    const result = motionCaret(cur(0, 5), b, 1);
    expect(result.cursor).toEqual(cur(0, 2));
  });

  it("works correctly with mixed tab indentation", () => {
    const b = buf(["\t\thello"]);
    const result = motionCaret(cur(0, 5), b, 1);
    expect(result.cursor).toEqual(cur(0, 2));
  });

  it("moves to column 0 when the line has no leading whitespace", () => {
    const b = buf(["hello"]);
    const result = motionCaret(cur(0, 3), b, 1);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  it("range when cursor is before non-whitespace character", () => {
    const b = buf(["  hello"]);
    const result = motionCaret(cur(0, 0), b, 1);
    // cursor(col=0) < non-whitespace(col=2) so start=cursor, end=newCursor
    expect(result.range.start).toEqual(cur(0, 0));
    expect(result.range.end).toEqual(cur(0, 2));
    expect(result.range.inclusive).toBe(true);
  });

  it("range when cursor is after non-whitespace character", () => {
    const b = buf(["  hello"]);
    const result = motionCaret(cur(0, 5), b, 1);
    expect(result.range.start).toEqual(cur(0, 2));
    expect(result.range.end).toEqual(cur(0, 5));
  });

  it("moves to column 0 on an empty line", () => {
    const b = buf([""]);
    const result = motionCaret(cur(0, 0), b, 1);
    expect(result.cursor).toEqual(cur(0, 0));
  });
});

// ---------- motionDollar ----------

describe("motionDollar: move to end of line ($)", () => {
  it("moves to the last character of the line", () => {
    const b = buf(["hello"]);
    const result = motionDollar(cur(0, 0), b, 1);
    expect(result.cursor).toEqual(cur(0, 4));
  });

  it("does not change when already at end of line", () => {
    const b = buf(["hello"]);
    const result = motionDollar(cur(0, 4), b, 1);
    expect(result.cursor).toEqual(cur(0, 4));
  });

  it("col=0 on an empty line", () => {
    const b = buf([""]);
    const result = motionDollar(cur(0, 0), b, 1);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  it("range end is lineLength (exclusive end)", () => {
    const b = buf(["hello"]);
    const result = motionDollar(cur(0, 1), b, 1);
    expect(result.range.start).toEqual(cur(0, 1));
    expect(result.range.end).toEqual(cur(0, 5));
    expect(result.range.inclusive).toBe(true);
  });

  it("col=0 on a single-character line", () => {
    const b = buf(["a"]);
    const result = motionDollar(cur(0, 0), b, 1);
    expect(result.cursor).toEqual(cur(0, 0));
  });
});

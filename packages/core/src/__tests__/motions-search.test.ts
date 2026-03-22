import { describe, it, expect } from "vitest";
import { TextBuffer } from "../buffer";
import {
  motionFChar,
  motionFCharBack,
  motionTChar,
  motionTCharBack,
  motionMatchBracket,
  motionParagraphForward,
  motionParagraphBackward,
} from "../motions";

// Helper: create a TextBuffer from an array of lines
function buf(lines: string[]): TextBuffer {
  return new TextBuffer(lines.join("\n"));
}

// Helper: concisely create a cursor position
function cur(line: number, col: number) {
  return { line, col };
}

// ---------- motionFChar ----------

describe("motionFChar: forward character search (f)", () => {
  it("searches forward for the specified character and moves to it", () => {
    const b = buf(["hello world"]);
    const result = motionFChar(cur(0, 0), b, "o", 1);
    expect(result.cursor).toEqual(cur(0, 4));
  });

  it("moves to the 2nd occurrence with count=2", () => {
    const b = buf(["hello world"]);
    const result = motionFChar(cur(0, 0), b, "l", 2);
    expect(result.cursor).toEqual(cur(0, 3));
  });

  it("does not move when character is not found", () => {
    const b = buf(["hello"]);
    const result = motionFChar(cur(0, 0), b, "z", 1);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  it("returns range with inclusive=true", () => {
    const b = buf(["hello"]);
    const result = motionFChar(cur(0, 0), b, "l", 1);
    expect(result.range.inclusive).toBe(true);
    expect(result.range.linewise).toBe(false);
  });

  it("skips the character at cursor position", () => {
    const b = buf(["aaa"]);
    const result = motionFChar(cur(0, 0), b, "a", 1);
    expect(result.cursor).toEqual(cur(0, 1));
  });
});

// ---------- motionFCharBack ----------

describe("motionFCharBack: backward character search (F)", () => {
  it("searches backward for the specified character and moves to it", () => {
    const b = buf(["hello world"]);
    const result = motionFCharBack(cur(0, 10), b, "o", 1);
    expect(result.cursor).toEqual(cur(0, 7));
  });

  it("moves to the 2nd occurrence with count=2", () => {
    const b = buf(["hello world"]);
    const result = motionFCharBack(cur(0, 10), b, "l", 2);
    expect(result.cursor).toEqual(cur(0, 3));
  });

  it("does not move when character is not found", () => {
    const b = buf(["hello"]);
    const result = motionFCharBack(cur(0, 4), b, "z", 1);
    expect(result.cursor).toEqual(cur(0, 4));
  });

  it("sets range correctly", () => {
    const b = buf(["hello"]);
    const result = motionFCharBack(cur(0, 4), b, "e", 1);
    expect(result.range.start).toEqual(cur(0, 1));
    expect(result.range.end).toEqual(cur(0, 4));
    expect(result.range.inclusive).toBe(true);
  });
});

// ---------- motionTChar ----------

describe("motionTChar: forward character search stopping before (t)", () => {
  it("moves to one position before the specified character", () => {
    const b = buf(["hello world"]);
    const result = motionTChar(cur(0, 0), b, "o", 1);
    expect(result.cursor).toEqual(cur(0, 3));
  });

  it("moves to one position before the 2nd occurrence with count=2", () => {
    const b = buf(["abcabc"]);
    const result = motionTChar(cur(0, 0), b, "c", 2);
    expect(result.cursor).toEqual(cur(0, 4));
  });

  it("does not move when character is not found", () => {
    const b = buf(["hello"]);
    const result = motionTChar(cur(0, 0), b, "z", 1);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  it("range end is the cursor position after the move", () => {
    const b = buf(["hello"]);
    const result = motionTChar(cur(0, 0), b, "l", 1);
    expect(result.range.end).toEqual(cur(0, 1));
  });
});

// ---------- motionTCharBack ----------

describe("motionTCharBack: backward character search stopping after (T)", () => {
  it("moves to one position after the specified character", () => {
    const b = buf(["hello world"]);
    const result = motionTCharBack(cur(0, 10), b, "o", 1);
    expect(result.cursor).toEqual(cur(0, 8));
  });

  it("moves to one position after the 2nd occurrence with count=2", () => {
    const b = buf(["abcabc"]);
    const result = motionTCharBack(cur(0, 5), b, "a", 2);
    expect(result.cursor).toEqual(cur(0, 1));
  });

  it("does not move when character is not found", () => {
    const b = buf(["hello"]);
    const result = motionTCharBack(cur(0, 4), b, "z", 1);
    expect(result.cursor).toEqual(cur(0, 4));
  });

  it("range start is the cursor position after the move", () => {
    const b = buf(["hello"]);
    const result = motionTCharBack(cur(0, 4), b, "e", 1);
    expect(result.range.start).toEqual(cur(0, 2));
  });
});

// ---------- motionMatchBracket ----------

describe("motionMatchBracket: matching bracket motion (%)", () => {
  // Parentheses matching
  it("moves from opening parenthesis to matching closing parenthesis", () => {
    const b = buf(["(hello)"]);
    const result = motionMatchBracket(cur(0, 0), b, 0);
    expect(result.cursor).toEqual(cur(0, 6));
  });

  it("moves from closing parenthesis to matching opening parenthesis", () => {
    const b = buf(["(hello)"]);
    const result = motionMatchBracket(cur(0, 6), b, 0);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  // Square brackets matching
  it("moves from opening square bracket to matching closing square bracket", () => {
    const b = buf(["[hello]"]);
    const result = motionMatchBracket(cur(0, 0), b, 0);
    expect(result.cursor).toEqual(cur(0, 6));
  });

  it("moves from closing square bracket to matching opening square bracket", () => {
    const b = buf(["[hello]"]);
    const result = motionMatchBracket(cur(0, 6), b, 0);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  // Curly braces matching
  it("moves from opening curly brace to matching closing curly brace", () => {
    const b = buf(["{hello}"]);
    const result = motionMatchBracket(cur(0, 0), b, 0);
    expect(result.cursor).toEqual(cur(0, 6));
  });

  it("moves from closing curly brace to matching opening curly brace", () => {
    const b = buf(["{hello}"]);
    const result = motionMatchBracket(cur(0, 6), b, 0);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  // Nested brackets
  it("correctly matches nested brackets", () => {
    const b = buf(["((inner))"]);
    const result = motionMatchBracket(cur(0, 0), b, 0);
    expect(result.cursor).toEqual(cur(0, 8));
  });

  it("matches inner nested brackets", () => {
    const b = buf(["((inner))"]);
    const result = motionMatchBracket(cur(0, 1), b, 0);
    expect(result.cursor).toEqual(cur(0, 7));
  });

  // Brackets spanning multiple lines
  it("matches brackets spanning multiple lines", () => {
    const b = buf(["function {", "  body", "}"]);
    const result = motionMatchBracket(cur(0, 9), b, 0);
    expect(result.cursor).toEqual(cur(2, 0));
  });

  it("moves from closing bracket to opening bracket across multiple lines", () => {
    const b = buf(["function {", "  body", "}"]);
    const result = motionMatchBracket(cur(2, 0), b, 0);
    expect(result.cursor).toEqual(cur(0, 9));
  });

  // Cursor not on a bracket
  it("searches for the first bracket in the line when cursor is not on a bracket", () => {
    const b = buf(["hello (world)"]);
    const result = motionMatchBracket(cur(0, 0), b, 0);
    expect(result.cursor).toEqual(cur(0, 12));
  });

  it("does not move when the line has no brackets", () => {
    const b = buf(["hello world"]);
    const result = motionMatchBracket(cur(0, 0), b, 0);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  // No matching bracket found
  it("does not move when there is no matching bracket", () => {
    const b = buf(["(hello"]);
    const result = motionMatchBracket(cur(0, 0), b, 0);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  it("returns range with inclusive=true, linewise=false", () => {
    const b = buf(["(hello)"]);
    const result = motionMatchBracket(cur(0, 0), b, 0);
    expect(result.range.inclusive).toBe(true);
    expect(result.range.linewise).toBe(false);
  });

  // Mixed bracket types
  it("correctly matches when different bracket types are mixed", () => {
    const b = buf(["([{hello}])"]);
    const result = motionMatchBracket(cur(0, 0), b, 0);
    expect(result.cursor).toEqual(cur(0, 10));
  });

  it("matches inner brackets among mixed bracket types", () => {
    const b = buf(["([{hello}])"]);
    const result = motionMatchBracket(cur(0, 2), b, 0);
    expect(result.cursor).toEqual(cur(0, 8));
  });
});

// ---------- Paragraph movement ({ / }) ----------

describe("motionParagraphForward (})", () => {
  it("moves to the next blank line from a non-blank line", () => {
    const b = buf(["a", "b", "", "c", "d"]);
    const result = motionParagraphForward(cur(0, 0), b, 1);
    expect(result.cursor).toEqual(cur(2, 0));
  });

  it("moves past blank lines to the next paragraph boundary", () => {
    const b = buf(["a", "b", "", "c", "d", "", "e"]);
    const result = motionParagraphForward(cur(2, 0), b, 1);
    expect(result.cursor).toEqual(cur(5, 0));
  });

  it("moves to EOF when no more blank lines", () => {
    const b = buf(["a", "b", "", "c", "d"]);
    const result = motionParagraphForward(cur(2, 0), b, 1);
    expect(result.cursor).toEqual(cur(4, 0));
  });

  it("supports count", () => {
    const b = buf(["a", "", "b", "", "c"]);
    const result = motionParagraphForward(cur(0, 0), b, 2);
    expect(result.cursor).toEqual(cur(3, 0));
  });

  it("stays at last line when already at EOF", () => {
    const b = buf(["a", "b"]);
    const result = motionParagraphForward(cur(1, 0), b, 1);
    expect(result.cursor).toEqual(cur(1, 0));
  });

  it("returns linewise range", () => {
    const b = buf(["a", "", "b"]);
    const result = motionParagraphForward(cur(0, 0), b, 1);
    expect(result.range.linewise).toBe(true);
  });
});

describe("motionParagraphBackward ({)", () => {
  it("moves to the previous blank line from a non-blank line", () => {
    const b = buf(["a", "b", "", "c", "d"]);
    const result = motionParagraphBackward(cur(4, 0), b, 1);
    expect(result.cursor).toEqual(cur(2, 0));
  });

  it("moves past blank lines to the previous paragraph boundary", () => {
    const b = buf(["a", "b", "", "c", "d", "", "e"]);
    const result = motionParagraphBackward(cur(5, 0), b, 1);
    expect(result.cursor).toEqual(cur(2, 0));
  });

  it("moves to BOF when no more blank lines", () => {
    const b = buf(["a", "b", "", "c"]);
    const result = motionParagraphBackward(cur(2, 0), b, 1);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  it("supports count", () => {
    const b = buf(["a", "", "b", "", "c"]);
    const result = motionParagraphBackward(cur(4, 0), b, 2);
    expect(result.cursor).toEqual(cur(1, 0));
  });

  it("stays at first line when already at BOF", () => {
    const b = buf(["a", "b"]);
    const result = motionParagraphBackward(cur(0, 0), b, 1);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  it("returns linewise range", () => {
    const b = buf(["a", "", "b"]);
    const result = motionParagraphBackward(cur(2, 0), b, 1);
    expect(result.range.linewise).toBe(true);
  });
});

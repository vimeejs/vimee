import { describe, it, expect } from "vitest";
import { TextBuffer } from "../buffer";
import {
  motionH,
  motionL,
  motionJ,
  motionK,
  motionW,
  motionE,
  motionB,
  motionBigW,
  motionBigB,
  motionZero,
  motionCaret,
  motionDollar,
  motionGG,
  motionG,
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

// ---------- motionW ----------

describe("motionW: word forward motion", () => {
  it("moves to the beginning of the next word", () => {
    const b = buf(["hello world"]);
    const result = motionW(cur(0, 0), b, 1);
    expect(result.cursor).toEqual(cur(0, 6));
  });

  it("treats punctuation as a separate word", () => {
    const b = buf(["foo.bar"]);
    const result = motionW(cur(0, 0), b, 1);
    // "." after "foo" is the next word
    expect(result.cursor).toEqual(cur(0, 3));
  });

  it("moves from punctuation to word characters", () => {
    const b = buf(["foo.bar"]);
    const result = motionW(cur(0, 3), b, 1);
    expect(result.cursor).toEqual(cur(0, 4));
  });

  it("moves 2 words forward with count=2", () => {
    const b = buf(["one two three"]);
    const result = motionW(cur(0, 0), b, 2);
    expect(result.cursor).toEqual(cur(0, 8));
  });

  it("moves to the next line from end of line", () => {
    const b = buf(["hello", "world"]);
    const result = motionW(cur(0, 0), b, 2);
    expect(result.cursor).toEqual(cur(1, 0));
  });

  it("moves across empty lines", () => {
    // 2w: hello -> empty line(1w) -> world(2w)
    const b = buf(["hello", "", "world"]);
    const result = motionW(cur(0, 0), b, 2);
    expect(result.cursor).toEqual(cur(2, 0));
  });

  it("returns range with linewise=false, inclusive=false", () => {
    const b = buf(["hello world"]);
    const result = motionW(cur(0, 0), b, 1);
    expect(result.range.linewise).toBe(false);
    expect(result.range.inclusive).toBe(false);
  });

  it("does not move on the last word of the last line", () => {
    const b = buf(["hello"]);
    const result = motionW(cur(0, 0), b, 5);
    // Cannot advance further on the last line
    expect(result.cursor.line).toBe(0);
  });
});

// ---------- motionE ----------

describe("motionE: word end motion", () => {
  it("moves to the end of the current word", () => {
    const b = buf(["hello world"]);
    const result = motionE(cur(0, 0), b, 1);
    expect(result.cursor).toEqual(cur(0, 4));
  });

  it("moves to the end of the next word when already at word end", () => {
    const b = buf(["hello world"]);
    const result = motionE(cur(0, 4), b, 1);
    expect(result.cursor).toEqual(cur(0, 10));
  });

  it("treats punctuation as a separate word", () => {
    const b = buf(["foo..bar"]);
    const result = motionE(cur(0, 0), b, 1);
    // end of "foo"
    expect(result.cursor).toEqual(cur(0, 2));
  });

  it("moves to the end of a punctuation group", () => {
    const b = buf(["foo..bar"]);
    const result = motionE(cur(0, 2), b, 1);
    // end of ".."
    expect(result.cursor).toEqual(cur(0, 4));
  });

  it("moves across lines", () => {
    const b = buf(["hello", "world"]);
    const result = motionE(cur(0, 4), b, 1);
    expect(result.cursor).toEqual(cur(1, 4));
  });

  it("returns range with inclusive=true", () => {
    const b = buf(["hello world"]);
    const result = motionE(cur(0, 0), b, 1);
    expect(result.range.inclusive).toBe(true);
    expect(result.range.linewise).toBe(false);
  });

  it("moves to the end of the 2nd word ahead with count=2", () => {
    const b = buf(["one two three"]);
    const result = motionE(cur(0, 0), b, 2);
    expect(result.cursor).toEqual(cur(0, 6));
  });
});

// ---------- motionB ----------

describe("motionB: word backward motion", () => {
  it("moves to the beginning of the previous word", () => {
    const b = buf(["hello world"]);
    const result = motionB(cur(0, 8), b, 1);
    expect(result.cursor).toEqual(cur(0, 6));
  });

  it("moves to the word before the current one when at a word start", () => {
    const b = buf(["hello world"]);
    const result = motionB(cur(0, 6), b, 1);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  it("treats punctuation as a separate word", () => {
    const b = buf(["foo.bar"]);
    const result = motionB(cur(0, 4), b, 1);
    expect(result.cursor).toEqual(cur(0, 3));
  });

  it("moves backward across lines", () => {
    const b = buf(["hello", "world"]);
    const result = motionB(cur(1, 0), b, 1);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  it("moves back 2 words with count=2", () => {
    const b = buf(["one two three"]);
    const result = motionB(cur(0, 10), b, 2);
    expect(result.cursor).toEqual(cur(0, 4));
  });

  it("does not go past the beginning", () => {
    const b = buf(["hello"]);
    const result = motionB(cur(0, 0), b, 1);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  it("sets range correctly", () => {
    const b = buf(["hello world"]);
    const result = motionB(cur(0, 8), b, 1);
    expect(result.range.start).toEqual(cur(0, 6));
    expect(result.range.end).toEqual(cur(0, 8));
    expect(result.range.linewise).toBe(false);
    expect(result.range.inclusive).toBe(false);
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

// ---------- motionGG ----------

describe("motionGG: move to beginning of file (gg)", () => {
  it("moves to the first line without count", () => {
    const b = buf(["  first", "second", "third"]);
    const result = motionGG(cur(2, 3), b, null);
    expect(result.cursor.line).toBe(0);
  });

  it("moves to the first non-whitespace character", () => {
    const b = buf(["  first", "second"]);
    const result = motionGG(cur(1, 0), b, null);
    expect(result.cursor).toEqual(cur(0, 2));
  });

  it("moves to the specified line with count (1-based)", () => {
    const b = buf(["line1", "line2", "line3"]);
    const result = motionGG(cur(0, 0), b, 2);
    expect(result.cursor.line).toBe(1);
  });

  it("uses firstNonBlank when count is specified", () => {
    const b = buf(["line1", "  line2", "line3"]);
    const result = motionGG(cur(0, 0), b, 2);
    expect(result.cursor).toEqual(cur(1, 2));
  });

  it("clamps when count exceeds line count", () => {
    const b = buf(["a", "b"]);
    const result = motionGG(cur(0, 0), b, 100);
    expect(result.cursor.line).toBe(1);
  });

  it("returns range with linewise=true", () => {
    const b = buf(["a", "b", "c"]);
    const result = motionGG(cur(2, 0), b, null);
    expect(result.range.linewise).toBe(true);
    expect(result.range.inclusive).toBe(true);
  });

  it("range start/end when moving upward", () => {
    const b = buf(["a", "b", "c"]);
    const result = motionGG(cur(2, 0), b, null);
    expect(result.range.start.line).toBe(0);
    expect(result.range.end.line).toBe(2);
  });
});

// ---------- motionG ----------

describe("motionG: move to end of file (G)", () => {
  it("moves to the last line without count", () => {
    const b = buf(["first", "second", "  third"]);
    const result = motionG(cur(0, 0), b, null);
    expect(result.cursor.line).toBe(2);
  });

  it("moves to firstNonBlank on the last line", () => {
    const b = buf(["first", "  last"]);
    const result = motionG(cur(0, 0), b, null);
    expect(result.cursor).toEqual(cur(1, 2));
  });

  it("moves to the specified line with count (1-based)", () => {
    const b = buf(["line1", "line2", "line3"]);
    const result = motionG(cur(2, 0), b, 1);
    expect(result.cursor.line).toBe(0);
  });

  it("clamps when count exceeds line count", () => {
    const b = buf(["a", "b"]);
    const result = motionG(cur(0, 0), b, 100);
    expect(result.cursor.line).toBe(1);
  });

  it("returns range with linewise=true", () => {
    const b = buf(["a", "b", "c"]);
    const result = motionG(cur(0, 0), b, null);
    expect(result.range.linewise).toBe(true);
    expect(result.range.inclusive).toBe(true);
  });

  it("range start/end when moving downward", () => {
    const b = buf(["a", "b", "c"]);
    const result = motionG(cur(0, 0), b, null);
    expect(result.range.start.line).toBe(0);
    expect(result.range.end.line).toBe(2);
  });

  it("range start/end when moving upward", () => {
    const b = buf(["a", "b", "c"]);
    const result = motionG(cur(2, 0), b, 1);
    expect(result.range.start.line).toBe(0);
    expect(result.range.end.line).toBe(2);
  });
});

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

// ---------- Edge cases ----------

describe("Edge cases", () => {
  // Motions on empty lines
  it("motionH: does not move on an empty line", () => {
    const b = buf([""]);
    const result = motionH(cur(0, 0), b, 1);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  it("motionL: does not move on an empty line", () => {
    const b = buf([""]);
    const result = motionL(cur(0, 0), b, 1);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  it("motionDollar: stays at col=0 on an empty line", () => {
    const b = buf([""]);
    const result = motionDollar(cur(0, 0), b, 1);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  // Single character lines
  it("motionH: clamps to col=0 on a single-character line", () => {
    const b = buf(["a"]);
    const result = motionH(cur(0, 0), b, 1);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  it("motionL: clamps to col=0 on a single-character line", () => {
    const b = buf(["a"]);
    const result = motionL(cur(0, 0), b, 1);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  // J/K at boundaries
  it("motionJ: does not move on the last line", () => {
    const b = buf(["only"]);
    const result = motionJ(cur(0, 0), b, 1);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  it("motionK: does not move on the first line", () => {
    const b = buf(["only"]);
    const result = motionK(cur(0, 0), b, 1);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  // W/E/B on single character lines
  it("motionW: moves to the next line from a single-character line", () => {
    const b = buf(["a", "b"]);
    const result = motionW(cur(0, 0), b, 1);
    expect(result.cursor).toEqual(cur(1, 0));
  });

  it("motionE: moves to the end of the next line from a single-character line", () => {
    const b = buf(["a", "bc"]);
    const result = motionE(cur(0, 0), b, 1);
    expect(result.cursor).toEqual(cur(1, 1));
  });

  it("motionB: moves to the previous line from a single-character line", () => {
    const b = buf(["abc", "d"]);
    const result = motionB(cur(1, 0), b, 1);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  // GG/G on buffers with empty lines
  it("motionGG: moves in a buffer containing empty lines", () => {
    const b = buf(["", "hello", ""]);
    const result = motionGG(cur(1, 3), b, null);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  it("motionG: moves to the last line (empty) in a buffer containing empty lines", () => {
    const b = buf(["hello", ""]);
    const result = motionG(cur(0, 0), b, null);
    expect(result.cursor).toEqual(cur(1, 0));
  });

  // fChar boundary cases
  it("motionFChar: does not move when searching at end of line", () => {
    const b = buf(["abc"]);
    const result = motionFChar(cur(0, 2), b, "x", 1);
    expect(result.cursor).toEqual(cur(0, 2));
  });

  it("motionFCharBack: does not move when searching at beginning of line", () => {
    const b = buf(["abc"]);
    const result = motionFCharBack(cur(0, 0), b, "x", 1);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  // matchBracket: empty line
  it("motionMatchBracket: does not move on an empty line", () => {
    const b = buf([""]);
    const result = motionMatchBracket(cur(0, 0), b, 0);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  // Large count values
  it("motionJ: clamps to the last line with a large count", () => {
    const b = buf(["a", "b", "c"]);
    const result = motionJ(cur(0, 0), b, 999);
    expect(result.cursor.line).toBe(2);
  });

  it("motionK: clamps to the first line with a large count", () => {
    const b = buf(["a", "b", "c"]);
    const result = motionK(cur(2, 0), b, 999);
    expect(result.cursor.line).toBe(0);
  });

  // Whitespace-only lines
  it("motionCaret: col=0 on a whitespace-only line", () => {
    const b = buf(["   "]);
    const result = motionCaret(cur(0, 2), b, 1);
    // No \S match, so 0 is returned
    expect(result.cursor).toEqual(cur(0, 0));
  });

  // motionW: crossing multiple spaces
  it("motionW: moves to the next word across consecutive spaces", () => {
    const b = buf(["hello    world"]);
    const result = motionW(cur(0, 0), b, 1);
    expect(result.cursor).toEqual(cur(0, 9));
  });

  // --- motionBigW ---
  it("motionBigW: skips punctuation as part of the WORD", () => {
    const b = buf(["foo.bar baz"]);
    // w would stop at '.', W treats foo.bar as one WORD
    const result = motionBigW(cur(0, 0), b, 1);
    expect(result.cursor).toEqual(cur(0, 8));
  });

  it("motionBigW: moves across whitespace to next WORD", () => {
    const b = buf(["hello   world"]);
    const result = motionBigW(cur(0, 0), b, 1);
    expect(result.cursor).toEqual(cur(0, 8));
  });

  it("motionBigW: moves to next line when at end of current line", () => {
    const b = buf(["hello", "world"]);
    const result = motionBigW(cur(0, 0), b, 1);
    expect(result.cursor).toEqual(cur(1, 0));
  });

  it("motionBigW: count=2 skips two WORDs", () => {
    // "one-two three.four five"
    //  0       8              19
    const b = buf(["one-two three.four five"]);
    const result = motionBigW(cur(0, 0), b, 2);
    expect(result.cursor).toEqual(cur(0, 19));
  });

  it("motionBigW: stays at end of file when no more WORDs", () => {
    const b = buf(["hello"]);
    const result = motionBigW(cur(0, 0), b, 1);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  it("motionBigW: advances to next line when col >= text.length", () => {
    const b = buf(["hi", "world"]);
    // col=5 is past the end of "hi" (length 2)
    const result = motionBigW(cur(0, 5), b, 1);
    expect(result.cursor).toEqual(cur(1, 0));
  });

  it("motionBigW: clamps col when col >= text.length on last line", () => {
    const b = buf(["hi"]);
    // col=5 is past the end of "hi" and there's no next line
    // The cursor col gets clamped to lineLen - 1 = 1
    const result = motionBigW(cur(0, 5), b, 1);
    expect(result.cursor).toEqual(cur(0, 1));
  });

  it("motionBigW: col exactly at text.length advances to next line", () => {
    const b = buf(["ab", "cd"]);
    // col=2 equals text.length of "ab"
    const result = motionBigW(cur(0, 2), b, 1);
    expect(result.cursor).toEqual(cur(1, 0));
  });

  // --- motionBigB ---
  it("motionBigB: skips punctuation as part of the WORD backwards", () => {
    const b = buf(["foo.bar baz"]);
    // From 'baz', B goes back to 'foo.bar'
    const result = motionBigB(cur(0, 8), b, 1);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  it("motionBigB: moves back across whitespace", () => {
    const b = buf(["hello   world"]);
    const result = motionBigB(cur(0, 8), b, 1);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  it("motionBigB: moves to previous line", () => {
    const b = buf(["hello", "world"]);
    const result = motionBigB(cur(1, 0), b, 1);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  it("motionBigB: count=2 skips two WORDs backwards", () => {
    const b = buf(["one-two three.four five"]);
    const result = motionBigB(cur(0, 18), b, 2);
    expect(result.cursor).toEqual(cur(0, 0));
  });

  it("motionBigB: stays at beginning of file", () => {
    const b = buf(["hello"]);
    const result = motionBigB(cur(0, 0), b, 1);
    expect(result.cursor).toEqual(cur(0, 0));
  });
});

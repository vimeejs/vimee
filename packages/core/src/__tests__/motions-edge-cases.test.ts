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
  motionCaret,
  motionDollar,
  motionGG,
  motionG,
  motionFChar,
  motionFCharBack,
  motionMatchBracket,
} from "../motions";

// Helper: create a TextBuffer from an array of lines
function buf(lines: string[]): TextBuffer {
  return new TextBuffer(lines.join("\n"));
}

// Helper: concisely create a cursor position
function cur(line: number, col: number) {
  return { line, col };
}

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

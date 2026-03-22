import { describe, it, expect } from "vitest";
import { TextBuffer } from "../buffer";
import { motionW, motionE, motionB, motionGG, motionG } from "../motions";

// Helper: create a TextBuffer from an array of lines
function buf(lines: string[]): TextBuffer {
  return new TextBuffer(lines.join("\n"));
}

// Helper: concisely create a cursor position
function cur(line: number, col: number) {
  return { line, col };
}

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

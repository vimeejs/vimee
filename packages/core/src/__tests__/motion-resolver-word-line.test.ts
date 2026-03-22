import { describe, it, expect } from "vitest";
import { TextBuffer } from "../buffer";
import { resolveMotion } from "../motion-resolver";

function buf(lines: string[]): TextBuffer {
  return new TextBuffer(lines.join("\n"));
}

function cur(line: number, col: number) {
  return { line, col };
}

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

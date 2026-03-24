import { describe, it, expect } from "vitest";
import { cursorToOffset, offsetToCursor } from "../cursor";

describe("cursorToOffset", () => {
  it("converts start of single line", () => {
    expect(cursorToOffset("hello", { line: 0, col: 0 })).toBe(0);
  });

  it("converts middle of single line", () => {
    expect(cursorToOffset("hello", { line: 0, col: 3 })).toBe(3);
  });

  it("converts start of second line", () => {
    expect(cursorToOffset("hello\nworld", { line: 1, col: 0 })).toBe(6);
  });

  it("converts middle of second line", () => {
    expect(cursorToOffset("hello\nworld", { line: 1, col: 3 })).toBe(9);
  });

  it("clamps col to line length", () => {
    expect(cursorToOffset("hi\nab", { line: 0, col: 99 })).toBe(2);
  });

  it("handles empty content", () => {
    expect(cursorToOffset("", { line: 0, col: 0 })).toBe(0);
  });

  it("handles three lines", () => {
    expect(cursorToOffset("aa\nbb\ncc", { line: 2, col: 1 })).toBe(7);
  });
});

describe("offsetToCursor", () => {
  it("converts offset 0", () => {
    expect(offsetToCursor("hello", 0)).toEqual({ line: 0, col: 0 });
  });

  it("converts middle of first line", () => {
    expect(offsetToCursor("hello", 3)).toEqual({ line: 0, col: 3 });
  });

  it("converts start of second line", () => {
    expect(offsetToCursor("hello\nworld", 6)).toEqual({ line: 1, col: 0 });
  });

  it("converts middle of second line", () => {
    expect(offsetToCursor("hello\nworld", 9)).toEqual({ line: 1, col: 3 });
  });

  it("handles past end of content", () => {
    const result = offsetToCursor("hi", 99);
    expect(result.line).toBe(0);
    expect(result.col).toBe(2);
  });

  it("handles empty content", () => {
    expect(offsetToCursor("", 0)).toEqual({ line: 0, col: 0 });
  });
});
